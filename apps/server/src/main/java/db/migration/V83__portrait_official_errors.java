package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

public class V83__portrait_official_errors extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (var statement = context.getConnection().createStatement()) {
            statement.execute("ALTER TABLE video_asset_portrait ADD COLUMN ark_error TEXT NULL");
            statement.execute("ALTER TABLE video_asset_person ADD COLUMN ark_error TEXT NULL");
        }
    }
}
