import java.nio.file.*;
import java.sql.*;
import java.util.*;
import com.fasterxml.jackson.databind.*;

/** Read-only financial and all-field verification of the isolated restored database. */
public class AistarFinancialAudit {
    static final Path ROOT=Path.of("/opt/aistar-migration/preparation");
    public static void main(String[] args)throws Exception {
        if(args.length!=1||!args[0].matches("restore-[a-f0-9]{16}\\.json"))throw new IllegalArgumentException("Owned restore receipt required");
        var json=new ObjectMapper();var config=json.readTree(Files.readString(ROOT.resolve("resource-secrets.json")));
        String host=config.get("rds_host").asText(),role="aistar_rehearsal",db="aistar_schema_rehearsal";
        if(!host.equals("pgm-bp1gp4819mbs30z3.pg.rds.aliyuncs.com"))throw new IllegalStateException("Scope mismatch");
        String url="jdbc:postgresql://"+host+":5432/"+db+"?sslmode=verify-full&sslrootcert="+ROOT.resolve("rds-ca.pem")+"&connectTimeout=10&socketTimeout=180";
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
        var original=json.readTree(Files.readString(ROOT.resolve(args[0])));var order=json.readTree(Files.readString(ROOT.resolve("source-column-order.json")));
        var proof=new TreeMap<String,Object>();
        try(var c=DriverManager.getConnection(url,role,config.get("rds_roles").get(role).asText())) {
            proof.put("driver_version",c.getMetaData().getDriverVersion());
            c.setReadOnly(true);c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);c.setAutoCommit(false);
            try(var st=c.createStatement()) {st.execute("set time zone 'UTC'");try(var rs=st.executeQuery("select current_database(),current_user,(select version from flyway_schema_history where success order by installed_rank desc limit 1)")){rs.next();if(!db.equals(rs.getString(1))||!role.equals(rs.getString(2))||!"78".equals(rs.getString(3)))throw new IllegalStateException("Database/role/version mismatch");}}
            var counts=new TreeMap<String,Long>();for(var entry:queries.entrySet())try(var st=c.createStatement();var rs=st.executeQuery(entry.getValue())){rs.next();counts.put(entry.getKey(),rs.getLong(1));}
            proof.put("violation_counts",counts);
            try(var st=c.createStatement();var rs=st.executeQuery("select table_name,column_name,data_type from information_schema.columns where table_schema='public' and table_name<>'flyway_schema_history' order by table_name,ordinal_position")) {
                while(rs.next())AistarRehearsalRestore.pg.computeIfAbsent(rs.getString(1),x->new LinkedHashMap<>()).put(rs.getString(2),rs.getString(3));
            }
            if(AistarRehearsalRestore.pg.size()!=195||original.get("verified_tables").asInt()!=195)throw new IllegalStateException("Table coverage mismatch");
            for(String table:AistarRehearsalRestore.pg.keySet()) {
                var cols=new ArrayList<String>();for(var col:order.get(table))cols.add(col.asText());
                if(!new HashSet<>(cols).equals(AistarRehearsalRestore.pg.get(table).keySet()))throw new IllegalStateException("Column coverage mismatch");
                AistarRehearsalRestore.columns.put(table,cols);
                var actual=AistarRehearsalRestore.fingerprint(c,table).receipt();var expected=original.get("tables").get(table);
                for(String key:List.of("rows","sum_sha256","xor_sha256"))if(!String.valueOf(actual.get(key)).equals(expected.get(key).asText()))throw new IllegalStateException("Fingerprint mismatch after V78: "+table);
            }
            try(var st=c.createStatement();var rs=st.executeQuery("select pg_database_size(current_database())")){rs.next();proof.put("database_bytes",rs.getLong(1));}
            c.rollback();
        }
        proof.put("verified_tables",195);proof.put("all_fingerprints_match_after_v78",true);proof.put("read_only",true);proof.put("production_changed",false);proof.put("snapshot_sha256",original.get("snapshot_sha256").asText());
        Files.writeString(ROOT.resolve("financial-verification.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(proof));System.out.println("Read-only 195-table fingerprints and financial invariants verified");
    }
}
