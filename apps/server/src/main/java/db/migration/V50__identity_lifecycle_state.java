package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Additive identity lifecycle state; product suspension remains independent. */
public class V50__identity_lifecycle_state extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var conn = context.getConnection();
        var md = conn.getMetaData();
        String table = V24__aep_user_identity_uid.resolveTableName(md, "aep_users");
        if (table == null) return;
        String[][] columns = {{"identity_state", "VARCHAR(20) NULL"}, {"identity_state_event_id", "BIGINT NULL"}, {"identity_tokens_valid_after", "TIMESTAMP(6) NULL"}};
        try (var statement = conn.createStatement()) {
            for (String[] column : columns) {
                if (!V24__aep_user_identity_uid.columnExists(md, table, column[0]))
                    statement.executeUpdate("ALTER TABLE " + table + " ADD COLUMN " + column[0] + " " + column[1]);
            }
        }
    }
}
