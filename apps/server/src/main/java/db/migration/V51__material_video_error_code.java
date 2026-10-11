package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Keep normalized video failure codes separate from user-facing messages. */
public class V51__material_video_error_code extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        var metadata = connection.getMetaData();
        String table = V24__aep_user_identity_uid.resolveTableName(metadata, "material_video_job");
        if (table == null || V24__aep_user_identity_uid.columnExists(metadata, table, "error_code")) return;
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("ALTER TABLE " + table + " ADD COLUMN error_code VARCHAR(64) NULL");
        }
    }
}
