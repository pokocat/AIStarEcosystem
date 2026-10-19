package db.migration;

import org.flywaydb.core.api.migration.*;
import java.sql.*;
import java.util.*;

/** Durable payer authorization and lifecycle receipts; does not change any historical money. */
public class V58__enterprise_billing_lifecycle extends BaseJavaMigration {
    @Override public void migrate(Context context)throws Exception {
        var c=context.getConnection();
        for(String sql:List.of(
            "CREATE TABLE IF NOT EXISTS aep_enterprise_billing_authorizations (id VARCHAR(64) PRIMARY KEY,enterprise_id VARCHAR(64) NOT NULL,actor_user_id VARCHAR(64) NOT NULL,membership_id VARCHAR(64) NOT NULL,wallet_id VARCHAR(64) NOT NULL,reference_type VARCHAR(64) NOT NULL,reference_id VARCHAR(128) NOT NULL,endpoint_id VARCHAR(64) NULL,amount BIGINT NOT NULL DEFAULT 0,status VARCHAR(24) NOT NULL,created_at TIMESTAMP(6) NOT NULL,updated_at TIMESTAMP(6) NOT NULL,dispatched_at TIMESTAMP(6) NULL,terminal_at TIMESTAMP(6) NULL,CONSTRAINT uk_enterprise_billing_ref UNIQUE(reference_type,reference_id))",
            "CREATE TABLE IF NOT EXISTS aep_enterprise_lifecycle_operations (id VARCHAR(64) PRIMARY KEY,enterprise_id VARCHAR(64) NOT NULL,actor_user_id VARCHAR(64) NOT NULL,client_request_id VARCHAR(64) NOT NULL,fingerprint VARCHAR(64) NOT NULL,result_json LONGTEXT NOT NULL,created_at TIMESTAMP(6) NOT NULL,CONSTRAINT uk_enterprise_lifecycle_request UNIQUE(enterprise_id,client_request_id))"))
            try(var s=c.createStatement()){s.execute(sql);}
        index(c,"aep_enterprise_billing_authorizations","idx_enterprise_billing_member","enterprise_id,membership_id,terminal_at");
        index(c,"aep_enterprise_billing_authorizations","idx_enterprise_billing_wallet","wallet_id");
        if(!column(c,"aep_enterprise_billing_authorizations","revoked_at"))try(var s=c.createStatement()){s.execute("ALTER TABLE aep_enterprise_billing_authorizations ADD COLUMN revoked_at TIMESTAMP(6) NULL");}
        if(table(c,"aep_enterprise_credit_lot_holds")&&!column(c,"aep_enterprise_credit_lot_holds","released_amount"))
            try(var s=c.createStatement()){s.execute("ALTER TABLE aep_enterprise_credit_lot_holds ADD COLUMN released_amount BIGINT NOT NULL DEFAULT 0");}
    }
    private static boolean table(Connection c,String t)throws SQLException {for(String n:List.of(t,t.toUpperCase(Locale.ROOT)))try(var r=c.getMetaData().getTables(c.getCatalog(),null,n,new String[]{"TABLE"})){if(r.next())return true;}return false;}
    private static boolean column(Connection c,String t,String col)throws SQLException {for(String n:List.of(t,t.toUpperCase(Locale.ROOT)))try(var r=c.getMetaData().getColumns(c.getCatalog(),null,n,null)){while(r.next())if(col.equalsIgnoreCase(r.getString("COLUMN_NAME")))return true;}return false;}
    private static void index(Connection c,String t,String name,String fields)throws SQLException {for(String n:List.of(t,t.toUpperCase(Locale.ROOT)))try(var r=c.getMetaData().getIndexInfo(c.getCatalog(),null,n,false,false)){while(r.next())if(name.equalsIgnoreCase(r.getString("INDEX_NAME")))return;}try(var s=c.createStatement()){s.execute("CREATE INDEX "+name+" ON "+t+"("+fields+")");}}
}
