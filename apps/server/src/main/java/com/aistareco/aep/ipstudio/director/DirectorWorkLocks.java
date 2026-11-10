package com.aistareco.aep.ipstudio.director;

import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/**
 * 导演台作品在进程内排队：开事务、拿数据库连接之前，先按作品 id 拿这把锁。
 *
 * <p>为什么要有它（2026-11-10 线上事故，PR 187 评审）：作品的读写都要给作品行加 {@code SELECT … FOR UPDATE}，
 * 持锁时还有地方要第二条连接（任务提交走独立事务）。同一部作品的并发请求各自先拿一条连接再去等行锁，
 * 连接池被「占着连接等锁」的请求占满，持锁的那个等不到第二条连接，大家轮流超时。现在同一部作品的请求在这里
 * （内存里）等，不占连接；拿到这把锁的请求才开事务、加行锁。数据库行锁照留，多实例时仍然正确。
 *
 * <ul>
 *   <li><b>必须在事务外拿</b>：在事务里拿就又是「占着连接等锁」。在事务里第一次拿（不是重入）打 WARN，
 *       开了断言（测试）时直接失败。</li>
 *   <li><b>可重入、有超时</b>：{@link ReentrantLock#tryLock(long, TimeUnit)}，等不到回 503 {@value #TIMEOUT_CODE}。
 *       默认 15 秒：比 Hikari 取连接超时（30 秒）和 MySQL 锁等待（50 秒）都短，排着的请求早点放掉 Tomcat 线程；
 *       又比锁内最慢的正常操作（几秒的厂商上传）留足余量。</li>
 *   <li><b>不泄漏</b>：固定 {@value #STRIPES} 把锁按 id 取模，不是每部作品一把。不同作品偶尔共用一把只是一起排队；
 *       没有路径同时拿两部作品，所以不会因此死锁。</li>
 *   <li><b>只管单实例</b>：上多实例之前，必须把锁内的任务提交改成锁内只记意图、锁外提交（见 TODO.md）。</li>
 * </ul>
 *
 * <p>可选的全局上限（{@code aep.director.work-lock.max-concurrent}，默认 0 = 关）：同时持有作品锁的请求数，
 * 设为连接池的一半以下时，即使不同作品同时各要第二条连接也凑不满连接池；代价是导演台整体并发被限住。
 */
@Component
public class DirectorWorkLocks {
    private static final Logger log = LoggerFactory.getLogger(DirectorWorkLocks.class);
    public static final String TIMEOUT_CODE = "DIRECTOR_WORK_LOCK_TIMEOUT";
    static final int STRIPES = 256;

    private final ReentrantLock[] stripes = new ReentrantLock[STRIPES];
    private final long timeoutMs;
    private final Semaphore holders;
    private final ThreadLocal<Integer> permits = ThreadLocal.withInitial(() -> 0);

    public DirectorWorkLocks(@Value("${aep.director.work-lock.timeout-ms:15000}") long timeoutMs,
                             @Value("${aep.director.work-lock.max-concurrent:0}") int maxConcurrent) {
        for (int i = 0; i < STRIPES; i++) stripes[i] = new ReentrantLock();
        this.timeoutMs = Math.max(1, timeoutMs);
        this.holders = maxConcurrent > 0 ? new Semaphore(maxConcurrent, true) : null;
    }

    /** 不经 Spring 构造时（单元测试直接 new DirectorService）用的默认值。 */
    public static DirectorWorkLocks standalone() { return new DirectorWorkLocks(15_000, 0); }

    static int stripeOf(String workId) { return Math.floorMod(workId == null ? 0 : workId.hashCode(), STRIPES); }

    private ReentrantLock stripe(String workId) { return stripes[stripeOf(workId)]; }

    /** 拿着这部作品的锁执行 body（body 里自己开事务）。 */
    public <T> T withWork(String workId, Supplier<T> body) {
        ReentrantLock lock = stripe(workId);
        boolean reentrant = lock.isHeldByCurrentThread();
        if (!reentrant && TransactionSynchronizationManager.isActualTransactionActive()) {
            log.warn("[director] 在事务里等作品锁（会占着连接排队），应在开事务之前拿 work={}", workId);
            assert false : "在事务里第一次拿作品锁：应在开事务之前拿（DirectorWorkLocks）work=" + workId;
        }
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs);
        try {
            if (!lock.tryLock(timeoutMs, TimeUnit.MILLISECONDS)) throw timeout(workId);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw timeout(workId);
        }
        boolean permit = false;
        try {
            if (holders != null && permits.get() == 0) {
                long left = Math.max(0, deadline - System.nanoTime());
                try { permit = holders.tryAcquire(left, TimeUnit.NANOSECONDS); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                if (!permit) throw timeout(workId);
                permits.set(1);
            }
            return body.get();
        } finally {
            if (permit) { permits.set(0); holders.release(); }
            lock.unlock();
        }
    }

    public void runWithWork(String workId, Runnable body) {
        withWork(workId, () -> { body.run(); return null; });
    }

    /** 给作品行加锁之前调：没拿着进程内的作品锁就是漏了入口（打 WARN，开了断言时失败）。 */
    void requireHeld(String workId) {
        if (stripe(workId).isHeldByCurrentThread()) return;
        log.warn("[director] 给作品行加锁时没有先拿进程内的作品锁 work={}", workId);
        assert false : "给作品行加锁之前要先拿 DirectorWorkLocks：work=" + workId;
    }

    private static BusinessException timeout(String workId) {
        log.warn("[director] 等作品锁超时 work={}", workId);
        return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, TIMEOUT_CODE, "作品正在处理，请稍后重试");
    }
}
