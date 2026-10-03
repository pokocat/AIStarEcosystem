package com.aistareco.aep.model;

import db.migration.V23__drama_short_client_request_id;
import org.flywaydb.core.api.migration.Context;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.cfg.AvailableSettings;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLIntegrityConstraintViolationException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 短视频开拍幂等的最后一道闸：{@code (owner_user_id, client_request_id)} 唯一索引，在每一种建库路径上都得真的存在。
 *
 * <p><b>要钉死的事故（v0.145 起就有）</b>：这把索引原来只写在 V23 迁移里，而 V23 对每条 DDL 都 try/catch 跳过。
 * Flyway 早于 Hibernate 跑 —— 全新库上 V23 执行时 {@code drama_shorts} 还不存在，建索引被静默跳过；
 * 随后 ddl-auto 按实体建表，实体上又没写这把索引。结果：任何新环境都没有它，同一把键的两个并发请求
 * 都能落库、各扣一笔开拍费（套用模板、聊天转短视频同样中招）。
 *
 * <p>这里照真实启动顺序走一遍（先 V23、后 Hibernate {@code ddl-auto=update}，库是 H2 的 MySQL 模式，与 dev 一致），
 * 然后断<b>行为</b>：同一个人、同一把键的第二次插入必须被数据库拒绝。不断言索引名 —— 名字对了但没生效一样是事故。
 */
class DramaShortUniqueIndexTest {

    @Test
    void 全新库_先跑迁移再由ddl_auto建表_同键第二次插入被拒() throws Exception {
        String url = newDb();
        try (Connection c = DriverManager.getConnection(url, "sa", "")) {
            runV23(c); // 表还不存在：两条 DDL 都被跳过 —— 这正是出事的那一步
            hibernateUpdate(url);

            assertGuardEnforced(c);
        }
    }

    @Test
    void 已有表但缺这把索引_ddl_auto_update启动时补上() throws Exception {
        String url = newDb();
        try (Connection c = DriverManager.getConnection(url, "sa", "")) {
            // 旧环境：表是之前的 ddl-auto 按旧实体建的，V23 当时被跳过，所以只有列、没有索引。
            try (Statement st = c.createStatement()) {
                st.execute("CREATE TABLE drama_shorts (id VARCHAR(255) NOT NULL PRIMARY KEY,"
                        + " owner_user_id VARCHAR(255), client_request_id VARCHAR(64))");
            }
            hibernateUpdate(url);

            assertGuardEnforced(c);
        }
    }

    @Test
    void V23已经建过索引的库_再启动不冲突且照样拦得住() throws Exception {
        String url = newDb();
        try (Connection c = DriverManager.getConnection(url, "sa", "")) {
            hibernateUpdate(url);   // 第一次启动：建表（含索引）
            runV23(c);              // 迁移再跑一遍（列、索引都已存在 → 跳过）
            hibernateUpdate(url);   // 再启动一次：同名索引已在，不能报错、不能把它弄没

            assertGuardEnforced(c);
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private static void assertGuardEnforced(Connection c) throws Exception {
        insert(c, "dvs_a", "u1", "confirm-1");
        assertThrows(SQLIntegrityConstraintViolationException.class,
                () -> insert(c, "dvs_b", "u1", "confirm-1"),
                "同一个人、同一把键只能落一条草稿，否则并发两次都会扣开拍费");

        // 键按人隔离；没带键的老行（NULL）可以有很多条。
        assertDoesNotThrow(() -> insert(c, "dvs_c", "u2", "confirm-1"));
        assertDoesNotThrow(() -> insert(c, "dvs_d", "u1", null));
        assertDoesNotThrow(() -> insert(c, "dvs_e", "u1", null));
    }

    private static void insert(Connection c, String id, String owner, String key) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("INSERT INTO drama_shorts"
                + " (id, owner_user_id, client_request_id, duration_sec, shot_count, done_count, progress)"
                + " VALUES (?, ?, ?, 0, 0, 0, 0)")) {
            ps.setString(1, id);
            ps.setString(2, owner);
            ps.setString(3, key);
            ps.executeUpdate();
        }
    }

    private static String newDb() {
        return "jdbc:h2:mem:drama_short_uk_" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
    }

    private static void runV23(Connection c) throws Exception {
        Context ctx = mock(Context.class);
        when(ctx.getConnection()).thenReturn(c);
        new V23__drama_short_client_request_id().migrate(ctx);
    }

    /** 与线上同一条路径：Hibernate {@code hbm2ddl.auto=update} + Spring Boot 的物理命名策略。 */
    private static void hibernateUpdate(String url) {
        StandardServiceRegistry registry = new StandardServiceRegistryBuilder()
                .applySetting(AvailableSettings.JAKARTA_JDBC_URL, url)
                .applySetting(AvailableSettings.JAKARTA_JDBC_USER, "sa")
                .applySetting(AvailableSettings.JAKARTA_JDBC_PASSWORD, "")
                .applySetting(AvailableSettings.HBM2DDL_AUTO, "update")
                .applySetting(AvailableSettings.PHYSICAL_NAMING_STRATEGY,
                        CamelCaseToUnderscoresNamingStrategy.class.getName())
                .build();
        try {
            new MetadataSources(registry)
                    .addAnnotatedClass(DramaShort.class)
                    .buildMetadata()
                    .buildSessionFactory()
                    .close();
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
    }
}
