package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 统一账号中心 P2（v0.149）：{@code aep_users.identity_uid} —— 账号中心全局 uid 的本地映射列。
 *
 * <p>可空 + 唯一索引：旧账号为 NULL（MySQL / H2 唯一索引都允许多个 NULL），首次带账号中心令牌
 * 进入时由 JIT 建档写入；一个 uid 只能对应本产品一条本地档案（docs/unified-identity-plan.md §7 第 2 步）。</p>
 *
 * <p>用 Java migration：{@code aep_users} 是 ddl-auto 建的表，全新 H2 dev 库首启时表还不存在
 * （Flyway 早于 Hibernate 跑），此时整条迁移跳过，由 ddl-auto 按实体建出正确定义
 * （实体上 {@code @Column(unique = true)} 会带上唯一约束）。</p>
 *
 * <p><b>v0.150 修正</b>：此前每条 DDL 各自 {@code try/catch(Exception)} 全吞 —— 「列已存在」和
 * 「磁盘满 / 权限不足 / 语法错」被一视同仁地当成成功，迁移会带着半成品状态标记为已执行。
 * 现在改成先用 JDBC {@link DatabaseMetaData}（H2 / MySQL 通用，不依赖各自的
 * {@code information_schema} 表名差异）判断「表在不在、列在不在、唯一约束有没有」，
 * 只在确实缺失时执行 DDL；DDL 本身的任何异常都向上抛，让迁移失败。</p>
 */
public class V24__aep_user_identity_uid extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V24__aep_user_identity_uid.class);

    public static final String TABLE = "aep_users";
    public static final String COLUMN = "identity_uid";
    public static final String INDEX = "uk_aep_users_identity_uid";

    @Override
    public void migrate(Context context) throws Exception {
        Connection conn = context.getConnection();
        DatabaseMetaData md = conn.getMetaData();

        String table = resolveTableName(md, TABLE);
        if (table == null) {
            // 全新库：表还没建（ddl-auto 稍后按实体建，含唯一约束）。这是预期路径，不是失败。
            log.info("[V24-identity-uid] {} 尚不存在（全新库，交给 ddl-auto 建表），跳过", TABLE);
            return;
        }

        try (Statement st = conn.createStatement()) {
            if (columnExists(md, table, COLUMN)) {
                log.info("[V24-identity-uid] {}.{} 已存在，跳过加列", table, COLUMN);
            } else {
                st.executeUpdate("ALTER TABLE " + table + " ADD COLUMN " + COLUMN + " VARCHAR(32) NULL");
                log.info("[V24-identity-uid] added {}.{}", table, COLUMN);
            }

            String existing = uniqueIndexOn(md, table, COLUMN);
            if (existing != null) {
                log.info("[V24-identity-uid] {}.{} 已有唯一约束（索引 {}），跳过建索引", table, COLUMN, existing);
            } else {
                st.executeUpdate("CREATE UNIQUE INDEX " + INDEX + " ON " + table + " (" + COLUMN + ")");
                log.info("[V24-identity-uid] added {}", INDEX);
            }
        }
    }

    // ── JDBC metadata 探测（H2 存大写、MySQL 存小写，两种都试）────────────────────

    /** @return 数据库里实际存的表名；表不存在返回 null。 */
    public static String resolveTableName(DatabaseMetaData md, String logical) throws SQLException {
        for (String candidate : new String[]{logical, logical.toUpperCase()}) {
            try (ResultSet rs = md.getTables(null, null, candidate, new String[]{"TABLE"})) {
                if (rs.next()) return candidate;
            }
        }
        return null;
    }

    public static boolean columnExists(DatabaseMetaData md, String table, String column) throws SQLException {
        for (String candidate : new String[]{column, column.toUpperCase()}) {
            try (ResultSet rs = md.getColumns(null, null, table, candidate)) {
                if (rs.next()) return true;
            }
        }
        return false;
    }

    /**
     * 该列上是否已有单列唯一索引；有则返回索引名。
     *
     * <p>按列判定而不是按索引名：全新 H2 上唯一约束是 Hibernate ddl-auto 建的、名字是生成的
     * （{@code UK_xxxxxx}），按名字判会误判成「没有」而重复建索引。</p>
     */
    public static String uniqueIndexOn(DatabaseMetaData md, String table, String column) throws SQLException {
        Map<String, List<String>> byIndex = new LinkedHashMap<>();
        try (ResultSet rs = md.getIndexInfo(null, null, table, true, false)) {
            while (rs.next()) {
                String indexName = rs.getString("INDEX_NAME");
                String columnName = rs.getString("COLUMN_NAME");
                if (indexName == null || columnName == null) continue;
                byIndex.computeIfAbsent(indexName, k -> new ArrayList<>()).add(columnName);
            }
        }
        for (Map.Entry<String, List<String>> entry : byIndex.entrySet()) {
            List<String> columns = entry.getValue();
            if (columns.size() == 1 && columns.get(0).equalsIgnoreCase(column)) return entry.getKey();
        }
        return null;
    }
}
