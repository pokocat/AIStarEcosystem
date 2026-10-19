package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.sql.*;
import java.util.*;

/** Enterprise foundation. No historical ledger mutation or product entitlement grants. */
public class V56__enterprise_accounts_foundation extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        Connection c=context.getConnection();
        for(String ddl : TABLES) try(var s=c.createStatement()){s.execute(ddl);}
        if(table(c,"aep_wallets")) {
            add(c,"aep_wallets","account_type","VARCHAR(32) NOT NULL DEFAULT 'personal'");
            add(c,"aep_wallets","account_key","VARCHAR(512) NULL");
            add(c,"aep_wallets","enterprise_id","VARCHAR(64) NULL");
            add(c,"aep_wallets","member_user_id","VARCHAR(64) NULL");
            try(var s=c.createStatement()) {
                s.executeUpdate("UPDATE aep_wallets SET account_key=CONCAT('personal:',user_id) WHERE account_key IS NULL AND user_id IS NOT NULL");
                if(mysql(c)) s.execute("ALTER TABLE aep_wallets MODIFY COLUMN account_key VARCHAR(512) NOT NULL");
                else s.execute("ALTER TABLE aep_wallets ALTER COLUMN account_key SET NOT NULL");
            }
            nullable(c,"aep_wallets","user_id");
            index(c,"aep_wallets","uk_wallet_account_key","account_key",true);
        }
        for(String t:List.of("aep_credit_holds","aep_ledger_entries")) if(table(c,t)) {
            if(t.equals("aep_credit_holds")) nullable(c,t,"user_id");
            for(String col:List.of("actor_user_id","enterprise_id","membership_id")) add(c,t,col,"VARCHAR(64) NULL");
            add(c,t,"billing_authorization_id","VARCHAR(128) NULL");
        }
        if(table(c,"aep_ledger_entries")) try(var s=c.createStatement()) {
            // New transfer types must fit existing MySQL/H2 native ENUM columns before Hibernate validation.
            s.execute("ALTER TABLE aep_ledger_entries MODIFY COLUMN entry_type VARCHAR(32)");
        }
        for(String t:List.of("ip_run","material_video_job")) if(table(c,t)) {
            for(String col:List.of("billing_wallet_id","enterprise_id","membership_id")) add(c,t,col,"VARCHAR(64) NULL");
            add(c,t,"billing_authorization_id","VARCHAR(128) NULL");
        }
        if(table(c,"recharge_order")) {
            add(c,"recharge_order","target_wallet_id","VARCHAR(64) NULL");
            add(c,"recharge_order","enterprise_id","VARCHAR(64) NULL");
            add(c,"recharge_order","receipt_reference","VARCHAR(256) NULL");
        }
        index(c,"aep_enterprise_members","idx_enterprise_members","enterprise_id,joined_at",false);
        index(c,"aep_enterprise_audit","idx_enterprise_audit","enterprise_id,created_at",false);
    }
    private static boolean mysql(Connection c)throws SQLException{return c.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT).contains("mysql");}
    private static boolean table(Connection c,String table)throws SQLException {
        for(String n:List.of(table,table.toUpperCase(Locale.ROOT)))try(var r=c.getMetaData().getTables(c.getCatalog(),null,n,new String[]{"TABLE"})){if(r.next())return true;}return false;
    }
    private static boolean column(Connection c,String t,String col)throws SQLException {
        for(String n:List.of(t,t.toUpperCase(Locale.ROOT)))try(var r=c.getMetaData().getColumns(c.getCatalog(),null,n,null)){while(r.next())if(col.equalsIgnoreCase(r.getString("COLUMN_NAME")))return true;}return false;
    }
    private static void add(Connection c,String t,String col,String type)throws SQLException {
        if(!column(c,t,col))try(var s=c.createStatement()){s.execute("ALTER TABLE "+t+" ADD COLUMN "+col+" "+type);}
    }
    private static void nullable(Connection c,String t,String col)throws SQLException {
        int length=255;
        for(String n:List.of(t,t.toUpperCase(Locale.ROOT)))try(var r=c.getMetaData().getColumns(c.getCatalog(),null,n,null)){while(r.next())if(col.equalsIgnoreCase(r.getString("COLUMN_NAME")))length=r.getInt("COLUMN_SIZE");}
        try(var s=c.createStatement()){s.execute(mysql(c)?"ALTER TABLE "+t+" MODIFY COLUMN "+col+" VARCHAR("+length+") NULL":"ALTER TABLE "+t+" ALTER COLUMN "+col+" DROP NOT NULL");}
    }
    private static void index(Connection c,String t,String name,String columns,boolean unique)throws SQLException {
        for(String n:List.of(t,t.toUpperCase(Locale.ROOT)))try(var r=c.getMetaData().getIndexInfo(c.getCatalog(),null,n,false,false)){while(r.next())if(name.equalsIgnoreCase(r.getString("INDEX_NAME")))return;}
        try(var s=c.createStatement()){s.execute("CREATE "+(unique?"UNIQUE ":"")+"INDEX "+name+" ON "+t+"("+columns+")");}
    }
    private static final List<String> TABLES=List.of(
        "CREATE TABLE IF NOT EXISTS aep_enterprises (id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL, owner_user_id VARCHAR(64) NOT NULL, status VARCHAR(16) NOT NULL, create_request_id VARCHAR(64) NOT NULL, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, created_by VARCHAR(64) NOT NULL, CONSTRAINT uk_enterprise_create UNIQUE(created_by,create_request_id))",
        "CREATE TABLE IF NOT EXISTS aep_enterprise_members (id VARCHAR(64) PRIMARY KEY, enterprise_id VARCHAR(64) NOT NULL, user_id VARCHAR(64) NOT NULL, role VARCHAR(16) NOT NULL, status VARCHAR(16) NOT NULL, points_manage BOOLEAN NOT NULL DEFAULT FALSE, billing_read BOOLEAN NOT NULL DEFAULT FALSE, recharge_request BOOLEAN NOT NULL DEFAULT FALSE, version BIGINT NOT NULL DEFAULT 0, joined_at TIMESTAMP(6) NOT NULL)",
        "CREATE TABLE IF NOT EXISTS aep_enterprise_current (user_id VARCHAR(64) PRIMARY KEY, enterprise_id VARCHAR(64) NOT NULL, member_id VARCHAR(64) NOT NULL UNIQUE)",
        "CREATE TABLE IF NOT EXISTS aep_enterprise_invitations (id VARCHAR(64) PRIMARY KEY, enterprise_id VARCHAR(64) NOT NULL, created_by VARCHAR(64) NOT NULL, client_request_id VARCHAR(64) NOT NULL, token_hash VARCHAR(64) NOT NULL UNIQUE, status VARCHAR(16) NOT NULL, accepted_by VARCHAR(64) NULL, expires_at TIMESTAMP(6) NOT NULL, created_at TIMESTAMP(6) NOT NULL, CONSTRAINT uk_enterprise_invite_request UNIQUE(enterprise_id,created_by,client_request_id))",
        "CREATE TABLE IF NOT EXISTS aep_enterprise_policies (enterprise_id VARCHAR(64) PRIMARY KEY, allowed_endpoint_ids_json LONGTEXT NOT NULL, max_active_jobs INT NOT NULL DEFAULT 0, version BIGINT NOT NULL DEFAULT 0)",
        "CREATE TABLE IF NOT EXISTS aep_enterprise_ownership_transfers (id VARCHAR(64) PRIMARY KEY, enterprise_id VARCHAR(64) NOT NULL, from_user_id VARCHAR(64) NOT NULL, from_owner_version BIGINT NOT NULL DEFAULT 0, to_user_id VARCHAR(64) NOT NULL, client_request_id VARCHAR(64) NOT NULL, status VARCHAR(16) NOT NULL, expires_at TIMESTAMP(6) NOT NULL, CONSTRAINT uk_enterprise_transfer_request UNIQUE(enterprise_id,from_user_id,client_request_id))",
        "CREATE TABLE IF NOT EXISTS aep_enterprise_audit (id VARCHAR(64) PRIMARY KEY, enterprise_id VARCHAR(64) NOT NULL, actor_user_id VARCHAR(64) NOT NULL, action VARCHAR(64) NOT NULL, target_id VARCHAR(64) NOT NULL, summary LONGTEXT NOT NULL, created_at TIMESTAMP(6) NOT NULL)",
        "CREATE TABLE IF NOT EXISTS aep_enterprise_points_batches (id VARCHAR(64) PRIMARY KEY, enterprise_id VARCHAR(64) NOT NULL, actor_user_id VARCHAR(64) NOT NULL, client_request_id VARCHAR(64) NOT NULL, direction VARCHAR(16) NOT NULL, fingerprint VARCHAR(64) NOT NULL, total_amount BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMP(6) NOT NULL, CONSTRAINT uk_enterprise_batch_request UNIQUE(enterprise_id,client_request_id))",
        "CREATE TABLE IF NOT EXISTS aep_enterprise_points_transfers (id VARCHAR(64) PRIMARY KEY, batch_id VARCHAR(64) NOT NULL, member_id VARCHAR(64) NOT NULL, from_wallet_id VARCHAR(64) NOT NULL, to_wallet_id VARCHAR(64) NOT NULL, amount BIGINT NOT NULL DEFAULT 0, from_gift BIGINT NOT NULL DEFAULT 0, from_license BIGINT NOT NULL DEFAULT 0, from_recharge BIGINT NOT NULL DEFAULT 0, out_ledger_id VARCHAR(64) NOT NULL, in_ledger_id VARCHAR(64) NOT NULL)");
}
