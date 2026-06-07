package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * 给一级视频库三类来源补齐软删列。Java migration 兼容空库首次启动：
 * Flyway 早于 Hibernate 跑，表不存在或列/索引已存在时跳过即可。
 */
public class V7__add_video_library_deleted_at extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V7__add_video_library_deleted_at.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            addColumn(st, "celebrity_project_videos", "deleted_at");
            addIndex(st, "idx_celebrity_project_videos_deleted_at", "celebrity_project_videos", "deleted_at");

            addColumn(st, "material_videos", "deleted_at");
            addIndex(st, "idx_material_videos_deleted_at", "material_videos", "deleted_at");

            addColumn(st, "mixcut_render_output", "deleted_at");
            addIndex(st, "idx_mixcut_render_output_deleted_at", "mixcut_render_output", "deleted_at");
        }
    }

    private static void addColumn(Statement st, String table, String column) {
        try {
            st.executeUpdate("ALTER TABLE " + table + " ADD COLUMN " + column + " TIMESTAMP NULL");
            log.info("[V7-video-soft-delete] added {}.{}", table, column);
        } catch (Exception e) {
            log.debug("[V7-video-soft-delete] skip {}.{}: {}", table, column, e.getMessage());
        }
    }

    private static void addIndex(Statement st, String index, String table, String column) {
        try {
            st.executeUpdate("CREATE INDEX " + index + " ON " + table + " (" + column + ")");
            log.info("[V7-video-soft-delete] added {}", index);
        } catch (Exception e) {
            log.debug("[V7-video-soft-delete] skip {}: {}", index, e.getMessage());
        }
    }
}
