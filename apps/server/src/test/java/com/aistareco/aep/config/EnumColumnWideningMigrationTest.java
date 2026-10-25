package com.aistareco.aep.config;

import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.model.LedgerEntry;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * 守门 {@link EnumColumnWideningMigration}：
 *   1. <b>漂移守门（核心）</b>：迁移声明的目标枚举值集合必须与实体 enum {@code values()} 1:1 对齐
 *      —— 任何人给 {@code AdminRole} / {@code LedgerEntryType} 加值却忘了同步迁移清单 → 本测试红，
 *      把「生产 enum 列未 widen → 启动崩 / 退款写库失败」的隐患挡在 CI。
 *   2. <b>非 MySQL 优雅跳过</b>：对 H2 数据源 {@code run()} 不抛异常、不阻断启动（dev / 测试路径）。
 */
class EnumColumnWideningMigrationTest {

    private static List<String> targetValuesFor(String table) {
        return EnumColumnWideningMigration.migrations().stream()
                .filter(c -> c.table().equals(table))
                .findFirst()
                .map(EnumColumnWideningMigration.EnumColumn::values)
                .orElseThrow(() -> new AssertionError("迁移清单缺表：" + table));
    }

    @Test
    void adminRoleMigrationMatchesEntityEnumExactly() {
        List<String> entity = Arrays.stream(AdminUser.AdminRole.values()).map(Enum::name).toList();
        assertEquals(entity, targetValuesFor("admin_users"),
                "admin_users.role 迁移枚举值与 AdminUser.AdminRole 漂移：加了 enum 值要同步 EnumColumnWideningMigration");
    }

    /** V67 把流水类型改成 VARCHAR；启动时再按旧清单改回 ENUM 会让第一笔模型赠款入账失败（2026-10-25 MySQL 全流程复现）。 */
    @Test
    void ledgerEntryTypeIsVarcharAndNeverNarrowedBackToAnEnum() throws Exception {
        assertTrue(EnumColumnWideningMigration.migrations().stream().noneMatch(c -> c.table().equals("aep_ledger_entries")),
                "aep_ledger_entries.entry_type 已是 VARCHAR，不能再放进启动加宽清单");
        var mapping = LedgerEntry.class.getDeclaredField("entryType").getAnnotation(org.hibernate.annotations.JdbcTypeCode.class);
        assertNotNull(mapping, "LedgerEntry.entryType 必须保持 @JdbcTypeCode(VARCHAR)，否则 MySQL 建表会生成缺值的原生 ENUM");
        assertEquals(org.hibernate.type.SqlTypes.VARCHAR, mapping.value());
    }

    @Test
    void onlyEnumColumnsMissingValuesAreWidened() {
        var values = List.of("SUPER_ADMIN", "OPERATOR", "FINANCE_ADMIN");
        assertTrue(EnumColumnWideningMigration.shouldWiden("enum('SUPER_ADMIN','OPERATOR')", values));
        assertFalse(EnumColumnWideningMigration.shouldWiden("enum('SUPER_ADMIN','OPERATOR','FINANCE_ADMIN')", values));
        assertFalse(EnumColumnWideningMigration.shouldWiden("varchar(255)", values), "VARCHAR 列不能被改回 ENUM");
        assertFalse(EnumColumnWideningMigration.shouldWiden(null, values));
    }

    @Test
    void everyMigrationTargetIsNonEmpty() {
        assertNotNull(EnumColumnWideningMigration.migrations());
        EnumColumnWideningMigration.migrations().forEach(c -> {
            assertNotNull(c.values());
            assertEquals(c.values(), c.values().stream().distinct().toList(),
                    c.table() + "." + c.column() + " 迁移枚举值有重复");
        });
    }

    @Test
    void runOnH2IsGracefulNoOp() {
        DriverManagerDataSource ds = new DriverManagerDataSource(
                "jdbc:h2:mem:enumwiden_test;MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        ds.setDriverClassName("org.h2.Driver");
        EnumColumnWideningMigration migration = new EnumColumnWideningMigration(ds);
        // H2 方言 → 命中跳过分支，绝不抛异常、不阻断启动。
        assertDoesNotThrow(() -> migration.run());
    }
}
