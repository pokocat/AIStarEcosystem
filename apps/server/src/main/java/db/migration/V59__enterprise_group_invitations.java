package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.util.List;

/** Replaces unused one-use invitations with clean group links. No member, account or money changes. */
public class V59__enterprise_group_invitations extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        boolean oldColumn=false;
        for(String table: List.of("aep_enterprise_invitations","AEP_ENTERPRISE_INVITATIONS")) {
            try(var columns=c.getMetaData().getColumns(c.getCatalog(),null,table,null)) {
                while(columns.next()) if("accepted_by".equalsIgnoreCase(columns.getString("COLUMN_NAME"))) oldColumn=true;
            }
        }
        if(!oldColumn)return;
        try(var statement=c.createStatement()) {
            statement.execute("DELETE FROM aep_enterprise_invitations");
            statement.execute("ALTER TABLE aep_enterprise_invitations DROP COLUMN accepted_by");
        }
    }
}
