package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** 首次冻结继续使用裸 jobId；存量行从 0 开始，仅重试生成 :rN。 */
public class V38__publish_retry_count extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        // 全新 dev 库由 Hibernate 建表；已有库只在缺列时执行 DDL，错误必须阻断发布。
        try (var tables = connection.getMetaData().getTables(connection.getCatalog(), null, "%", new String[]{"TABLE"})) {
            while (tables.next()) {
                String table = tables.getString("TABLE_NAME");
                if (!"aep_publish_jobs".equalsIgnoreCase(table)) continue;
                try (var columns = connection.getMetaData().getColumns(connection.getCatalog(), null, table, "%")) {
                    while (columns.next()) {
                        if ("retry_count".equalsIgnoreCase(columns.getString("COLUMN_NAME"))) return;
                    }
                }
                try (var statement = connection.createStatement()) {
                    statement.executeUpdate("ALTER TABLE aep_publish_jobs ADD COLUMN retry_count INT NOT NULL DEFAULT 0");
                }
                return;
            }
        }
    }
}
