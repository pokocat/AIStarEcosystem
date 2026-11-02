package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.sql.Connection;

/**
 * Enterprise credits could never be used in the Studio canvas (2026-11-02): every enterprise kept the policy it was
 * created with (no allowed model, one task in flight per member) and nobody ever edited it. An empty model list now
 * means all models (EnterpriseBillingService.requireAllowed), so only the in-flight limit moves here: one stopped
 * canvas plans at their second step. Only policies still at their creation values (version 0) change; an owner's own
 * setting stays. The version bump makes a settings form opened before this change ask for a refresh.
 */
public class V73__enterprise_policy_defaults extends BaseJavaMigration {
    static final int MAX_ACTIVE_JOBS=10;

    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        // A fresh schema gets the table (and the new default) from Hibernate after Flyway.
        if(!exists(c,"aep_enterprise_policies"))return;
        try(var s=c.prepareStatement("UPDATE aep_enterprise_policies SET max_active_jobs=?, version=version+1 WHERE version=0 AND max_active_jobs=1")) {
            s.setInt(1,MAX_ACTIVE_JOBS);s.executeUpdate();
        }
    }

    private static boolean exists(Connection c,String table)throws Exception {
        try(var r=c.getMetaData().getTables(c.getCatalog(),null,"%",new String[]{"TABLE"})) {
            while(r.next())if(table.equalsIgnoreCase(r.getString("TABLE_NAME")))return true;
        }
        return false;
    }
}
