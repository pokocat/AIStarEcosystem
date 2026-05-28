package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * v0.34.x：Notification.read (boolean) → Notification.viewedAt (Instant) 模型升级。
 *
 *   viewed_at IS NULL    → 未读
 *   viewed_at IS NOT NULL → 已读 + 何时被读（事件模型替代贫血 boolean）
 *
 * <h2>为什么是 Java migration 不是 SQL</h2>
 *
 * Spring Boot 默认让 Flyway **早于** Hibernate ddl-auto 跑。首启空库时，
 * {@code aep_notifications} 表尚未存在，纯 SQL 版本的 V2 用：
 *
 * <pre>{@code
 *   ALTER TABLE aep_notifications ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP NULL;
 * }</pre>
 *
 * 会因「表不存在」直接抛 SQLException —— {@code IF NOT EXISTS} 只检查列存在性，
 * 不检查表存在性。失败记录写入 {@code flyway_schema_history}，下次启动 Flyway
 * 校验历史时拒绝继续。
 *
 * 改用 Java migration 通过 JDBC {@link DatabaseMetaData} 先查表 / 列是否存在，
 * 跨方言（MySQL / MariaDB / H2）正确处理三种实际场景：
 *
 * <ol>
 *   <li>首启空库（表不存在）→ 整段跳过，等 Hibernate ddl-auto 按新 entity 建好</li>
 *   <li>老库 read 列存在 / viewed_at 列不存在 → ADD viewed_at + DROP read</li>
 *   <li>已迁移完的库（read 不存在，viewed_at 存在）→ 整段是 no-op</li>
 * </ol>
 *
 * <h2>数据迁移取舍</h2>
 *
 * 显式不做 read=true → viewed_at=created_at 的数据迁移：
 *
 * <ul>
 *   <li>生产层 read 列从未成功建出（Hibernate 撞保留字 DDL 失败）</li>
 *   <li>dev / 测试数据无审计价值</li>
 *   <li>「全部重置为未读」语义上对用户无影响（红点会重新显示，用户再点一次即可）</li>
 * </ul>
 */
public class V2__notification_use_viewed_at_instead_of_read extends BaseJavaMigration {

    private static final String TABLE = "aep_notifications";
    private static final String OLD_COLUMN = "read";
    private static final String NEW_COLUMN = "viewed_at";

    @Override
    public void migrate(Context context) throws Exception {
        Connection conn = context.getConnection();
        DatabaseMetaData md = conn.getMetaData();

        // 1) 表不存在：首启空库，跳过整个 migration（Hibernate ddl-auto 会按新 entity 建表）
        if (!tableExists(md, conn)) {
            return;
        }

        boolean hasOld = columnExists(md, conn, OLD_COLUMN);
        boolean hasNew = columnExists(md, conn, NEW_COLUMN);

        // 2) 新列不存在 → ADD（注意：旧库 read 列上有数据时，新列默认 NULL = 未读，可接受）
        if (!hasNew) {
            try (Statement st = conn.createStatement()) {
                st.execute("ALTER TABLE " + TABLE + " ADD COLUMN " + NEW_COLUMN + " TIMESTAMP NULL");
            }
        }

        // 3) 旧列存在 → DROP（方言适配：MySQL/MariaDB 用反引号，H2/Postgres 用双引号）
        if (hasOld) {
            String quotedOld = quoteIdentifier(md, OLD_COLUMN);
            try (Statement st = conn.createStatement()) {
                st.execute("ALTER TABLE " + TABLE + " DROP COLUMN " + quotedOld);
            }
        }
    }

    private boolean tableExists(DatabaseMetaData md, Connection conn) throws Exception {
        // 用当前 schema/catalog 限定，避免误命中其它库的同名表
        String catalog = conn.getCatalog();
        try (ResultSet rs = md.getTables(catalog, null, TABLE, new String[]{"TABLE"})) {
            if (rs.next()) return true;
        }
        // 部分驱动对大小写敏感，再试一次大写
        try (ResultSet rs = md.getTables(catalog, null, TABLE.toUpperCase(), new String[]{"TABLE"})) {
            return rs.next();
        }
    }

    private boolean columnExists(DatabaseMetaData md, Connection conn, String column) throws Exception {
        String catalog = conn.getCatalog();
        try (ResultSet rs = md.getColumns(catalog, null, TABLE, column)) {
            if (rs.next()) return true;
        }
        try (ResultSet rs = md.getColumns(catalog, null, TABLE.toUpperCase(), column.toUpperCase())) {
            return rs.next();
        }
    }

    /** 返回 DB 方言对应的 identifier 引用符（MySQL: ``read``, H2/Postgres: "read"）。 */
    private String quoteIdentifier(DatabaseMetaData md, String id) throws Exception {
        String quote = md.getIdentifierQuoteString();
        if (quote == null || " ".equals(quote)) quote = "\"";   // SQL 标准 fallback
        return quote + id + quote;
    }
}
