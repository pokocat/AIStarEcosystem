package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Locale;

/**
 * v0.51：删除 v0.45 遗留的 AiAvatar 形象资产管理中心领域表（aiavatar_*，及更早的 dh_* 残留）。
 *
 * 背景：v0.45 的 server-backed 桌面 AiAvatar 中心从未被任何前端消费；v0.50 落地的
 * apps/web-aiavatar「数字人资产平台」是另一套数据模型（v0.51 起由全新 dap_* 表 +
 * /api/v1/** REST 面承接）。经用户确认，旧域代码与表一并删除。
 *
 * 该迁移幂等：表不存在时静默跳过（全新库 / H2 dev 均安全）。
 */
public class V8__drop_legacy_aiavatar_tables extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V8__drop_legacy_aiavatar_tables.class);

    private static final String[] TABLES = {
            // 子表在前（避免潜在外键依赖；当前领域无显式 FK，纯保险顺序）
            "aiavatar_refine_edit",
            "aiavatar_job",
            "aiavatar_asset",
            "aiavatar_avatar_version",
            "aiavatar_source_material",
            "aiavatar_license_grant",
            "aiavatar_template",
            "aiavatar_avatar",
            // v0.45 之前的 dh_* 命名残留（V5 未重命名成功的环境）
            "dh_refine_edit", "dh_job", "dh_asset", "dh_avatar_version",
            "dh_source_material", "dh_license_grant", "dh_template", "dh_avatar"
    };

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        for (String table : TABLES) {
            dropIfExists(connection, table);
        }
    }

    private void dropIfExists(Connection connection, String tableName) throws Exception {
        if (!tableExists(connection, tableName)) {
            return;
        }
        try (Statement st = connection.createStatement()) {
            st.executeUpdate("DROP TABLE " + tableName);
            log.info("[V8-drop-legacy-aiavatar] dropped {}", tableName);
        } catch (Exception e) {
            // 不阻断启动：孤儿表留着无害，记 WARN 供人工处理
            log.warn("[V8-drop-legacy-aiavatar] drop {} failed: {}", tableName, e.getMessage());
        }
    }

    private boolean tableExists(Connection connection, String tableName) throws Exception {
        DatabaseMetaData meta = connection.getMetaData();
        String[] candidates = {tableName, tableName.toUpperCase(Locale.ROOT)};
        for (String candidate : candidates) {
            try (ResultSet rs = meta.getTables(connection.getCatalog(), null, candidate, new String[]{"TABLE"})) {
                if (rs.next()) return true;
            }
            try (ResultSet rs = meta.getTables(null, null, candidate, new String[]{"TABLE"})) {
                if (rs.next()) return true;
            }
        }
        return false;
    }
}
