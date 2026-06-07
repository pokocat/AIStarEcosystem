package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * 给 mixcut_asset 补软删除列。Java migration 兼容空库首次启动：
 * Flyway 早于 Hibernate 跑，表不存在或列/索引已存在时跳过即可。
 */
public class V6__add_mixcut_asset_deleted_at extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V6__add_mixcut_asset_deleted_at.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            try {
                st.executeUpdate("ALTER TABLE mixcut_asset ADD COLUMN deleted_at TIMESTAMP NULL");
                log.info("[V6-mixcut-asset-delete] added mixcut_asset.deleted_at");
            } catch (Exception e) {
                log.debug("[V6-mixcut-asset-delete] skip mixcut_asset.deleted_at: {}", e.getMessage());
            }

            try {
                st.executeUpdate("CREATE INDEX idx_mixcut_asset_deleted_at ON mixcut_asset (deleted_at)");
                log.info("[V6-mixcut-asset-delete] added idx_mixcut_asset_deleted_at");
            } catch (Exception e) {
                log.debug("[V6-mixcut-asset-delete] skip idx_mixcut_asset_deleted_at: {}", e.getMessage());
            }
        }
    }
}
