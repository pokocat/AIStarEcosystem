package com.aistareco.aep.service;

import com.aistareco.aep.model.LedgerEntry.LedgerEntryType;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.WalletRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 钱包桶纯度（v2 M2）+ 悲观行锁并发安全（评审遗留 #3「无并发集成测试」）的真实集成验证。
 *
 * <ul>
 *   <li><b>M2 桶纯度</b>：INCOME / REFUND（积分面，非现金）落 gift 桶而非 recharge 现金桶；
 *       并验证非现金积分**结构上够不到现金退款**（{@link CreditService#refundCashReclaim} 的
 *       「rechargeBalance = 未消费现金充值额」不变量真实成立）。</li>
 *   <li><b>并发锁</b>：多线程同时写同一钱包，悲观行锁（{@code SELECT ... FOR UPDATE}）串行化
 *       read-modify-write → <b>无 lost update</b>。无锁时并发增量会相互覆盖、终值 &lt; 期望。</li>
 * </ul>
 *
 * <p>不加类级 {@code @Transactional}：并发测试需要每线程<b>真实提交</b>的独立事务（外层事务会让
 * 子线程看不到未提交数据、且 FOR UPDATE 自我死锁）。各测试用唯一 {@code userId} 互不干扰。
 * 强制 {@code aep.cdn.driver=local} 让全上下文不受本地 .env 的 OSS 配置干扰；{@code LOCK_TIMEOUT}
 * 抬高以容纳串行化等待。
 */
@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:wallet-conc;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true",
        "aep.cdn.driver=local"
})
class WalletBucketAndConcurrencyTest {

    @Autowired private CreditService creditService;
    @Autowired private WalletRepository walletRepo;

    private String freshUser() {
        return "wt-" + UUID.randomUUID();
    }

    // ---------------- M2：桶纯度 ----------------

    @Test
    void incomeAndRefundCreditsLandInGiftNotRechargeBucket() {
        String userId = freshUser();
        creditService.creditAccount(userId, 500, LedgerEntryType.INCOME, "test_income", "i-1", "业务收益");
        creditService.creditAccount(userId, 300, LedgerEntryType.REFUND, "test_refund", "r-1", "积分面退款");

        Wallet w = walletRepo.findByUserId(userId).orElseThrow();
        assertEquals(800, w.getGiftBalance(), "INCOME+REFUND 应进 gift 桶");
        assertEquals(0, w.getRechargeBalance(), "现金背书 recharge 桶必须保持纯净（不被非现金积分污染）");
        assertEquals(800, w.getTotalBalance(), "totalBalance 不受桶选择影响（gift 同样计入）");
    }

    @Test
    void nonCashCreditsCannotBeReclaimedAsCashRefund() {
        // INCOME 进 gift 桶 → rechargeBalance 仍为 0 → 现金退款回收无可退（结构上够不到现金）。
        String userId = freshUser();
        creditService.creditAccount(userId, 1000, LedgerEntryType.INCOME, "test_income", "i-2", "业务收益");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> creditService.refundCashReclaim(userId, 1000, "ord-x", "试图把非现金积分当现金退"));
        assertTrue(ex.getStatusCode().value() == 409,
                "非现金积分不可走现金退款回收，应 409；实际 " + ex.getStatusCode());

        // 钱包未被改动：gift 仍 1000，recharge 仍 0。
        Wallet w = walletRepo.findByUserId(userId).orElseThrow();
        assertEquals(1000, w.getGiftBalance());
        assertEquals(0, w.getRechargeBalance());
    }

    @Test
    void rechargeCreditsRemainCashReclaimable_controlCase() {
        // 对照组：真实 RECHARGE 进 recharge 桶 → 可被现金退款回收（证明上面的拒绝不是误杀）。
        String userId = freshUser();
        creditService.creditAccount(userId, 1000, LedgerEntryType.RECHARGE, "recharge_order", "ord-c", "充值");

        creditService.refundCashReclaim(userId, 1000, "ord-c", "全额现金退");
        Wallet w = walletRepo.findByUserId(userId).orElseThrow();
        assertEquals(0, w.getRechargeBalance(), "现金充值额已全额回收");
        assertEquals(0, w.getTotalBalance());
    }

    // ---------------- 评审 #3：悲观锁并发安全 ----------------

    @Test
    void concurrentCreditsDoNotLoseUpdatesUnderPessimisticLock() throws Exception {
        String userId = freshUser();
        creditService.getOrCreateWallet(userId); // 预建钱包，避免并发建行竞态，纯测并发 UPDATE

        int threads = 8;
        long inc = 100;
        runConcurrently(threads, () ->
                creditService.creditAccount(userId, inc, LedgerEntryType.GIFT, "conc_credit",
                        "rc-" + UUID.randomUUID(), "concurrent credit"));

        Wallet w = walletRepo.findByUserId(userId).orElseThrow();
        assertEquals(threads * inc, w.getGiftBalance(),
                "8 个并发 credit 必须全部生效（无 lost update）—— 悲观行锁串行化了 read-modify-write");
        assertEquals(threads * inc, w.getTotalBalance());
    }

    @Test
    void concurrentDebitsDoNotLoseUpdatesUnderPessimisticLock() throws Exception {
        String userId = freshUser();
        creditService.creditAccount(userId, 10_000, LedgerEntryType.GIFT, "seed", "seed-1", "种子余额");

        int threads = 8;
        long dec = 100;
        runConcurrently(threads, () ->
                creditService.debit(userId, dec, "conc_debit", "rd-" + UUID.randomUUID(), "concurrent debit"));

        Wallet w = walletRepo.findByUserId(userId).orElseThrow();
        assertEquals(10_000 - threads * dec, w.getTotalBalance(),
                "8 个并发 debit 必须全部生效（无 lost update）—— 悲观行锁覆盖扣减路径");
    }

    /** 用闸门让 N 个线程尽量同时撞向同一行，最大化竞态；任一线程异常即测试失败。 */
    private void runConcurrently(int threads, Runnable work) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        AtomicInteger errors = new AtomicInteger();
        try {
            for (int i = 0; i < threads; i++) {
                pool.submit(() -> {
                    ready.countDown();
                    try {
                        go.await();
                        work.run();
                    } catch (Throwable t) {
                        errors.incrementAndGet();
                    } finally {
                        done.countDown();
                    }
                });
            }
            assertTrue(ready.await(10, TimeUnit.SECONDS), "线程未就绪");
            go.countDown(); // 同时放行 → 最大竞态
            assertTrue(done.await(30, TimeUnit.SECONDS), "并发任务超时（疑似锁死）");
        } finally {
            pool.shutdownNow();
        }
        assertEquals(0, errors.get(), "并发线程不应有异常（锁超时 / 死锁会落这里）");
    }
}
