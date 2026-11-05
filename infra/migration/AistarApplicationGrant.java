import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.time.*;
import java.security.*;
import com.fasterxml.jackson.databind.*;
/** Apply minimal runtime privileges only after an independently verified import receipt. */
public class AistarApplicationGrant {
    public static void main(String[] args)throws Exception {
        if(args.length!=3||!Set.of("drill","production").contains(args[0]))throw new IllegalArgumentException("mode permit receipt");
        String mode=args[0],db=mode.equals("production")?"aistar_prod":"aistar_cutover_drill",owner=mode.equals("production")?"aistar_migrator":"aistar_rehearsal",app=mode.equals("production")?"aistar_app":"aistar_runtime";
        Path root=Path.of("/opt/aistar-migration/preparation"),permitPath=Path.of(args[1]).toRealPath(),receiptPath=Path.of(args[2]).toRealPath();AistarCutoverGuard.privateFile(permitPath);AistarCutoverGuard.privateFile(receiptPath);
        var json=new ObjectMapper();var permit=json.readTree(Files.readString(permitPath));AistarCutoverGuard.checkMode(mode,permit,Instant.now());
        var receipt=json.readTree(Files.readString(receiptPath));
        if(!db.equals(receipt.path("database").asText())||receipt.path("verified_tables").asInt()!=192||!receipt.path("snapshot_sha256").asText().equals(permit.path("snapshot_sha256").asText())||!receipt.path("permit_sha256").asText().equals(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(permitPath)))))throw new IllegalStateException("Unverified import receipt");
        if(receipt.path("tables").size()!=192||!receipt.path("financial_violation_counts").isObject()||receipt.path("financial_violation_counts").size()!=10)throw new IllegalStateException("Incomplete checks");
        receipt.path("tables").forEach(t->{if(!t.path("matched").asBoolean(false))throw new IllegalStateException("Unmatched table");});receipt.path("financial_violation_counts").forEach(t->{if(t.asLong(-1)!=0)throw new IllegalStateException("Financial check failed");});
        if(mode.equals("production")&&!receipt.path("source_frozen").asBoolean(false))throw new IllegalStateException("Production requires frozen receipt");
        var config=json.readTree(Files.readString(root.resolve("resource-secrets.json")));String url="jdbc:postgresql://"+AistarCutoverGuard.HOST+":5432/"+db+"?sslmode=verify-full&sslrootcert="+root.resolve("rds-ca.pem")+"&connectTimeout=10&socketTimeout=30";
        String appPassword=config.path("rds_roles").path(app).asText();
        if(mode.equals("drill")) { var env=json.readTree(Files.readString(root.resolve("api-environment-private.json")));if(!"aistar_runtime".equals(env.path("DB_USERNAME").asText()))throw new IllegalStateException("Drill runtime credential identity mismatch");appPassword=env.path("DB_PASSWORD").asText(); }
        if(appPassword.isBlank())throw new IllegalStateException("Runtime credential missing");
        try(var auth=DriverManager.getConnection(url,app,appPassword)) { if(!auth.isValid(5))throw new IllegalStateException("Runtime login unavailable"); }
        try(var c=DriverManager.getConnection(url,owner,config.path("rds_roles").path(owner).asText())) {
            c.setAutoCommit(false);
            try(var s=c.createStatement()) {
                try(var r=s.executeQuery("select current_database(),current_user,rolsuper,rolcreatedb,rolcreaterole from pg_roles where rolname='"+app+"'")) { if(!r.next()||!db.equals(r.getString(1))||!owner.equals(r.getString(2))||r.getBoolean(3)||r.getBoolean(4)||r.getBoolean(5))throw new IllegalStateException("Runtime role scope mismatch"); }
                s.execute("REVOKE CREATE ON SCHEMA public FROM PUBLIC");s.execute("REVOKE CREATE ON SCHEMA public FROM "+app);s.execute("GRANT USAGE ON SCHEMA public TO "+app);
                try(var rows=s.executeQuery("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name<>'flyway_schema_history'")) {
                    var tables=new ArrayList<String>();while(rows.next())tables.add(rows.getString(1));if(tables.size()!=192)throw new IllegalStateException("Schema changed");
                    for(String table:tables)try(var grant=c.createStatement()){grant.execute("GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE "+AistarSnapshotRestore.q(table)+" TO "+app);}
                }
                s.execute("GRANT SELECT ON TABLE flyway_schema_history TO "+app);s.execute("GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "+app);
                s.execute("ALTER DEFAULT PRIVILEGES FOR ROLE "+owner+" IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO "+app);s.execute("ALTER DEFAULT PRIVILEGES FOR ROLE "+owner+" IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO "+app);
                AistarCutoverGuard.checkMode(mode,permit,Instant.now());c.commit();
            }catch(Exception e){c.rollback();throw e;}
        }
        try(var c=DriverManager.getConnection(url,app,appPassword);var s=c.createStatement()) {
            c.setAutoCommit(false);
            try(var r=s.executeQuery("select has_schema_privilege(current_user,'public','CREATE'),(select count(*) from admin_users)")){r.next();if(r.getBoolean(1))throw new IllegalStateException("Runtime role can create schema objects");}
            s.executeUpdate("update admin_users set username=username where false");c.rollback();
            boolean denied=false;try{s.execute("create table aistar_runtime_ddl_must_fail(id int)");}catch(SQLException expected){denied="42501".equals(expected.getSQLState());}finally{c.rollback();}
            if(!denied)throw new IllegalStateException("Runtime DDL not denied");
        }
        System.out.println("Verified runtime DML and denied DDL for "+db+"; no row values changed");
    }
}
