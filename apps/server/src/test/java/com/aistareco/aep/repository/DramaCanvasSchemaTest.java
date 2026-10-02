package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaCanvas;
import com.aistareco.aep.model.DramaCanvasRun;
import com.aistareco.aep.model.StorageAsset;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.Transaction;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.cfg.AvailableSettings;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLIntegrityConstraintViolationException;
import java.sql.Statement;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * V36（drama_canvas / drama_canvas_run）与实体（DramaCanvas / DramaCanvasRun）、JPQL 的一致性，照真实启动顺序在 H2（MySQL 模式，与 dev 一致）上走一遍：
 * 先跑迁移、再 Hibernate {@code ddl-auto=update}，然后拿 repository 里的<b>同一个</b> JPQL 常量真执行。
 *
 * <p>要防的事故：{@code @Query} 写错、实体列名和迁移对不上，都只会在 Spring 上下文启动时炸 —— 整个 API 起不来
 * （2026-09-09 {@code @Id} 被挤到常量上那次，四道门禁一个都没拦住）。
 */
class DramaCanvasSchemaTest {

    private static final Path V36 = Path.of("src/main/resources/db/migration/V36__drama_canvas.sql");

    @Test
    void 先跑V36再ddl_auto_实体与JPQL都对得上() throws Exception {
        String url = "jdbc:h2:mem:drama_canvas_" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (Connection c = DriverManager.getConnection(url, "sa", "")) {
            runV36(c);
            try (SessionFactory sf = sessionFactory(url)) {
                OffsetDateTime t0 = OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS);
                try (Session s = sf.openSession()) {
                    Transaction tx = s.beginTransaction();
                    s.persist(DramaCanvas.builder().id("dcv_1").ownerUserId("u1").title("t").ratio("9:16")
                            .docJson("{\"schema\":1}").docVersion("aaaaaaaaaaaaaaaa").createdAt(t0).updatedAt(t0).build());
                    s.persist(StorageAsset.builder().id("sa_1").app("drama").ownerUserId("u1").category("画布图片")
                            .cdnKey("drama/a.png").bytes(1).createdAt(t0).build());
                    s.persist(StorageAsset.builder().id("sa_2").app("drama").ownerUserId("u2").category("画布图片")
                            .cdnKey("drama/b.png").bytes(1).createdAt(t0).build());
                    tx.commit();
                }

                // 条件保存：版本对得上写 1 行，对不上写 0 行
                try (Session s = sf.openSession()) {
                    Transaction tx = s.beginTransaction();
                    int ok = updateDoc(s, "dcv_1", "u1", "aaaaaaaaaaaaaaaa", "{\"schema\":1,\"x\":1}", "bbbbbbbbbbbbbbbb", t0.plusSeconds(1));
                    int stale = updateDoc(s, "dcv_1", "u1", "aaaaaaaaaaaaaaaa", "{\"schema\":1,\"x\":2}", "cccccccccccccccc", t0.plusSeconds(2));
                    int other = updateDoc(s, "dcv_1", "u2", "bbbbbbbbbbbbbbbb", "{}", "dddddddddddddddd", t0.plusSeconds(3));
                    tx.commit();
                    assertEquals(1, ok);
                    assertEquals(0, stale, "旧版本不许写");
                    assertEquals(0, other, "别人的画布不许写");
                }
                try (Session s = sf.openSession()) {
                    DramaCanvas row = s.get(DramaCanvas.class, "dcv_1");
                    assertEquals("bbbbbbbbbbbbbbbb", row.getDocVersion());
                    assertEquals("{\"schema\":1,\"x\":1}", row.getDocJson());
                    assertEquals(t0.plusSeconds(1).toInstant(), row.getUpdatedAt().toInstant(), "微秒精度落库再读回不变");
                }

                // 软删：第一次 1 行，已删再删 0 行
                try (Session s = sf.openSession()) {
                    Transaction tx = s.beginTransaction();
                    int first = softDelete(s, "dcv_1", "u1", t0.plusSeconds(4));
                    int again = softDelete(s, "dcv_1", "u1", t0.plusSeconds(5));
                    tx.commit();
                    assertEquals(1, first);
                    assertEquals(0, again);
                }

                // 归属查询：只回本人 drama 下的 key
                try (Session s = sf.openSession()) {
                    List<String> owned = s.createSelectionQuery(StorageAssetRepository.FIND_OWNED_CDN_KEYS, String.class)
                            .setParameter("app", "drama")
                            .setParameter("uid", "u1")
                            .setParameterList("keys", List.of("drama/a.png", "drama/b.png", "nope"))
                            .getResultList();
                    assertEquals(List.of("drama/a.png"), owned);
                }
            }

            // drama_canvas_run：幂等键 (owner, client_request_id) 真的唯一；没带键的行可以有很多
            insertRun(c, "dcr_1", "u1", "req-1");
            assertThrows(SQLIntegrityConstraintViolationException.class, () -> insertRun(c, "dcr_2", "u1", "req-1"));
            assertDoesNotThrow(() -> insertRun(c, "dcr_3", "u2", "req-1"));
            assertDoesNotThrow(() -> insertRun(c, "dcr_4", "u1", null));
            assertDoesNotThrow(() -> insertRun(c, "dcr_5", "u1", null));
        }
    }

    private static int updateDoc(Session s, String id, String owner, String base, String json, String version, OffsetDateTime at) {
        return s.createMutationQuery(DramaCanvasRepository.UPDATE_DOC_IF_VERSION)
                .setParameter("id", id)
                .setParameter("ownerUserId", owner)
                .setParameter("baseDocVersion", base)
                .setParameter("docJson", json)
                .setParameter("docVersion", version)
                .setParameter("title", "t")
                .setParameter("updatedAt", at)
                .executeUpdate();
    }

    private static int softDelete(Session s, String id, String owner, OffsetDateTime at) {
        return s.createMutationQuery(DramaCanvasRepository.SOFT_DELETE)
                .setParameter("id", id)
                .setParameter("ownerUserId", owner)
                .setParameter("now", at)
                .executeUpdate();
    }

    private static void insertRun(Connection c, String id, String owner, String req) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("INSERT INTO drama_canvas_run"
                + " (id, canvas_id, owner_user_id, kind, target, status, client_request_id)"
                + " VALUES (?, 'dcv_1', ?, 'image', 'look:lk1', 'queued', ?)")) {
            ps.setString(1, id);
            ps.setString(2, owner);
            ps.setString(3, req);
            ps.executeUpdate();
        }
    }

    private static void runV36(Connection c) throws Exception {
        String sql = Files.readString(V36);
        String stripped = Arrays.stream(sql.split("\n"))
                .filter(l -> !l.trim().startsWith("--"))
                .reduce("", (a, b) -> a + "\n" + b);
        try (Statement st = c.createStatement()) {
            for (String s : stripped.split(";")) {
                if (!s.isBlank()) st.execute(s.trim());
            }
        }
    }

    /** 与线上同一条路径：Hibernate {@code hbm2ddl.auto=update} + Spring Boot 的物理命名策略。 */
    private static SessionFactory sessionFactory(String url) {
        StandardServiceRegistry registry = new StandardServiceRegistryBuilder()
                .applySetting(AvailableSettings.JAKARTA_JDBC_URL, url)
                .applySetting(AvailableSettings.JAKARTA_JDBC_USER, "sa")
                .applySetting(AvailableSettings.JAKARTA_JDBC_PASSWORD, "")
                .applySetting(AvailableSettings.HBM2DDL_AUTO, "update")
                // ddl-auto 想补的列 / 索引执行失败时默认只打日志；这里让它直接抛，实体与 V36 对不上就红
                .applySetting(AvailableSettings.HBM2DDL_HALT_ON_ERROR, "true")
                .applySetting(AvailableSettings.PHYSICAL_NAMING_STRATEGY,
                        CamelCaseToUnderscoresNamingStrategy.class.getName())
                .build();
        try {
            return new MetadataSources(registry)
                    .addAnnotatedClass(DramaCanvas.class)
                    .addAnnotatedClass(DramaCanvasRun.class)
                    .addAnnotatedClass(StorageAsset.class)
                    .buildMetadata()
                    .buildSessionFactory();
        } catch (RuntimeException e) {
            StandardServiceRegistryBuilder.destroy(registry);
            throw e;
        }
    }
}
