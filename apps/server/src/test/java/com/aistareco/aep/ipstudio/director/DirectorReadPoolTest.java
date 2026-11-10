package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * 导演台读作品不能在持着作品行锁时再要第二条连接（2026-11-10 线上事故）。
 * 一个账号 10 秒内对同一部作品发了 125 个读取：旧实现在锁内另开 REQUIRES_NEW 读任务列表，
 * 拿到锁的那个等不到第二条连接（池子被等锁的请求占满），其余的等锁超时，读作品连续 500，全站接口跟着失败。
 * 这里连接池只开 3 条、取连接超时 1.2 秒，并发读取多于池容量也要全部成功。
 * <p>同时守住 2026-10-24 的问题：本次请求里在独立事务中刚建的任务，出 wire 时要列出来。
 * H2 默认就是读已提交，这一条只有在 MySQL（可重复读）上才有区分度：
 * {@code DIRECTOR_DELETE_TEST_DB_URL=jdbc:mysql://127.0.0.1:13306/director_delete_test SPRING_DATASOURCE_USERNAME=root
 * ./mvnw test -Dtest='DirectorReadPoolTest'}，只能指向一次性的测试库（ddl-auto=create-drop 会重建全部表）。
 */
@SpringBootTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=${DIRECTOR_DELETE_TEST_DB_URL:jdbc:h2:mem:director-read-pool;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000}",
        "spring.datasource.hikari.maximum-pool-size=3", "spring.datasource.hikari.minimum-idle=0",
        "spring.datasource.hikari.connection-timeout=1200",
        "aep.seed.dev-data.enabled=false", "aep.cdn.driver=local", "aep.dev-auth.enabled=false",
        "aep.dev-fake-llm.enabled=false", "aep.director.initial-delay-ms=3600000"})
@ActiveProfiles("test")
class DirectorReadPoolTest {
    @Autowired DirectorService director;
    @Autowired DirectorWorkRepository works;
    @Autowired IpRunRepository runs;
    @Autowired PlatformTransactionManager tx;
    /** 读作品时回投视频要查原生视频任务；这里借这一步模拟「本次请求里另一个事务刚建了任务」。 */
    @MockBean MaterialVideoJobService videoJobs;

    private String work(String owner, String content) {
        DirectorWork w = new DirectorWork();
        w.setId("DW-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        w.setOwnerUserId(owner); w.setTitle("读取"); w.setRevision(1);
        w.setCreatedAt(Instant.now()); w.setUpdatedAt(Instant.now());
        w.setContentJson(content);
        return works.save(w).getId();
    }

    private String work(String owner) {
        return work(owner, "{\"idea\":\"\",\"draft\":\"剧本\",\"draftRev\":0,\"seq\":0,\"settings\":{},\"notice\":null,\"clips\":[],\"assets\":[],\"episodes\":[],\"applied\":[],\"taskMeta\":{},\"pipeline\":null}");
    }

    private IpRun runOf(String workId, String owner) {
        return IpRun.builder().id("IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20)).projectId(workId)
                .hostType(IpRun.HOST_DIRECTOR).ownerUserId(owner).nodeId("script").kind("studio-director").status(IpRun.STATUS_RUNNING)
                .stage("queued").cost(0).inputJson("{}").outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
    }

    private static List<String> taskIds(JsonNode view) {
        List<String> out = new ArrayList<>();
        view.path("tasks").forEach(t -> out.add(t.path("id").asText()));
        return out;
    }

    /** 控制器的真实形态：同一部作品的并发读取多于连接数，各自起事务排队拿锁，全部成功、都看得到任务。 */
    @Test void moreConcurrentReadsOfOneWorkThanConnectionsAllSucceed() throws Exception {
        String u = "read-" + UUID.randomUUID().toString().substring(0, 8);
        String id = work(u);
        String run = runs.save(runOf(id, u)).getId();
        int n = 12;
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(n);
        try {
            List<Future<Object>> futures = new ArrayList<>();
            for (int i = 0; i < n; i++) futures.add(pool.submit(() -> {
                try { go.await(); return director.get(u, id); } catch (Throwable t) { return t; }
            }));
            go.countDown();
            List<Object> errors = new ArrayList<>();
            for (Future<Object> f : futures) {
                Object r = f.get(60, TimeUnit.SECONDS);
                if (r instanceof Throwable) errors.add(r);
                else assertEquals(List.of(run), taskIds((JsonNode) r));
            }
            assertTrue(errors.isEmpty(), "并发读取失败：" + errors);
        } finally { go.countDown(); pool.shutdownNow(); }
    }

    /** 池子被占满：每个线程已持一条连接和自己作品的行锁（读已提交，同入口声明），再同时读作品。读取必须复用这条连接。 */
    @Test void readsInsideHeldConnectionsDoNotNeedASecondOne() throws Exception {
        String u = "read-" + UUID.randomUUID().toString().substring(0, 8);
        List<String> ids = List.of(work(u), work(u), work(u));
        CountDownLatch held = new CountDownLatch(ids.size());
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(ids.size());
        try {
            List<Future<Throwable>> futures = new ArrayList<>();
            for (String id : ids) futures.add(pool.submit(() -> {
                try {
                    TransactionTemplate t = new TransactionTemplate(tx);
                    t.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
                    t.executeWithoutResult(s -> {
                        works.lockById(id).orElseThrow();
                        held.countDown();
                        try { if (!go.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("barrier"); }
                        catch (InterruptedException e) { throw new RuntimeException(e); }
                        director.get(u, id);
                    });
                    return null;
                } catch (Throwable t) { return t; }
            }));
            assertTrue(held.await(10, TimeUnit.SECONDS), "三条连接都应被占住");
            go.countDown();
            List<Throwable> errors = new ArrayList<>();
            for (Future<Throwable> f : futures) { Throwable t = f.get(20, TimeUnit.SECONDS); if (t != null) errors.add(t); }
            assertTrue(errors.isEmpty(), "并发读取失败：" + errors);
        } finally { go.countDown(); pool.shutdownNow(); }
    }

    /**
     * 2026-10-24：读作品的事务已经读过任务表（MySQL 可重复读在这一刻定下快照），之后另一个事务提交了新任务，
     * 出 wire 的任务列表仍要有它，否则页面以为没在生成、也不轮询。
     */
    @Test void taskCommittedByAnotherTransactionDuringTheReadIsListed() {
        String u = "read-" + UUID.randomUUID().toString().substring(0, 8);
        String id = work(u, "{\"idea\":\"\",\"draft\":\"剧本\",\"draftRev\":0,\"seq\":0,\"settings\":{},\"notice\":null,\"clips\":[{\"id\":\"c1\",\"video\":{\"pending\":[{\"jobId\":\"MVJ-pending\",\"stage\":\"queued\",\"at\":\"2026-11-10T08:00:00Z\"}]}}],"
                + "\"assets\":[],\"episodes\":[],\"applied\":[],\"taskMeta\":{},\"pipeline\":null}");
        TransactionTemplate independent = new TransactionTemplate(tx);
        independent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        String[] created = new String[1];
        when(videoJobs.getJob(anyString(), anyString(), anyString())).thenAnswer(inv -> {
            if (created[0] == null) created[0] = independent.execute(s -> runs.save(runOf(id, u)).getId());
            return null; // 视频任务还没查到：当作还在跑
        });
        JsonNode view = director.get(u, id);
        assertNotNull(created[0], "回投视频时应查过原生视频任务");
        assertTrue(taskIds(view).contains(created[0]), "刚提交的任务应出现在任务列表里：" + view.path("tasks"));
    }
}
