package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * 给 celebrity_stars 补软删列，避免运营删除默认明星后被物理删除/seed 数据带回。
 * Java migration 兼容空库首次启动：表不存在或列/索引已存在时跳过即可。
 */
public class V9__add_celebrity_star_deleted_at extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V9__add_celebrity_star_deleted_at.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            try {
                st.executeUpdate("ALTER TABLE celebrity_stars ADD COLUMN deleted_at TIMESTAMP NULL");
                log.info("[V9-celebrity-star-delete] added celebrity_stars.deleted_at");
            } catch (Exception e) {
                log.debug("[V9-celebrity-star-delete] skip celebrity_stars.deleted_at: {}", e.getMessage());
            }

            try {
                st.executeUpdate("CREATE INDEX idx_celebrity_stars_deleted_at ON celebrity_stars (deleted_at)");
                log.info("[V9-celebrity-star-delete] added idx_celebrity_stars_deleted_at");
            } catch (Exception e) {
                log.debug("[V9-celebrity-star-delete] skip idx_celebrity_stars_deleted_at: {}", e.getMessage());
            }
        }
    }
}
