package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.sql.Connection;

/**
 * A member's default payer (2026-11-02) moves from one browser's storage to the membership, so a choice made once
 * stops the payer prompt on every device and in every paid feature. Null keeps asking.
 */
public class V74__enterprise_member_billing_default extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        // A fresh schema gets the table with this column from Hibernate after Flyway.
        if(!exists(c,"aep_enterprise_members")||hasColumn(c,"aep_enterprise_members","billing_default"))return;
        try(var s=c.createStatement()) {
            s.execute("ALTER TABLE aep_enterprise_members ADD COLUMN billing_default VARCHAR(16) NULL");
        }
    }

    private static boolean exists(Connection c,String table)throws Exception {
        try(var r=c.getMetaData().getTables(c.getCatalog(),null,"%",new String[]{"TABLE"})) {
            while(r.next())if(table.equalsIgnoreCase(r.getString("TABLE_NAME")))return true;
        }
        return false;
    }

    private static boolean hasColumn(Connection c,String table,String column)throws Exception {
        try(var r=c.getMetaData().getColumns(c.getCatalog(),null,"%","%")) {
            while(r.next())if(table.equalsIgnoreCase(r.getString("TABLE_NAME"))&&column.equalsIgnoreCase(r.getString("COLUMN_NAME")))return true;
        }
        return false;
    }
}
