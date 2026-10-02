package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaCanvas;
import com.aistareco.aep.model.DramaCanvasRun;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.model.StorageAsset;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.cfg.AvailableSettings;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * {@link DramaCanvasRunRepository} 在真 H2（MySQL 模式，先跑 V36 再 ddl-auto，与 dev 启动顺序一致）上：
 * 用 Spring Data 的 {@link JpaRepositoryFactory} 建仓库 —— 派生查询名、{@code @Query} JPQL 写错会在这一步就抛，
 * 和应用启动时一样（否则只有起服务才发现、整个 API 起不来，§8.0.1 ⑧ 那一类）。再真跑一遍条件迁移与心跳。
 */
class DramaCanvasRunRepositoryTest {

    private static final Path V36 = Path.of("src/main/resources/db/migration/V36__drama_canvas.sql");

    @Test
    void 仓库能建起来_条件迁移只有一个赢家_心跳不碰终态() throws Exception {
        String url = "jdbc:h2:mem:drama_canvas_run_" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (Connection c = DriverManager.getConnection(url, "sa", "")) {
            runV36(c);
            try (SessionFactory sf = sessionFactory(url)) {
                EntityManager em = sf.createEntityManager();
                DramaCanvasRunRepository repo = new JpaRepositoryFactory(em).getRepository(DramaCanvasRunRepository.class);
                OffsetDateTime t0 = OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS);

                em.getTransaction().begin();
                repo.save(run("dcr_1", "u1", "dcv_1", "req-1", "queued", t0.minusMinutes(30)));
                repo.save(run("dcr_2", "u1", "dcv_1", "req-2", "succeeded", t0.minusMinutes(30)));
                repo.save(run("dcr_3", "u2", "dcv_2", "req-1", "running", t0.minusMinutes(30)));
                em.getTransaction().commit();
                em.clear();

                assertEquals("dcr_1", repo.findByOwnerUserIdAndClientRequestId("u1", "req-1").orElseThrow().getId());
                assertTrue(repo.findByIdAndOwnerUserIdAndCanvasId("dcr_1", "u1", "dcv_2").isEmpty(), "别的画布查不到");
                assertEquals(2, repo.findByOwnerUserIdAndCanvasIdAndIdIn("u1", "dcv_1", List.of("dcr_1", "dcr_2", "dcr_3")).size());
                assertEquals(2, repo.findByStatusInAndUpdatedAtBefore(List.of("queued", "running"), t0.minusMinutes(10)).size());

                em.getTransaction().begin();
                int claimed = repo.transition("dcr_1", "queued", "running", t0);
                int lost = repo.transition("dcr_1", "queued", "canceled", t0);
                int touched = repo.touch(List.of("dcr_1", "dcr_2"), t0.plusSeconds(5));
                em.getTransaction().commit();
                em.clear();
                assertEquals(1, claimed);
                assertEquals(0, lost, "认领之后再取消必须失败（条件更新只有一个赢家）");
                assertEquals(1, touched, "终态行的 updatedAt 不动");
                DramaCanvasRun r1 = repo.findById("dcr_1").orElseThrow();
                assertEquals("running", r1.getStatus());
                assertEquals(t0.plusSeconds(5).toInstant(), r1.getUpdatedAt().toInstant());
                assertEquals(t0.minusMinutes(30).toInstant(), repo.findById("dcr_2").orElseThrow().getUpdatedAt().toInstant());

                // 终态迁移都是条件更新：只有一个能赢
                OffsetDateTime seen = repo.findById("dcr_1").orElseThrow().getUpdatedAt();
                em.getTransaction().begin();
                int progressed = repo.progress("dcr_1", "{\"images\":[{\"key\":\"k\"}]}", t0.plusSeconds(6));
                int staleExpire = repo.expireIfUnchanged("dcr_1", seen, "failed", 2, null, "X", "x", t0.plusSeconds(7));
                int succeeded = repo.succeed("dcr_1", List.of("running"), "{\"images\":[]}", null, 2, t0.plusSeconds(8));
                int lateFail = repo.fail("dcr_1", List.of("queued", "running"), "LATE", "late", t0.plusSeconds(9));
                int lateCancel = repo.cancel("dcr_1", List.of("queued"), "已取消", t0.plusSeconds(9));
                int refs = repo.setRefsIfActive("dcr_1", "{}");
                em.getTransaction().commit();
                em.clear();
                assertEquals(1, progressed);
                assertEquals(0, staleExpire, "读到之后 worker 动过（心跳变了）→ 回收放弃");
                assertEquals(1, succeeded);
                assertEquals(0, lateFail, "成功之后迟到的失败不能覆盖");
                assertEquals(0, lateCancel);
                assertEquals(0, refs, "终态不改说明");
                DramaCanvasRun done = repo.findById("dcr_1").orElseThrow();
                assertEquals("succeeded", done.getStatus());
                assertNull(done.getErrorCode());
                assertNotNull(done.getFinishedAt());

                // 心跳没变的僵死行：回收生效
                em.getTransaction().begin();
                int expired = repo.expireIfUnchanged("dcr_3", repo.findById("dcr_3").orElseThrow().getUpdatedAt(),
                        "failed", 2, null, "DRAMA_CANVAS_RUN_TIMEOUT", "超时", t0);
                em.getTransaction().commit();
                em.clear();
                assertEquals(1, expired);

                // 对账恢复候选：画布判失败 + 底层任务成功（跨表 JPQL 在这里真跑）
                em.getTransaction().begin();
                em.persist(MaterialVideoJob.builder().id("mvj_ok").ownerUserId("u1").status("succeeded").progress(100)
                        .createdAt(t0).build());
                DramaCanvasRun v = run("dcr_v", "u1", "dcv_1", "req-v", "failed", t0);
                v.setKind("video");
                v.setJobId("mvj_ok");
                v.setErrorCode("DRAMA_CANVAS_VIDEO_RECORD_FAILED"); // 登记失败：可重试，要被捡起来
                repo.save(v);
                DramaCanvasRun gone = run("dcr_v2", "u1", "dcv_1", "req-v2", "failed", t0);
                gone.setKind("video");
                gone.setJobId("mvj_ok");
                gone.setErrorCode("DRAMA_CANVAS_VIDEO_NOT_STORED"); // 确实没有平台 key：永远恢复不了，排除
                repo.save(gone);
                em.getTransaction().commit();
                em.clear();
                assertEquals(List.of("dcr_v"), repo.findRecoverableVideoRuns(
                        org.springframework.data.domain.PageRequest.of(0, 10)).stream().map(DramaCanvasRun::getId).toList());
                em.close();
            }
        }
    }

    private static DramaCanvasRun run(String id, String owner, String canvas, String req, String status, OffsetDateTime at) {
        return DramaCanvasRun.builder().id(id).canvasId(canvas).ownerUserId(owner).kind("image").target("look:lk1")
                .status(status).cost(2).clientRequestId(req).inputJson("{}").createdAt(at).updatedAt(at).build();
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

    private static SessionFactory sessionFactory(String url) {
        StandardServiceRegistry registry = new StandardServiceRegistryBuilder()
                .applySetting(AvailableSettings.JAKARTA_JDBC_URL, url)
                .applySetting(AvailableSettings.JAKARTA_JDBC_USER, "sa")
                .applySetting(AvailableSettings.JAKARTA_JDBC_PASSWORD, "")
                .applySetting(AvailableSettings.HBM2DDL_AUTO, "update")
                .applySetting(AvailableSettings.HBM2DDL_HALT_ON_ERROR, "true")
                .applySetting(AvailableSettings.PHYSICAL_NAMING_STRATEGY,
                        CamelCaseToUnderscoresNamingStrategy.class.getName())
                .build();
        try {
            return new MetadataSources(registry)
                    .addAnnotatedClass(DramaCanvas.class)
                    .addAnnotatedClass(DramaCanvasRun.class)
                    .addAnnotatedClass(StorageAsset.class)
                    .addAnnotatedClass(MaterialVideoJob.class)
                    .buildMetadata()
                    .buildSessionFactory();
        } catch (RuntimeException e) {
            StandardServiceRegistryBuilder.destroy(registry);
            throw e;
        }
    }
}
