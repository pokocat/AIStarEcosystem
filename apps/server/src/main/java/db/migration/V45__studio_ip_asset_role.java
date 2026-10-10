package db.migration;

import org.flywaydb.core.api.migration.*;

/** Preserve existing look source and media; only add optional library classification. */
public class V45__studio_ip_asset_role extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();String table=null;
        try(var rows=c.getMetaData().getTables(c.getCatalog(),null,"%",new String[]{"TABLE"})) {
            while(rows.next())if("dap_look".equalsIgnoreCase(rows.getString("TABLE_NAME")))table=rows.getString("TABLE_NAME");
        }
        if(table==null)return;
        try(var rows=c.getMetaData().getColumns(c.getCatalog(),null,table,"%")) {
            while(rows.next())if("asset_role".equalsIgnoreCase(rows.getString("COLUMN_NAME")))return;
        }
        try(var s=c.createStatement()){s.executeUpdate("ALTER TABLE "+table+" ADD COLUMN asset_role VARCHAR(24)");}
    }
}
