package com.aistareco.aep.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.stream.Collectors;

/**
 * v2 §9 / §4.2 —— 启动期幂等加宽 MySQL 原生 {@code enum(...)} 列。
 *
 * <h2>为什么需要</h2>
 * Hibernate 6 在 MySQL（及 H2 {@code MODE=MySQL}）下把 {@code @Enumerated(STRING)} 映射为<b>原生
 * {@code enum(...)} 列</b>，而非 VARCHAR。{@code ddl-auto=update} 只在「<b>建表</b>」时按实体写全枚举值；
 * 给<b>已存在</b>的 enum 列<b>追加新枚举值</b>时它<b>不会</b> widen 旧定义 → 插入 / 比较新值时 MySQL 报
 * {@code Data truncated} / {@code Value not permitted}。本轮 v2 钱包引入两处新值，未 widen 即出事：
 * <ul>
 *   <li>{@code admin_users.role} 加 {@code FINANCE_ADMIN}（C2）—— 不 widen 则
 *       {@link DataInitializer#ensureFinanceAdminSeed} 在<b>启动</b>即崩（插入失败）。</li>
 *   <li>{@code aep_ledger_entries.entry_type} 加 {@code REFUND_CASH}（C3 / D17）—— 不 widen 则
 *       <b>首次现金退款</b>写账本时失败（运行期）。</li>
 * </ul>
 *
 * <h2>语义</h2>
 * <ul>
 *   <li><b>仅 MySQL / MariaDB 生效</b>：dev H2 每次按实体重建 schema，列天生带全枚举，无需 widen；
 *       非 MySQL 方言直接跳过（避免 {@code information_schema} / {@code MODIFY COLUMN} 方言差异）。</li>
 *   <li><b>完全幂等</b>：先读 {@code information_schema.COLUMNS} 的 {@code COLUMN_TYPE}，已含全部目标枚举值
 *       → 跳过；否则 {@code MODIFY COLUMN} 重述列定义（<b>保留原 nullability</b>，不改其它）。</li>
 *   <li><b>绝不阻断启动</b>：任意失败（权限不足 / 库里有不在目标集合的旧值 / 方言差异）仅 log，
 *       下一列继续 —— 与 {@link MixcutJobSchemaMigration} / {@link LedgerPlaneBackfill} 一致。</li>
 * </ul>
 *
 * <p><b>@Order(0)：必须先于 {@link DataInitializer}（@Order 1）的 FINANCE_ADMIN 播种。</b>
 * Hibernate 的 {@code ddl-auto} schema 管理发生在所有 {@code CommandLineRunner} 之前，故运行时表已存在
 * （可能枚举陈旧），本 runner 在播种前把它 widen 好。
 *
 * <p>目标枚举值集合（{@link #COLUMNS}）必须与实体 enum <b>1:1 对齐</b>，由
 * {@code EnumColumnWideningMigrationTest} 反射守门 —— 新增任何 enum 值忘了同步本表 → 测试红。
 * 生产级 Flyway 接管后改为版本化 {@code ALTER} 脚本并移除本类（见 TODO「enum 列扩值需手写迁移」）。
 */
@Component
@Order(0) // 必须先于 DataInitializer(@Order 1) 播种 FINANCE_ADMIN
public class EnumColumnWideningMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(EnumColumnWideningMigration.class);

    /** 一处 enum 列的目标全枚举值集合（顺序即实体声明序，与 Hibernate 生成的列定义一致）。 */
    record EnumColumn(String table, String column, List<String> values) {}

    /**
     * 需要 widen 的 enum 列清单。<b>每个 values 必须与对应实体 enum 的 {@code values()} 完全一致</b>
     * （顺序也一致）—— 由测试反射守门。
     */
    private static final List<EnumColumn> COLUMNS = List.of(
            // AdminUser.AdminRole（C2：+FINANCE_ADMIN）
            new EnumColumn("admin_users", "role",
                    List.of("SUPER_ADMIN", "OPERATOR", "FINANCE_ADMIN")),
            // LedgerEntry.LedgerEntryType（C3/D17：+REFUND_CASH）
            new EnumColumn("aep_ledger_entries", "entry_type",
                    List.of("LICENSE_GRANT", "RECHARGE", "REFUND", "REFUND_CASH", "INCOME",
                            "GIFT", "SPEND", "WITHDRAW", "FREEZE", "UNFREEZE", "ADJUST"))
    );

    /** 测试用：暴露目标清单做反射对齐校验（同包可见）。 */
    static List<EnumColumn> migrations() {
        return COLUMNS;
    }

    private final DataSource dataSource;

    public EnumColumnWideningMigration(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(String... args) {
        try (Connection conn = dataSource.getConnection()) {
            String product = conn.getMetaData().getDatabaseProductName();
            String lower = product == null ? "" : product.toLowerCase();
            if (!lower.contains("mysql") && !lower.contains("mariadb")) {
                // dev H2 / 其它方言：列按实体重建即带全枚举，无需 widen。
                log.debug("[enum-widen] 跳过（非 MySQL/MariaDB 方言：{}）", product);
                return;
            }
            for (EnumColumn c : COLUMNS) {
                widenIfNeeded(conn, c);
            }
        } catch (SQLException e) {
            // 取连接 / 读 metadata 失败：仅 log，绝不阻断启动。
            log.warn("[enum-widen] 跳过（无法建立连接 / 读取方言）：{}", e.getMessage());
        }
    }

    private void widenIfNeeded(Connection conn, EnumColumn c) {
        try {
            String existingType = readColumnType(conn, c.table(), c.column());
            if (existingType == null) {
                log.debug("[enum-widen] {}.{} 列不存在，跳过（表尚未建？）", c.table(), c.column());
                return;
            }
            // COLUMN_TYPE 形如 enum('SUPER_ADMIN','OPERATOR')；带引号匹配确保整 token 命中
            // （'REFUND' 不会误命中 'REFUND_CASH'，因后者引号内是 REFUND_ 而非 REFUND'）。
            boolean missingAny = c.values().stream()
                    .anyMatch(v -> !existingType.contains("'" + v + "'"));
            if (!missingAny) {
                log.debug("[enum-widen] {}.{} 已含全部枚举值，跳过（幂等）", c.table(), c.column());
                return;
            }
            boolean nullable = readIsNullable(conn, c.table(), c.column());
            String enumDef = c.values().stream()
                    .map(v -> "'" + v + "'")
                    .collect(Collectors.joining(","));
            String sql = String.format(
                    "ALTER TABLE %s MODIFY COLUMN %s ENUM(%s) %s",
                    c.table(), c.column(), enumDef, nullable ? "NULL" : "NOT NULL");
            try (Statement st = conn.createStatement()) {
                st.execute(sql);
            }
            log.info("[enum-widen] 已加宽 {}.{} → ENUM({}) {}",
                    c.table(), c.column(), enumDef, nullable ? "NULL" : "NOT NULL");
        } catch (SQLException e) {
            // 已加宽 / 权限不足 / 库里有不在目标集合的旧值 —— 仅 log，下一列继续，不阻断启动。
            log.warn("[enum-widen] {}.{} 加宽失败（{}）：{}",
                    c.table(), c.column(), e.getSQLState(), e.getMessage());
        }
    }

    private String readColumnType(Connection conn, String table, String column) throws SQLException {
        String q = "SELECT COLUMN_TYPE FROM information_schema.COLUMNS "
                + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?";
        try (PreparedStatement ps = conn.prepareStatement(q)) {
            ps.setString(1, table);
            ps.setString(2, column);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    private boolean readIsNullable(Connection conn, String table, String column) throws SQLException {
        String q = "SELECT IS_NULLABLE FROM information_schema.COLUMNS "
                + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?";
        try (PreparedStatement ps = conn.prepareStatement(q)) {
            ps.setString(1, table);
            ps.setString(2, column);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && "YES".equalsIgnoreCase(rs.getString(1));
            }
        }
    }
}
