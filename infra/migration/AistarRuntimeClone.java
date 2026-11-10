import java.nio.file.*;
import java.sql.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.postgresql.PGConnection;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Makes a distinct API-only lab schema; never edits the restored public snapshot or production. */
public class AistarRuntimeClone {
    static final Path ROOT=Path.of("/opt/aistar-migration/preparation");
    public static void main(String[] args)throws Exception {
        if(args.length!=0)throw new IllegalArgumentException("No target override accepted");
        var json=new ObjectMapper();var cfg=json.readTree(Files.readString(ROOT.resolve("resource-secrets.json")));
        String host=cfg.get("rds_host").asText(),role="aistar_rehearsal",db="aistar_schema_rehearsal",schema="aistar_api_rehearsal";
        if(!host.equals("pgm-bp1gp4819mbs30z3.pg.rds.aliyuncs.com"))throw new IllegalStateException("Scope mismatch");
        String base="jdbc:postgresql://"+host+":5432/"+db+"?sslmode=verify-full&sslrootcert="+ROOT.resolve("rds-ca.pem")+"&options=-c%20TimeZone%3DUTC&connectTimeout=10&socketTimeout=180";
        String password=cfg.get("rds_roles").get(role).asText();
        try(var source=DriverManager.getConnection(base,role,password)) {
            try(var s=source.prepareStatement("select count(*) from information_schema.schemata where schema_name=?")){s.setString(1,schema);try(var r=s.executeQuery()){r.next();if(r.getLong(1)!=0)throw new IllegalStateException("Runtime lab already exists; refuse overwrite");}}
        }
        Flyway.configure().dataSource(base+"&currentSchema="+schema,role,password).schemas(schema).defaultSchema(schema).locations("filesystem:"+ROOT.resolve("schema")).baselineOnMigrate(false).load().migrate();
        try(var source=DriverManager.getConnection(base,role,password);var dest=DriverManager.getConnection(base+"&currentSchema="+schema,role,password)) {
            source.setReadOnly(true);source.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);source.setAutoCommit(false);dest.setAutoCommit(false);
            try(var s=source.createStatement();var rs=s.executeQuery("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name<>'flyway_schema_history' order by table_name")){while(rs.next())AistarRehearsalRestore.pg.put(rs.getString(1),new LinkedHashMap<>());}
            if(AistarRehearsalRestore.pg.size()!=195)throw new IllegalStateException("Incomplete source");
            long copied=0;
            for(String table:AistarRehearsalRestore.order(source)) {
                String quoted=AistarRehearsalRestore.q(table);var out=source.unwrap(PGConnection.class).getCopyAPI().copyOut("COPY public."+quoted+" TO STDOUT");var in=dest.unwrap(PGConnection.class).getCopyAPI().copyIn("COPY "+schema+"."+quoted+" FROM STDIN");byte[] block;
                while((block=out.readFromCopy())!=null)in.writeToCopy(block,0,block.length);copied+=in.endCopy();
            }
            try(var s=dest.createStatement();var rs=s.executeQuery("select table_name,column_name from information_schema.columns where table_schema='"+schema+"' and is_identity='YES'")){while(rs.next())try(var seq=dest.createStatement()){String table=rs.getString(1),col=rs.getString(2);seq.execute("SELECT setval(pg_get_serial_sequence('"+schema+"."+table+"','"+col+"'),COALESCE(MAX(\""+col+"\"),1),MAX(\""+col+"\") IS NOT NULL) FROM "+schema+".\""+table+"\"");}}
            String username="migration-"+UUID.randomUUID().toString().substring(0,8),raw=UUID.randomUUID().toString()+UUID.randomUUID();
            try(var s=dest.prepareStatement("insert into "+schema+".admin_users(id,username,password_hash,role,status,display_name) values (?,?,?,'SUPER_ADMIN','ACTIVE','Migration acceptance')")) {s.setString(1,"migration-rehearsal-admin");s.setString(2,username);s.setString(3,new BCryptPasswordEncoder().encode(raw));s.executeUpdate();}
            dest.commit();source.rollback();
            Files.writeString(ROOT.resolve("runtime-test-credentials.json"),json.writeValueAsString(Map.of("username",username,"password",raw)));Files.setPosixFilePermissions(ROOT.resolve("runtime-test-credentials.json"),java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            Files.writeString(ROOT.resolve("runtime-clone.json"),json.writeValueAsString(Map.of("schema",schema,"copied_tables",195,"copied_rows",copied,"synthetic_admin_added",true,"production_changed",false)));System.out.println("Created isolated API lab from verified snapshot; no existing schema overwritten");
        }
    }
}
