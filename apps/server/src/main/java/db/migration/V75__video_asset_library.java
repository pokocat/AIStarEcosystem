package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;

/**
 * 视频素材库统一方案第一步（docs/video-asset-library.md）：素材库单独成表，模型用一列指向它。
 * 线上 OneToken 两条模型原来把配置写在规格 JSON 的 inputAssets 里，这里搬过来并绑定。
 * 规格里的旧字段留着不动：新版读的时候忽略，回滚到旧版还能照常工作。
 */
public class V75__video_asset_library extends BaseJavaMigration {
    private static final String ONETOKEN = "onetoken-main";
    private static final String ONETOKEN_CONFIG = "{\"uploadPath\":\"/api/v3/video/assets\",\"fileField\":\"file\","
            + "\"ref\":\"/ref\",\"status\":\"/status\",\"ready\":[\"Active\"],\"expiresAt\":\"/expires_at\"}";

    @Override public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        // A fresh schema gets these from Hibernate after Flyway, and it has no endpoint to bind yet.
        if (!exists(c, "ai_model_providers")) return;
        try (var s = c.createStatement()) {
            if (!exists(c, "video_asset_library")) s.execute("""
                    CREATE TABLE video_asset_library (
                        id VARCHAR(64) NOT NULL PRIMARY KEY,
                        name VARCHAR(128) NOT NULL,
                        adapter VARCHAR(32) NOT NULL,
                        config_json TEXT NOT NULL,
                        created_at DATETIME(6) NOT NULL,
                        updated_at DATETIME(6) NOT NULL
                    )""");
            if (!hasColumn(c, "ai_model_providers", "asset_library_id"))
                s.execute("ALTER TABLE ai_model_providers ADD COLUMN asset_library_id VARCHAR(64) NULL");
        }
        try (var seed = c.prepareStatement("INSERT INTO video_asset_library (id, name, adapter, config_json, created_at, updated_at) "
                + "SELECT ?, ?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM (SELECT 1 AS one) t "
                + "WHERE NOT EXISTS (SELECT 1 FROM video_asset_library WHERE id = ?)")) {
            seed.setString(1, ONETOKEN);
            seed.setString(2, "OneToken 素材库");
            seed.setString(3, "onetoken");
            seed.setString(4, ONETOKEN_CONFIG);
            seed.setString(5, ONETOKEN);
            seed.executeUpdate();
        }
        try (var bind = c.prepareStatement("UPDATE ai_model_providers SET asset_library_id = ? "
                + "WHERE asset_library_id IS NULL AND video_request_spec_json LIKE '%\"inputAssets\"%'")) {
            bind.setString(1, ONETOKEN);
            bind.executeUpdate();
        }
    }

    private static boolean exists(Connection c, String table) throws Exception {
        try (var r = c.getMetaData().getTables(c.getCatalog(), null, "%", new String[]{"TABLE"})) {
            while (r.next()) if (table.equalsIgnoreCase(r.getString("TABLE_NAME"))) return true;
        }
        return false;
    }

    private static boolean hasColumn(Connection c, String table, String column) throws Exception {
        try (var r = c.getMetaData().getColumns(c.getCatalog(), null, "%", "%")) {
            while (r.next())
                if (table.equalsIgnoreCase(r.getString("TABLE_NAME")) && column.equalsIgnoreCase(r.getString("COLUMN_NAME"))) return true;
        }
        return false;
    }
}
