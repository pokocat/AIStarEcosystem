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

    @Test
    void entryTypeMigrationMatchesEntityEnumExactly() {
        List<String> entity = Arrays.stream(LedgerEntry.LedgerEntryType.values()).map(Enum::name).toList();
        assertEquals(entity, targetValuesFor("aep_ledger_entries"),
                "aep_ledger_entries.entry_type 迁移枚举值与 LedgerEntry.LedgerEntryType 漂移：加了 enum 值要同步 EnumColumnWideningMigration");
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
