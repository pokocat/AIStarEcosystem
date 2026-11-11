import java.nio.file.*;
import java.io.*;
import java.sql.*;
import java.util.*;
import java.time.*;
import java.time.format.*;
import java.math.*;
import java.security.*;
import java.util.zip.*;
import com.fasterxml.jackson.databind.*;
import org.postgresql.PGConnection;
/** Fixed-scope restore with all-row fingerprints verified before transaction commit. */
public class AistarSnapshotRestore {
    static ObjectMapper json=new ObjectMapper();
    static Path root=Path.of("/opt/aistar-migration/preparation");
    static Map<String,LinkedHashMap<String,String>> pg=new TreeMap<>();
    static Map<String,List<String>> columns=new TreeMap<>();
    static JsonNode temporalPlan;
    static Map<String,Proof> expected=new TreeMap<>();
    static Map<String,Long> counts=new TreeMap<>();
    static Map<String,Path> files=new TreeMap<>();
    static final BigInteger MASK=BigInteger.ONE.shiftLeft(256).subtract(BigInteger.ONE);
    static DateTimeFormatter fmt=DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSSSSS");
    static class Proof {
        List<BigInteger> columnSums=new ArrayList<>();
        long rows;
        BigInteger sum=BigInteger.ZERO,xor=BigInteger.ZERO;
        void add(List<byte[]> values)throws Exception {
            for(int i=0;i<values.size();i++){
                byte[] b=values.get(i);
                var hash=MessageDigest.getInstance("SHA-256");
                hash.update((byte)(b==null?'N':'V'));
                if(b!=null)hash.update(b);
                var n=new BigInteger(1,hash.digest());
                if(columnSums.size()<=i)columnSums.add(BigInteger.ZERO);
                columnSums.set(i,columnSums.get(i).add(n).and(MASK));
            }
            var h=MessageDigest.getInstance("SHA-256");
            for(byte[] b:values){
                if(b==null)h.update((byte)'N');
                else{
                    h.update((byte)'V');
                    h.update(java.nio.ByteBuffer.allocate(8).putLong(b.length).array());
                    h.update(b);
                }
            }
            var n=new BigInteger(1,h.digest());
            rows++;
            sum=sum.add(n).and(MASK);
            xor=xor.xor(n);
        }
        boolean same(Proof p){
            return rows==p.rows&&sum.equals(p.sum)&&xor.equals(p.xor);
        }
        Map<String,Object> receipt(){
            return Map.of("rows",rows,"sum_sha256",String.format("%064x",sum),"xor_sha256",String.format("%064x",xor),"matched",true);
        }
    }
    static String q(String s){
        if(!s.matches("[a-z0-9_]+"))throw new IllegalStateException("Invalid identifier");
        return '"'+s+'"';
    }
    static byte[] normalize(byte[] raw,String typ,String key,boolean source)throws Exception {
        return normalize(raw,typ,key,source,null);
    }
    static byte[] normalize(byte[] raw,String typ,String key,boolean source,String rowId)throws Exception {
        if(raw==null)return null;
        if(typ.equals("timestamp with time zone")){
            var local=LocalDateTime.parse(new String(raw,java.nio.charset.StandardCharsets.UTF_8).replace(' ','T'));
            if(source && !temporalPlan.has(key))throw new IllegalStateException("Missing temporal plan: "+key);
            String zone=source?AistarTemporalPolicy.sourceZone(temporalPlan,key,rowId,new String(raw,java.nio.charset.StandardCharsets.UTF_8)):"UTC";
            return fmt.format(local.atZone(ZoneId.of(zone)).withZoneSameInstant(ZoneOffset.UTC)).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        }
        if(Set.of("numeric","bigint","integer","smallint").contains(typ))return new BigDecimal(new String(raw,java.nio.charset.StandardCharsets.UTF_8)).stripTrailingZeros().toPlainString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if(Set.of("double precision","real").contains(typ))return Double.toString(Double.parseDouble(new String(raw,java.nio.charset.StandardCharsets.UTF_8))).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if(typ.equals("boolean")){
            String b=new String(raw,java.nio.charset.StandardCharsets.US_ASCII);
            if(!b.equals("0")&&!b.equals("1"))throw new IllegalStateException("Invalid bool");
            return raw;
        }
        if(!typ.equals("bytea")){
            var decoder=java.nio.charset.StandardCharsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT);
            decoder.decode(java.nio.ByteBuffer.wrap(raw));
            for(byte b:raw)if(b==0)throw new IllegalStateException("NUL in text");
        }
        return raw;
    }
    static String copyValue(byte[] b,String typ){
        if(b==null)return "\\N";
        String value=typ.equals("bytea")?"\\x"+HexFormat.of().formatHex(b):new String(b,java.nio.charset.StandardCharsets.UTF_8);
        if(typ.equals("timestamp with time zone"))value+="+00";
        return value.replace("\\","\\\\").replace("\t","\\t").replace("\n","\\n").replace("\r","\\r");
    }
    static List<String> order(Connection c)throws Exception {
        var dependencies=new HashMap<String,Set<String>>();
        try(var s=c.createStatement();var rs=s.executeQuery("select a.relname,b.relname from pg_constraint c join pg_class a on a.oid=c.conrelid join pg_class b on b.oid=c.confrelid join pg_namespace n on n.oid=a.relnamespace where c.contype='f' and n.nspname='public'")){
            while(rs.next())if(!rs.getString(1).equals(rs.getString(2)))dependencies.computeIfAbsent(rs.getString(1),x->new HashSet<>()).add(rs.getString(2));
        }
        var remaining=new TreeSet<>(pg.keySet());
        var ordered=new ArrayList<String>();
        while(!remaining.isEmpty()){
            var ready=new ArrayList<String>();
            for(String t:remaining)if(Collections.disjoint(dependencies.getOrDefault(t,Set.of()),remaining))ready.add(t);
            if(ready.isEmpty())throw new IllegalStateException("FK cycle");
            ordered.addAll(ready);
            remaining.removeAll(ready);
        }
        return ordered;
    }
    static Proof fingerprint(Connection c,String table)throws Exception {
        List<String> expr=new ArrayList<>();
        for(String col:columns.get(table)){
            String name=q(col),typ=pg.get(table).get(col),value;
            if(typ.equals("bytea"))value="encode("+name+",'hex')";
            else{
                String text=typ.equals("timestamp with time zone")?"to_char("+name+" AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.US')":typ.equals("boolean")?"CASE WHEN "+name+" THEN '1' ELSE '0' END":name+"::text";
                value="encode(convert_to("+text+",'UTF8'),'hex')";
            }
            expr.add("CASE WHEN "+name+" IS NULL THEN NULL ELSE "+value+" END");
        }
        var proof=new Proof();
        try(var s=c.createStatement()){
            s.setFetchSize(200);
            try(var rs=s.executeQuery("select json_build_array("+String.join(",",expr)+")::text from "+q(table))){
                while(rs.next()){
                    var vals=new ArrayList<byte[]>();
                    int index=0;
                    for(var x:json.readTree(rs.getString(1))) {
                        String col=columns.get(table).get(index++);
                        vals.add(normalize(x.isNull()?null:HexFormat.of().parseHex(x.asText()),pg.get(table).get(col),table+"."+col,false));
                    }
                    proof.add(vals);
                }
            }
        }
        return proof;
    }
    public static void main(String[] args)throws Exception {
        long start=System.nanoTime();
        if(args.length!=4)throw new IllegalArgumentException("mode snapshot output-receipt permit");
        String mode=args[0];
        boolean production=mode.equals("production");
        if(!production&&!mode.equals("drill"))throw new IllegalStateException("Unsupported import mode");
        String db=production?"aistar_prod":"aistar_cutover_drill";
        Path permitPath=Path.of(args[3]).toRealPath();
        AistarCutoverGuard.privateFile(permitPath);
        var permit=json.readTree(Files.readString(permitPath));
        AistarCutoverGuard.checkMode(mode,permit,Instant.now());
        temporalPlan=json.readTree(Files.readString(root.resolve("temporal-plan.json")));
        var cfg=json.readTree(Files.readString(root.resolve("resource-secrets.json")));
        String host=cfg.get("rds_host").asText();
        if(!host.equals("pgm-bp1gp4819mbs30z3.pg.rds.aliyuncs.com"))throw new IllegalStateException("RDS mismatch");
        String role=production?"aistar_migrator":"aistar_rehearsal";
        String url="jdbc:postgresql://"+host+":5432/"+db+"?sslmode=verify-full&sslrootcert="+root.resolve("rds-ca.pem")+"&options=-c%20TimeZone%3DUTC&connectTimeout=10&socketTimeout=180";
        Path snapshot=Path.of(args[1]).toRealPath();Path receiptPath=Path.of(args[2]).toAbsolutePath();
        if(!snapshot.getParent().equals(root)||!receiptPath.getParent().equals(root)||Files.exists(receiptPath))throw new IllegalStateException("Protected paths required; refuse receipt overwrite");
        var permissions=java.nio.file.attribute.PosixFilePermissions.fromString("rw-------");
        if(!Files.getOwner(snapshot).getName().equals("root")||!Files.getPosixFilePermissions(snapshot).equals(permissions))throw new IllegalStateException("Snapshot must be root:600");
        String snapshotSha=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(snapshot)));
        if(!snapshotSha.equals(permit.path("snapshot_sha256").asText()))throw new IllegalStateException("Permit snapshot mismatch");
        if(!HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(root.resolve("temporal-plan.json")))).equals(permit.path("temporal_plan_sha256").asText()))throw new IllegalStateException("Temporal plan changed");
        JsonNode sourceMetadata;
        try(var input=new BufferedReader(new InputStreamReader(new GZIPInputStream(Files.newInputStream(snapshot)),java.nio.charset.StandardCharsets.UTF_8))) { sourceMetadata=json.readTree(input.readLine()); }
        AistarCutoverGuard.checkSnapshot(mode,permit,sourceMetadata,Instant.now());
        Path folder=Files.createTempDirectory(root,"restore-copy-");
        folder.toFile().setReadable(false,false);
        folder.toFile().setWritable(false,false);
        folder.toFile().setExecutable(false,false);
        folder.toFile().setReadable(true,true);
        folder.toFile().setWritable(true,true);
        folder.toFile().setExecutable(true,true);
        try(var c=DriverManager.getConnection(url,role,cfg.get("rds_roles").get(role).asText())){
            try(var lock=c.createStatement();var held=lock.executeQuery("select pg_try_advisory_lock(1810577,192)")) { held.next();if(!held.getBoolean(1))throw new IllegalStateException("Another migration is active"); }
            try(var identity=c.createStatement();var rs=identity.executeQuery("select current_database(),current_user,rolsuper,rolcreatedb from pg_roles where rolname=current_user")) {
                if(!rs.next()||!db.equals(rs.getString(1))||!role.equals(rs.getString(2))||rs.getBoolean(3)||rs.getBoolean(4))throw new IllegalStateException("Actual import scope/role mismatch");
            }
            try(var check=c.createStatement();var rs=check.executeQuery("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name<>'flyway_schema_history'")) {
                var existing=new ArrayList<String>();while(rs.next())existing.add(rs.getString(1));
                for(String t:existing)try(var st=c.createStatement();var rows=st.executeQuery("select count(*) from "+q(t))) { rows.next();if(rows.getLong(1)!=0)throw new IllegalStateException("Nonempty target; no schema/import changes allowed"); }
            }
            AistarCutoverGuard.checkSnapshot(mode,permit,sourceMetadata,Instant.now());
            AistarCutoverGuard.checkMigrations(root.resolve("schema"),permit);
            org.flywaydb.core.Flyway.configure().dataSource(url,role,cfg.get("rds_roles").get(role).asText()).locations("filesystem:"+root.resolve("schema")).baselineOnMigrate(false).load().migrate();
            try(var setup=c.createStatement()){
                setup.execute("SET TIME ZONE 'UTC'");
                try(var tz=setup.executeQuery("show TimeZone")){
                    tz.next();
                    if(!tz.getString(1).equals("UTC"))throw new IllegalStateException("UTC session required");
                }
            }
            try(var s=c.createStatement();var rs=s.executeQuery("select current_database(),current_user,(select version from flyway_schema_history where success order by installed_rank desc limit 1)")){
                rs.next();
                if(!db.equals(rs.getString(1))||!role.equals(rs.getString(2))||!"79".equals(rs.getString(3)))throw new IllegalStateException("DB role/version mismatch");
            }
            try(var s=c.createStatement();var rs=s.executeQuery("select table_name,column_name,data_type from information_schema.columns where table_schema='public' and table_name<>'flyway_schema_history' order by table_name,ordinal_position")){
                while(rs.next())pg.computeIfAbsent(rs.getString(1),x->new LinkedHashMap<>()).put(rs.getString(2),rs.getString(3));
            }
            if(pg.size()!=195)throw new IllegalStateException("Expected 195 business tables");
            for(String t:pg.keySet())try(var s=c.createStatement();var rs=s.executeQuery("select count(*) from "+q(t))){
                rs.next();
                if(rs.getLong(1)!=0)throw new IllegalStateException("Target contains data: refuse overwrite");
            }
            boolean complete=false,metadata=false,frozen=false;
            Instant captured=null;
            String freezeUtc=null;
            BufferedWriter writer=null;
            String current=null;
            try(var input=new BufferedReader(new InputStreamReader(new GZIPInputStream(Files.newInputStream(snapshot)),java.nio.charset.StandardCharsets.UTF_8))){
                String line;
                while((line=input.readLine())!=null){
                    var row=json.readTree(line);
                    String kind=row.get("type").asText();
                    if(kind.equals("snapshot_metadata")){
                        if(metadata)throw new IllegalStateException("Duplicate metadata");
                        metadata=true;
                        frozen=row.get("source_frozen").asBoolean();
                        captured=Instant.parse(row.get("captured_utc").asText());
                        freezeUtc=row.hasNonNull("source_freeze_utc")?row.get("source_freeze_utc").asText():null;
                        continue;
                    }
                    if(kind.equals("complete")){
                        complete=true;
                        continue;
                    }
                    if(complete)throw new IllegalStateException("Rows after completion");
                    String t=row.get("name").asText();
                    if(t.equals("flyway_schema_history"))continue;
                    if(!pg.containsKey(t))throw new IllegalStateException("Unexpected table");
                    if(kind.equals("table")){
                        if(columns.containsKey(t))throw new IllegalStateException("Duplicate table");
                        if(writer!=null)writer.close();
                        var cols=new ArrayList<String>();
                        for(var col:row.get("columns"))cols.add(col.get("name").asText());
                        if(cols.size()!=new HashSet<>(cols).size()||!new HashSet<>(cols).equals(pg.get(t).keySet()))throw new IllegalStateException("Column mismatch");
                        columns.put(t,cols);
                        expected.put(t,new Proof());
                        Path file=folder.resolve(t+".copy");
                        files.put(t,file);
                        writer=Files.newBufferedWriter(file,java.nio.charset.StandardCharsets.UTF_8);
                        current=t;
                    }
                    else if(kind.equals("count")){
                        if(counts.put(t,row.get("rows").asLong())!=null)throw new IllegalStateException("Duplicate count");
                    }
                    else if(kind.equals("row")){
                        if(!t.equals(current)||writer==null)throw new IllegalStateException("Unordered source");
                        var cols=columns.get(t);
                        if(row.get("values").size()!=cols.size())throw new IllegalStateException("Row width mismatch");
                        var values=new ArrayList<byte[]>();
                        var copied=new ArrayList<String>();
                        // Only the mixed-writer library timestamps need an audited row identity.
                        String rowId=t.equals("video_asset_library")?new String(HexFormat.of().parseHex(row.path("values").get(cols.indexOf("id")).asText()),java.nio.charset.StandardCharsets.UTF_8):null;
                        for(int i=0;i<cols.size();i++){
                            var v=row.get("values").get(i);
                            byte[] b=normalize(v.isNull()?null:HexFormat.of().parseHex(v.asText()),pg.get(t).get(cols.get(i)),t+"."+cols.get(i),true,rowId);
                            values.add(b);
                            copied.add(copyValue(b,pg.get(t).get(cols.get(i))));
                        }
                        expected.get(t).add(values);
                        writer.write(String.join("\t",copied));
                        writer.newLine();
                    }
                    else throw new IllegalStateException("Unknown record");
                }
            }
            finally{
                if(writer!=null)writer.close();
            }
            if(!metadata||!complete||!columns.keySet().equals(pg.keySet()))throw new IllegalStateException("Incomplete snapshot");
            for(String t:pg.keySet())if(expected.get(t).rows!=counts.getOrDefault(t,-1L))throw new IllegalStateException("Source counts mismatch");
            double prepared=(System.nanoTime()-start)/1e9;
            c.setAutoCommit(false);
            try{
                for(String t:order(c)){
                    String names=columns.get(t).stream().map(AistarSnapshotRestore::q).collect(java.util.stream.Collectors.joining(","));
                    try(var inputBytes=Files.newInputStream(files.get(t))){
                        long copied=c.unwrap(PGConnection.class).getCopyAPI().copyIn("COPY "+q(t)+" ("+names+") FROM STDIN",inputBytes);
                        if(copied!=expected.get(t).rows)throw new IllegalStateException("COPY count mismatch");
                    }
                }
                try(var s=c.createStatement();var rs=s.executeQuery("select table_name,column_name from information_schema.columns where table_schema='public' and is_identity='YES'")){
                    while(rs.next()){
                        String t=rs.getString(1),col=rs.getString(2);
                        try(var seq=c.createStatement()){
                            seq.execute("SELECT setval(pg_get_serial_sequence('"+t+"','"+col+"'),COALESCE(MAX("+q(col)+"),1),MAX("+q(col)+") IS NOT NULL) FROM "+q(t));
                        }
                    }
                }
                var proof=new TreeMap<String,Object>();
                for(String t:pg.keySet()){
                    var actual=fingerprint(c,t);
                    if(!actual.same(expected.get(t))){
                        var bad=new ArrayList<String>();
                        for(int i=0;i<columns.get(t).size();i++)if(!actual.columnSums.get(i).equals(expected.get(t).columnSums.get(i)))bad.add(columns.get(t).get(i));
                        throw new IllegalStateException("Content fingerprint mismatch: "+t+" columns="+bad+" expectedRows="+expected.get(t).rows+" actualRows="+actual.rows);
                    }
                    proof.put(t,actual.receipt());
                }
        var queries=new TreeMap<String,String>();
        queries.put("wallet_bucket_mismatch","select count(*) from aep_wallets where total_balance<>gift_balance+license_balance+recharge_balance");
        queries.put("wallet_negative_buckets","select count(*) from aep_wallets where gift_balance<0 or license_balance<0 or recharge_balance<0 or pending_balance<0");
        queries.put("hold_remaining_outside_bounds","select count(*) from aep_credit_holds where remaining_amount<0 or remaining_amount>amount");
        queries.put("terminal_hold_remaining","select count(*) from aep_credit_holds where status<>'ACTIVE' and remaining_amount<>0");
        queries.put("grant_conservation","select count(*) from aep_credit_grants where amount<>available+frozen+spent+expired");
        queries.put("grant_allocation_conservation","select count(*) from aep_credit_grant_holds where original_amount<>frozen+consumed+released");
        queries.put("model_payable_split","select count(*) from aep_model_charges where payable_credits<>scoped_credits+wallet_credits");
        queries.put("model_settled_split","select count(*) from aep_model_charges where settled_payable_credits<>settled_scoped_credits+settled_wallet_credits");
        queries.put("enterprise_lot_negative","select count(*) from aep_enterprise_credit_lots where available<0 or frozen<0");
        queries.put("ledger_wallet_orphans","select count(*) from aep_ledger_entries l left join aep_wallets w on w.id=l.wallet_id where l.wallet_id is not null and w.id is null");

                var financial=new TreeMap<String,Long>();
                for(var entry:queries.entrySet())try(var st=c.createStatement();var rows=st.executeQuery(entry.getValue())) { rows.next();long violations=rows.getLong(1);financial.put(entry.getKey(),violations);if(violations!=0)throw new IllegalStateException("Financial invariant failed: "+entry.getKey()); }
                AistarCutoverGuard.checkSnapshot(mode,permit,sourceMetadata,Instant.now());
                c.commit();
                var receipt=new LinkedHashMap<String,Object>();
                receipt.put("database",db);
                receipt.put("production",production);
                receipt.put("mode",mode);
                receipt.put("source_critical_environment_sha256",permit.path("source_critical_environment_sha256").asText());
                receipt.put("financial_violation_counts",financial);
                receipt.put("source_artifact_sha256",sourceMetadata.path("source_artifact_sha256").asText());
                receipt.put("source_schema_sha256",sourceMetadata.path("source_schema_sha256").asText());
                receipt.put("permit_sha256",HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(permitPath))));
                receipt.put("source_frozen",frozen);
                receipt.put("source_freeze_utc",freezeUtc);
                receipt.put("source_captured_utc",captured.toString());
                receipt.put("committed_utc",Instant.now().toString());
                receipt.put("tables",proof);
                receipt.put("verified_tables",proof.size());
                receipt.put("snapshot_sha256",snapshotSha);
                receipt.put("prepare_seconds",prepared);
                receipt.put("total_seconds",(System.nanoTime()-start)/1e9);
                Files.writeString(receiptPath,json.writerWithDefaultPrettyPrinter().writeValueAsString(receipt));
                Files.setPosixFilePermissions(receiptPath,permissions);
                System.out.println("Verified and committed all 195 tables; receipts contain no row values");
            }
            catch(Exception e){
                c.rollback();
                throw e;
            }
        }
        finally{
            for(Path p:files.values())Files.deleteIfExists(p);
            Files.deleteIfExists(folder);
        }
    }
}
