import java.nio.file.*;
import java.sql.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import com.fasterxml.jackson.databind.*;

/** Only the dedicated AIStar rehearsal database is reachable through this tool. */
public class AistarPreparation {
    static final Path ROOT=Path.of("/opt/aistar-migration/preparation");
    static final String DB="aistar_schema_rehearsal",ROLE="aistar_rehearsal";
    public static void main(String[] args)throws Exception {
        var json=new ObjectMapper();var config=json.readTree(Files.readString(ROOT.resolve("resource-secrets.json")));
        String host=config.get("rds_host").asText();
        if(!host.equals("pgm-bp1gp4819mbs30z3.pg.rds.aliyuncs.com"))throw new IllegalStateException("Unexpected RDS");
        String url="jdbc:postgresql://"+host+":5432/"+DB+"?sslmode=verify-full&sslrootcert="+ROOT.resolve("rds-ca.pem")+"&connectTimeout=10&socketTimeout=180";
        String password=config.get("rds_roles").get(ROLE).asText();
        try(var c=DriverManager.getConnection(url,ROLE,password);var s=c.createStatement();var rs=s.executeQuery("select current_database(),current_user,rolsuper,rolcreatedb from pg_roles where rolname=current_user")) {
            if(!rs.next()||!DB.equals(rs.getString(1))||!ROLE.equals(rs.getString(2))||rs.getBoolean(3)||rs.getBoolean(4))throw new IllegalStateException("Scope/privilege mismatch");
        }
        if(args.length!=1)throw new IllegalArgumentException("migrate or inspect");
        if(args[0].equals("migrate"))Flyway.configure().dataSource(url,ROLE,password).locations("filesystem:"+ROOT.resolve("schema")).baselineOnMigrate(false).load().migrate();
        else if(!args[0].equals("inspect"))throw new IllegalArgumentException("Unsupported operation");
        var proof=new LinkedHashMap<String,Object>();proof.put("database",DB);proof.put("role",ROLE);proof.put("production_changed",false);
        try(var c=DriverManager.getConnection(url,ROLE,password);var s=c.createStatement()) {
            s.execute("set time zone 'UTC'");var counts=new TreeMap<String,Long>();
            try(var rs=s.executeQuery("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name<>'flyway_schema_history' order by table_name")) {
                var tables=new ArrayList<String>();while(rs.next())tables.add(rs.getString(1));
                for(String table:tables){if(!table.matches("[a-z0-9_]+"))throw new IllegalStateException("Identifier");try(var cs=c.createStatement();var cr=cs.executeQuery("select count(*) from \""+table+"\"")){cr.next();counts.put(table,cr.getLong(1));}}
            }
            proof.put("tables",counts.size());proof.put("row_counts",counts);proof.put("rows",counts.values().stream().mapToLong(Long::longValue).sum());
            try(var rs=s.executeQuery("select version from flyway_schema_history where success order by installed_rank")){var versions=new ArrayList<String>();while(rs.next())versions.add(rs.getString(1));proof.put("versions",versions);}
            try(var rs=s.executeQuery("select collprovider,collisdeterministic,collversion from pg_collation where collname='aep_identifier_ci' and collnamespace='public'::regnamespace")){if(rs.next())proof.put("identifier_collation",Map.of("provider",rs.getString(1),"deterministic",rs.getBoolean(2),"version",rs.getString(3)));}
        }
        Files.writeString(ROOT.resolve("database-inspection.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(proof));System.out.println("AIStar rehearsal schema inspected; no production target supported");
    }
}
