package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;

/**
 * 模型用量记录记下是哪个任务发起的调用（IpRun / DapJob 的 id），账号「任务历史」据此给文字任务打开「查看原文」。
 * 旧记录没有任务编号，仍可在任务历史的「全部原文」里查看。
 *
 * <p>ai_model_usage_record 由 Hibernate 按实体建表（V10/V12 也是 Java 迁移、先判断再改）：空库跑迁移时表还不存在，
 * 直接跳过，之后 Hibernate 按实体建出带 task_id 的表。2026-11-10 首版写成 SQL 迁移，CI 的空库迁移链因此失败。
 */
public class V80__ai_usage_task_id extends BaseJavaMigration {
    private static final String TABLE = "ai_model_usage_record";

    @Override public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        if (!tableExists(c)) return;
        try (var s = c.createStatement()) {
            if (!columnExists(c, "task_id")) s.execute("ALTER TABLE " + TABLE + " ADD COLUMN task_id VARCHAR(64) NULL");
            if (!indexExists(c, "idx_aiusage_task")) s.execute("CREATE INDEX idx_aiusage_task ON " + TABLE + " (task_id)");
        }
    }

    private static boolean tableExists(Connection c) throws Exception {
        try (var r = c.getMetaData().getTables(c.getCatalog(), null, "%", new String[]{"TABLE"})) {
            while (r.next()) if (TABLE.equalsIgnoreCase(r.getString("TABLE_NAME"))) return true;
        }
        return false;
    }

    private static boolean columnExists(Connection c, String column) throws Exception {
        try (var r = c.getMetaData().getColumns(c.getCatalog(), null, "%", "%")) {
            while (r.next()) if (TABLE.equalsIgnoreCase(r.getString("TABLE_NAME")) && column.equalsIgnoreCase(r.getString("COLUMN_NAME"))) return true;
        }
        return false;
    }

    private static boolean indexExists(Connection c, String index) throws Exception {
        for (String name : new String[]{TABLE, TABLE.toUpperCase()}) {
            try (var r = c.getMetaData().getIndexInfo(c.getCatalog(), null, name, false, true)) {
                while (r.next()) if (index.equalsIgnoreCase(r.getString("INDEX_NAME"))) return true;
            }
        }
        return false;
    }
}
