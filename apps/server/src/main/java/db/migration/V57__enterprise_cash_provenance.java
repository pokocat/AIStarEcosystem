package db.migration;

import org.flywaydb.core.api.migration.*;
import java.sql.*;
import java.util.*;

/** Enterprise manual cash snapshots and original-order provenance; existing personal rows are preserved. */
public class V57__enterprise_cash_provenance extends BaseJavaMigration {
    @Override public void migrate(Context context)throws Exception {
        Connection c=context.getConnection();
        for(String ddl:List.of(
            "CREATE TABLE IF NOT EXISTS aep_enterprise_credit_lots (id VARCHAR(64) PRIMARY KEY,enterprise_id VARCHAR(64) NOT NULL,recharge_order_id VARCHAR(64) NOT NULL,wallet_id VARCHAR(64) NOT NULL,available BIGINT NOT NULL DEFAULT 0,frozen BIGINT NOT NULL DEFAULT 0,created_at TIMESTAMP(6) NOT NULL,CONSTRAINT uk_enterprise_credit_lot UNIQUE(recharge_order_id,wallet_id))",
            "CREATE TABLE IF NOT EXISTS aep_enterprise_credit_lot_holds (id VARCHAR(64) PRIMARY KEY,hold_id VARCHAR(64) NOT NULL,lot_id VARCHAR(64) NOT NULL,original_amount BIGINT NOT NULL DEFAULT 0,frozen BIGINT NOT NULL DEFAULT 0,CONSTRAINT uk_enterprise_lot_hold UNIQUE(hold_id,lot_id))",
            "CREATE TABLE IF NOT EXISTS aep_enterprise_cash_receipts (id VARCHAR(72) PRIMARY KEY,order_id VARCHAR(64) NOT NULL,direction VARCHAR(16) NOT NULL,receipt_reference VARCHAR(256) NOT NULL,created_at TIMESTAMP(6) NOT NULL)"))try(var s=c.createStatement()){s.execute(ddl);}
        if(table(c,"recharge_order")) {
            add(c,"enterprise_name","VARCHAR(128) NULL");
            for(String field:List.of("enterprise_request_id","enterprise_request_fingerprint","confirm_request_id","confirm_fingerprint","refund_request_id","refund_fingerprint"))add(c,field,"VARCHAR(64) NULL");
            for(String field:List.of("requested_price_cents","refunded_price_cents"))add(c,field,"BIGINT NOT NULL DEFAULT 0");
            add(c,"refund_receipt_reference","VARCHAR(256) NULL");
            index(c,"recharge_order","uk_enterprise_recharge_request","enterprise_id,enterprise_request_id",true);
            index(c,"recharge_order","idx_enterprise_recharge_list","enterprise_id,created_at",false);
        }
        index(c,"aep_enterprise_credit_lots","idx_enterprise_lot_wallet","wallet_id,created_at,id",false);
        if(table(c,"aep_wallets")&&column(c,"aep_wallets","enterprise_id"))index(c,"aep_wallets","idx_wallet_enterprise","enterprise_id,id",false);
    }
    private static boolean table(Connection c,String name)throws SQLException {for(String n:List.of(name,name.toUpperCase(Locale.ROOT)))try(var r=c.getMetaData().getTables(c.getCatalog(),null,n,new String[]{"TABLE"})){if(r.next())return true;}return false;}
    private static boolean column(Connection c,String table,String field)throws SQLException {for(String name:List.of(table,table.toUpperCase(Locale.ROOT)))try(var r=c.getMetaData().getColumns(c.getCatalog(),null,name,null)){while(r.next())if(field.equalsIgnoreCase(r.getString("COLUMN_NAME")))return true;}return false;}
    private static void add(Connection c,String field,String type)throws SQLException {
        for(String name:List.of("recharge_order","RECHARGE_ORDER"))try(var r=c.getMetaData().getColumns(c.getCatalog(),null,name,null)){while(r.next())if(field.equalsIgnoreCase(r.getString("COLUMN_NAME")))return;}
        try(var s=c.createStatement()){s.execute("ALTER TABLE recharge_order ADD COLUMN "+field+" "+type);}
    }
    private static void index(Connection c,String table,String name,String fields,boolean unique)throws SQLException {
        for(String n:List.of(table,table.toUpperCase(Locale.ROOT)))try(var r=c.getMetaData().getIndexInfo(c.getCatalog(),null,n,false,false)){while(r.next())if(name.equalsIgnoreCase(r.getString("INDEX_NAME")))return;}
        try(var s=c.createStatement()){s.execute("CREATE "+(unique?"UNIQUE ":"")+"INDEX "+name+" ON "+table+"("+fields+")");}
    }
}
