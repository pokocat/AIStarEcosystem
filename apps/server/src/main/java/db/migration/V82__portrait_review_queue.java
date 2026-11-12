package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

public class V82__portrait_review_queue extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        boolean hasLibrary = false;
        try (var columns = connection.getMetaData().getColumns(connection.getCatalog(), null, "%", "%")) {
            while (columns.next()) {
                if ("video_asset_library".equalsIgnoreCase(columns.getString("TABLE_NAME"))) {
                    hasLibrary = true;
                    break;
                }
            }
        }
        try (var sql = connection.createStatement()) {
            // On an empty development database Hibernate creates the library after Flyway.
            if (hasLibrary) sql.execute("ALTER TABLE video_asset_library ADD COLUMN portrait_upload_after TIMESTAMP(6) NULL");
            sql.execute("ALTER TABLE video_asset_portrait ADD COLUMN review_after TIMESTAMP(6) NULL");
            sql.execute("CREATE INDEX idx_video_portrait_dispatch ON video_asset_portrait (library_id, status, declared_at, id)");
            sql.execute("CREATE INDEX idx_video_portrait_review ON video_asset_portrait (status, review_after, updated_at, id)");
        }
    }
}
