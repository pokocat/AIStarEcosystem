package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Video contracts live on fixed model endpoints; existing values are configured separately. */
public class V55__video_endpoint_request_specs extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        try (var statement = context.getConnection().createStatement()) {
            statement.executeUpdate("ALTER TABLE ai_model_providers ADD COLUMN video_request_spec_json LONGTEXT NULL");
            statement.executeUpdate("ALTER TABLE material_video_job ADD COLUMN upstream_base_url_snapshot VARCHAR(2000) NULL");
            statement.executeUpdate("ALTER TABLE material_video_job ADD COLUMN video_request_spec_snapshot_json LONGTEXT NULL");
        }
    }
}
