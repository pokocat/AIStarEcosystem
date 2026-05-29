package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * 给素材脚本补软删除列。用 Java migration 兼容空库首次启动：
 * Flyway 早于 Hibernate 跑，表不存在或列已存在时跳过即可。
 */
public class V4__add_material_script_deleted_at extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V4__add_material_script_deleted_at.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            try {
                st.executeUpdate("ALTER TABLE material_scripts ADD COLUMN deleted_at TIMESTAMP NULL");
                log.info("[V4-material-script-delete] added material_scripts.deleted_at");
            } catch (Exception e) {
                log.debug("[V4-material-script-delete] skip material_scripts.deleted_at: {}", e.getMessage());
            }
        }
    }
}
