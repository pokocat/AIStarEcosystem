package com.aistareco.aep.ipstudio.director;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 导演台删除不能在持着作品行锁时再要第二条连接（2026-10-28 独立复核）。
 * 连接池只开 3 条、取连接超时 1.2 秒：旧实现在锁内开 REQUIRES_NEW 查在途任务，3 个并发删除各占一条连接
 * 再各等一条，全部 CannotCreateTransactionException（active=3 / idle=0）。调大连接池只是把阈值推高，不算修复。
 */
@SpringBootTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=${DIRECTOR_DELETE_TEST_DB_URL:jdbc:h2:mem:director-delete-pool;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000}",
        "spring.datasource.hikari.maximum-pool-size=3", "spring.datasource.hikari.minimum-idle=0",
        "spring.datasource.hikari.connection-timeout=1200",
        "aep.seed.dev-data.enabled=false", "aep.cdn.driver=local", "aep.dev-auth.enabled=false",
        "aep.dev-fake-llm.enabled=false", "aep.director.initial-delay-ms=3600000"})
@ActiveProfiles("test")
class DirectorDeletePoolTest {
    @Autowired DirectorService director;
    @Autowired DirectorWorkRepository works;
    @Autowired PlatformTransactionManager tx;

    private String work(String owner) {
        DirectorWork w = new DirectorWork();
        w.setId("DW-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        w.setOwnerUserId(owner); w.setTitle("连接池"); w.setRevision(1);
        w.setCreatedAt(Instant.now()); w.setUpdatedAt(Instant.now());
        w.setContentJson("{\"clips\":[],\"pipeline\":null}");
        return works.save(w).getId();
    }

    /** 池子被占满：每个线程已持一条连接和自己作品的行锁，再同时进入删除。删除检查必须复用这条连接。 */
    @Test void deletesInsideHeldConnectionsDoNotNeedASecondOne() throws Exception {
        String u = "pool-" + UUID.randomUUID().toString().substring(0, 8);
        List<String> ids = List.of(work(u), work(u), work(u));
        CountDownLatch held = new CountDownLatch(ids.size());
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(ids.size());
        try {
            List<Future<Throwable>> futures = new ArrayList<>();
            for (String id : ids) futures.add(pool.submit(() -> {
                try {
                    new TransactionTemplate(tx).executeWithoutResult(s -> {
                        works.lockById(id).orElseThrow();
                        held.countDown();
                        try { if (!go.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("barrier"); }
                        catch (InterruptedException e) { throw new RuntimeException(e); }
                        director.delete(u, id);
                    });
                    return null;
                } catch (Throwable t) { return t; }
            }));
            assertTrue(held.await(10, TimeUnit.SECONDS), "三条连接都应被占住");
            go.countDown();
            List<Throwable> errors = new ArrayList<>();
            for (Future<Throwable> f : futures) { Throwable t = f.get(20, TimeUnit.SECONDS); if (t != null) errors.add(t); }
            assertTrue(errors.isEmpty(), "并发删除失败：" + errors);
            for (String id : ids) assertNotNull(works.findById(id).orElseThrow().getDeletedAt());
        } finally { go.countDown(); pool.shutdownNow(); }
    }

    /** 恢复同理：池子被占满、各自持着作品行锁时恢复，不需要第二条连接。 */
    @Test void restoresInsideHeldConnectionsDoNotNeedASecondOne() throws Exception {
        String u = "pool-" + UUID.randomUUID().toString().substring(0, 8);
        List<String> ids = List.of(work(u), work(u), work(u));
        for (String id : ids) director.delete(u, id);
        CountDownLatch held = new CountDownLatch(ids.size());
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(ids.size());
        try {
            List<Future<Throwable>> futures = new ArrayList<>();
            for (String id : ids) futures.add(pool.submit(() -> {
                try {
                    new TransactionTemplate(tx).executeWithoutResult(s -> {
                        works.lockById(id).orElseThrow();
                        held.countDown();
                        try { if (!go.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("barrier"); }
                        catch (InterruptedException e) { throw new RuntimeException(e); }
                        director.restore(u, id);
                    });
                    return null;
                } catch (Throwable t) { return t; }
            }));
            assertTrue(held.await(10, TimeUnit.SECONDS), "三条连接都应被占住");
            go.countDown();
            List<Throwable> errors = new ArrayList<>();
            for (Future<Throwable> f : futures) { Throwable t = f.get(20, TimeUnit.SECONDS); if (t != null) errors.add(t); }
            assertTrue(errors.isEmpty(), "并发恢复失败：" + errors);
            for (String id : ids) assertNull(works.findById(id).orElseThrow().getDeletedAt());
        } finally { go.countDown(); pool.shutdownNow(); }
    }

    /** 控制器的真实调用形态：多于池容量的并发删除各自起事务，排队拿连接，全部完成。 */
    @Test void moreConcurrentDeletesThanConnectionsAllComplete() throws Exception {
        String u = "pool-" + UUID.randomUUID().toString().substring(0, 8);
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 9; i++) ids.add(work(u));
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(ids.size());
        try {
            List<Future<Throwable>> futures = new ArrayList<>();
            for (String id : ids) futures.add(pool.submit(() -> {
                try { go.await(); director.delete(u, id); return null; } catch (Throwable t) { return t; }
            }));
            go.countDown();
            List<Throwable> errors = new ArrayList<>();
            for (Future<Throwable> f : futures) { Throwable t = f.get(30, TimeUnit.SECONDS); if (t != null) errors.add(t); }
            assertTrue(errors.isEmpty(), "并发删除失败：" + errors);
            for (String id : ids) assertNotNull(works.findById(id).orElseThrow().getDeletedAt());
        } finally { pool.shutdownNow(); }
    }
}
