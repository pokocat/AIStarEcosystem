package com.aistareco.aep.videostudio;

import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.model.LedgerEntry.LedgerEntryType;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.CreditHoldRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.WalletRepository;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimization;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimizationRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioPricingConfig;
import com.aistareco.aep.videostudio.model.StudioPromptOptimization;
import com.aistareco.aep.videostudio.repository.StudioPromptOptimizationRepository;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationReaper;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationService;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationSettlement;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationWorker;
import com.aistareco.aep.videostudio.service.VideoStudioPricingService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.AopTestUtils;
import org.springframework.web.server.ResponseStatusException;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

/**
 * 智能优化的钱路径用<b>真事务</b>跑：Spring 上下文 + H2（MySQL 模式）+ 真的 CreditService / 仓库 / worker / 回收，
 * 事务管理器不是替身。钉住三件事：
 * <ol>
 *   <li>结算原子：改状态和扣 / 退在同一个事务里。扣 / 退抛异常就整个回滚，记录留在 running，冻结原样，兜底回收还能收拾；</li>
 *   <li>线程池拒绝派发：外层事务提交以后，那条记录确实是 failed、冻结确实是 RELEASED
 *       （afterCommit 回调里的写必须自己开新事务，加入那个已经提交的事务等于没写）；</li>
 *   <li>同一 clientRequestId 两个请求同时到、余额只够一次：两边拿到同一条记录，而不是一边 402。</li>
 * </ol>
 *
 * <p>只换掉三样外部的东西：厂商（{@link MaterialVideoModelClient}）、模型目录（{@link AiModelInvocationService}）和
 * 优化线程池。线程池替身默认什么都不跑（记录停在 queued，测试自己决定什么时候跑 worker）；拒绝用例让它抛
 * {@link TaskRejectedException}，走的是真的 {@code @Async} 派发路径。CreditService 是 spy：默认全走真实现，
 * 个别用例让它在指定那一笔上抛异常，或在冻结前停一下好让并发真的撞上。
 *
 * <p>不加类级 {@code @Transactional}（同 {@code WalletBucketAndConcurrencyTest}）：要的就是每一步真实提交。
 */
@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:vs-opt-tx;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true",
        "aep.cdn.driver=local"
})
class VideoStudioOptimizationTransactionTest {

    private static final String REF = "video_studio_prompt_optimization";
    private static final long PRICE = 8L;
    /** 回收判失败时的说法（收了钱的）。回收扫的是整个库 —— 同一个 H2 里还有别的用例留下的 queued 记录 ——
     *  所以用例只看自己那一条的结果和说法，不看回收报的条数。 */
    private static final String TIMEOUT_REFUNDED = "智能优化超时，积分已退回";

    @MockBean(name = "videoStudioOptimizationExecutor") private ThreadPoolTaskExecutor optimizationExecutor;
    @MockBean private AiModelInvocationService invocation;
    @MockBean private MaterialVideoModelClient modelClient;
    @SpyBean private CreditService credits;

    @Autowired private VideoStudioOptimizationService optimizations;
    @Autowired private VideoStudioOptimizationWorker worker;
    @Autowired private VideoStudioOptimizationReaper reaper;
    @Autowired private VideoStudioOptimizationSettlement settlement;
    @Autowired private VideoStudioPricingService pricing;
    @Autowired private StudioPromptOptimizationRepository repo;
    @Autowired private CreditHoldRepository holds;
    @Autowired private LedgerEntryRepository ledger;
    @Autowired private WalletRepository wallets;
    @Autowired private DataSource dataSource;

    private final String user = "vs-tx-" + UUID.randomUUID();

    @BeforeEach
    void setUp() {
        AiModelEndpoint h3 = AiModelEndpoint.builder().id("ep-h3").name("MiniMax H3").baseUrl("https://api.jusuanhub.com/v1")
                .model("minimax-h3").billingMode(AiModelBillingMode.PER_SECOND).enabled(true).build();
        AiAppEndpointCandidate candidate = AiAppEndpointCandidate.builder().endpointId("ep-h3").enabled(true)
                .creditCostOverride(40L).build();
        when(invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION))
                .thenReturn(List.of(new AiModelInvocationService.ResolvedEndpoint(h3, candidate, true)));
        when(modelClient.isEndpointReady(any())).thenReturn(true);
        when(modelClient.isJusuanMedia(any())).thenReturn(true);
        when(modelClient.protocolDurationBounds(any())).thenReturn(new MaterialVideoModelClient.DurationBounds(5, 15));
        pricing.replace(new VideoStudioPricingConfig(new LinkedHashMap<>(), 0, 0L, PRICE), "test");
    }

    // ── 2. 线程池拒绝派发 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("线程池拒绝派发：外层事务提交之后，记录是 failed、冻结是 RELEASED、余额原样，返回的也是 failed")
    void rejectedDispatchIsFailedAndReleasedAfterTheOuterCommit() {
        fund(PRICE);
        when(optimizationExecutor.submit(ArgumentMatchers.<Callable<Object>>any()))
                .thenThrow(new TaskRejectedException("队列已满"));

        VideoStudioOptimization dto = optimizations.create(user, t2v(newCrid()));

        assertEquals(StudioPromptOptimization.STATUS_FAILED, row(dto.id()).getStatus());
        assertEquals(CreditHold.Status.RELEASED, hold(dto.id()).getStatus());
        assertEquals(1, entries(dto.id(), LedgerEntryType.UNFREEZE));
        assertEquals(PRICE, wallet().getTotalBalance());
        assertEquals(0, wallet().getPendingBalance());
        assertEquals("failed", dto.status(), "返回给前端的是提交之后库里的状态，不是提交前那一份");
    }

    // ── 3. 同一 clientRequestId 并发 ─────────────────────────────────────────────

    @Test
    @DisplayName("同一 clientRequestId 两个请求同时到、余额只够一次：两边拿到同一条记录，只冻结一次")
    void concurrentSameRequestIdWithBalanceForOneReturnsTheSameRecord() throws Exception {
        fund(PRICE);
        String crid = newCrid();
        CountDownLatch firstHolding = new CountDownLatch(1);
        AtomicBoolean first = new AtomicBoolean(true);
        AtomicBoolean secondWaitedOnTheKey = new AtomicBoolean(false);
        doAnswer(inv -> {
            if (user.equals(inv.getArgument(0)) && first.compareAndSet(true, false)) {
                firstHolding.countDown();
                // 走到这里时第一个请求的行已经 flush：唯一键被它占着、还没提交。等第二个请求真的卡在自己的插入上
                // 再往下走 —— 这样测到的一定是「撞唯一键再读回」那条路，而不是第二个请求来晚了、开头就查到了已提交的记录。
                secondWaitedOnTheKey.set(awaitAnotherSessionInsertingAnOptimization(Duration.ofSeconds(10)));
            }
            return inv.callRealMethod();
        }).when(creditTarget()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<VideoStudioOptimization> a = pool.submit(() -> optimizations.create(user, t2v(crid)));
            assertTrue(firstHolding.await(10, TimeUnit.SECONDS), "第一个请求没有走到冻结");
            Future<VideoStudioOptimization> b = pool.submit(() -> optimizations.create(user, t2v(crid)));
            VideoStudioOptimization ra = a.get(30, TimeUnit.SECONDS);
            VideoStudioOptimization rb = b.get(30, TimeUnit.SECONDS);

            assertTrue(secondWaitedOnTheKey.get(), "第二个请求没有卡在唯一键上，这次没测到并发");
            assertEquals(ra.id(), rb.id());
            assertEquals(ra.id(), repo.findByOwnerUserIdAndClientRequestId(user, crid).orElseThrow().getId());
            assertEquals(CreditHold.Status.ACTIVE, hold(ra.id()).getStatus());
            assertEquals(PRICE, hold(ra.id()).getAmount());
            assertEquals(1, ledger.findByUserIdOrderByCreatedAtDesc(user).stream()
                    .filter(e -> REF.equals(e.getReferenceType()) && e.getEntryType() == LedgerEntryType.FREEZE).count());
            assertEquals(0, wallet().getTotalBalance());
            assertEquals(PRICE, wallet().getPendingBalance());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("余额不足：先插的那一行随 402 一起回滚，不留记录、不留冻结；同一个 clientRequestId 充值后还能用")
    void holdFailureRollsBackTheInsertedRow() {
        String crid = newCrid();

        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> optimizations.create(user, t2v(crid)));

        assertEquals(HttpStatus.PAYMENT_REQUIRED.value(), e.getStatusCode().value());
        assertTrue(repo.findByOwnerUserIdAndClientRequestId(user, crid).isEmpty(), "402 之后不该留下记录");
        assertTrue(ledger.findByUserIdOrderByCreatedAtDesc(user).stream().noneMatch(x -> REF.equals(x.getReferenceType())));

        fund(PRICE);
        VideoStudioOptimization dto = optimizations.create(user, t2v(crid));
        assertEquals("queued", dto.status());
        assertEquals(CreditHold.Status.ACTIVE, hold(dto.id()).getStatus());
    }

    // ── 1. 结算原子 ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("成功：改成 succeeded 与扣积分一起提交；重复派发、兜底回收都不会再结算一次")
    void successCommitsStatusAndChargeTogether() {
        fund(PRICE);
        String id = optimizations.create(user, t2v(newCrid())).id();
        vendorReturns("一只橘猫在窗台上伸懒腰，阳光从左边照进来");

        worker.run(id);

        StudioPromptOptimization r = row(id);
        assertEquals(StudioPromptOptimization.STATUS_SUCCEEDED, r.getStatus());
        assertEquals("一只橘猫在窗台上伸懒腰，阳光从左边照进来", r.getOptimizedPrompt());
        assertEquals(CreditHold.Status.COMMITTED, hold(id).getStatus());
        assertEquals(0, wallet().getTotalBalance());
        assertEquals(0, wallet().getPendingBalance());

        worker.run(id);
        reaper.sweep(afterTheReaperThreshold());
        assertEquals(StudioPromptOptimization.STATUS_SUCCEEDED, row(id).getStatus());
        assertEquals(CreditHold.Status.COMMITTED, hold(id).getStatus());
        assertEquals(1, entries(id, LedgerEntryType.SPEND));
        assertEquals(0, entries(id, LedgerEntryType.UNFREEZE));
    }

    @Test
    @DisplayName("优化成功但扣积分抛异常：成功也一起回滚，记录仍是 running、冻结还在；回收随后判失败并退冻结")
    void chargeFailureRollsBackTheSuccessAndTheReaperRecoversIt() {
        fund(PRICE);
        String id = optimizations.create(user, t2v(newCrid())).id();
        vendorReturns("优化后的提示词");
        doThrow(new IllegalStateException("账本暂时写不进去"))
                .when(creditTarget()).commitHold(eq(REF), eq(id), anyLong(), anyString());

        worker.run(id);

        StudioPromptOptimization r = row(id);
        assertEquals(StudioPromptOptimization.STATUS_RUNNING, r.getStatus(), "扣不下来，成功就不该落库");
        assertNull(r.getOptimizedPrompt());
        assertEquals(CreditHold.Status.ACTIVE, hold(id).getStatus());
        assertEquals(PRICE, wallet().getPendingBalance());

        Mockito.reset(creditTarget());
        reaper.sweep(afterTheReaperThreshold());
        assertEquals(StudioPromptOptimization.STATUS_FAILED, row(id).getStatus());
        assertEquals(TIMEOUT_REFUNDED, row(id).getErrorMessage(), "是回收把它判失败的");
        assertEquals(CreditHold.Status.RELEASED, hold(id).getStatus());
        assertEquals(PRICE, wallet().getTotalBalance());
        assertEquals(0, wallet().getPendingBalance());
        assertEquals(0, entries(id, LedgerEntryType.SPEND));
    }

    @Test
    @DisplayName("厂商拒绝但退冻结抛异常：判失败也一起回滚（不会显示已退回却还冻着）；回收随后退掉")
    void releaseFailureRollsBackTheFailureAndTheReaperRecoversIt() {
        fund(PRICE);
        String id = optimizations.create(user, t2v(newCrid())).id();
        when(modelClient.optimizePrompt(anyString(), anyString(), anyInt(), any(), any(), any(), any()))
                .thenThrow(BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_STUDIO_OPTIMIZATION_REJECTED",
                        "智能优化被拒：提示词里有不允许的内容", "status=422"));
        doThrow(new IllegalStateException("账本暂时写不进去"))
                .when(creditTarget()).releaseHold(eq(REF), eq(id), anyString());

        worker.run(id);

        StudioPromptOptimization r = row(id);
        assertEquals(StudioPromptOptimization.STATUS_RUNNING, r.getStatus(), "退不掉，失败就不该落库");
        assertNull(r.getErrorMessage());
        assertEquals(CreditHold.Status.ACTIVE, hold(id).getStatus());

        Mockito.reset(creditTarget());
        reaper.sweep(afterTheReaperThreshold());
        assertEquals(StudioPromptOptimization.STATUS_FAILED, row(id).getStatus());
        assertEquals(TIMEOUT_REFUNDED, row(id).getErrorMessage(), "是回收把它判失败的");
        assertEquals(CreditHold.Status.RELEASED, hold(id).getStatus());
        assertEquals(PRICE, wallet().getTotalBalance());
    }

    @Test
    @DisplayName("厂商还在算时回收先判了失败并退了冻结：迟到的结果作废，不再扣")
    void lateResultAfterTheReaperIsDiscarded() {
        fund(PRICE);
        String id = optimizations.create(user, t2v(newCrid())).id();
        AtomicInteger reapedWhileWaiting = new AtomicInteger(-1);
        when(modelClient.optimizePrompt(anyString(), anyString(), anyInt(), any(), any(), any(), any())).thenAnswer(inv -> {
            // 不在这里断言：断言失败抛的是 Error，会被 worker 当成厂商异常走失败路径，让用例假绿。
            reapedWhileWaiting.set(reaper.sweep(afterTheReaperThreshold()));
            return new MaterialVideoModelClient.OptimizeResult("迟到的结果", null);
        });

        worker.run(id);

        assertTrue(reapedWhileWaiting.get() >= 1, "回收没跑到");
        StudioPromptOptimization r = row(id);
        assertEquals(StudioPromptOptimization.STATUS_FAILED, r.getStatus());
        assertEquals(TIMEOUT_REFUNDED, r.getErrorMessage(), "是回收把它判失败的，不是 worker");
        assertNull(r.getOptimizedPrompt());
        assertEquals(CreditHold.Status.RELEASED, hold(id).getStatus());
        assertEquals(0, entries(id, LedgerEntryType.SPEND));
        assertEquals(PRICE, wallet().getTotalBalance());
    }

    @Test
    @DisplayName("回收列出卡住的记录之后、逐条结算之前，worker 刚把其中一条领走：这条不判失败、不退冻结（Codex 三轮 P2）")
    void reaperDoesNotFailARowTheWorkerJustClaimed() {
        fund(PRICE);
        String id = optimizations.create(user, t2v(newCrid())).id();
        Instant reaperNow = afterTheReaperThreshold();
        Instant cutoff = reaperNow.minus(Duration.ofMinutes(20));

        // 回收这一轮先列出卡住的记录（排队超过 20 分钟的这一条在里面）……
        StudioPromptOptimization listed = repo.findByStatusInAndUpdatedAtBefore(
                        List.of(StudioPromptOptimization.STATUS_QUEUED, StudioPromptOptimization.STATUS_RUNNING), cutoff)
                .stream().filter(r -> id.equals(r.getId())).findFirst().orElseThrow();
        // ……这时 worker 刚好领走它（updated_at 刷新到回收的「现在」，正在调厂商）……
        assertEquals(1, repo.claimRunning(id, reaperNow));
        // ……回收再按列出来的那份去结算
        assertFalse(settlement.failIfStale(listed, TIMEOUT_REFUNDED, cutoff), "刚开工的不该被判失败");

        StudioPromptOptimization r = row(id);
        assertEquals(StudioPromptOptimization.STATUS_RUNNING, r.getStatus());
        assertNull(r.getErrorMessage());
        assertEquals(CreditHold.Status.ACTIVE, hold(id).getStatus());
        assertEquals(PRICE, wallet().getPendingBalance());

        // worker 的结果回来照常结算成成功、扣一次
        assertTrue(settlement.succeed(r, "优化后的提示词", "opt_v1", "智能优化 · 文生视频"));
        assertEquals(StudioPromptOptimization.STATUS_SUCCEEDED, row(id).getStatus());
        assertEquals(CreditHold.Status.COMMITTED, hold(id).getStatus());
        assertEquals(1, entries(id, LedgerEntryType.SPEND));
        assertEquals(0, entries(id, LedgerEntryType.UNFREEZE));
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private void fund(long amount) {
        credits.creditAccount(user, amount, LedgerEntryType.GIFT, "seed", "seed-" + UUID.randomUUID(), "测试余额");
    }

    private static String newCrid() {
        return "crid-" + UUID.randomUUID();
    }

    private static VideoStudioOptimizationRequest t2v(String crid) {
        return new VideoStudioOptimizationRequest(crid, null, "t2v", "一只猫在窗台上伸懒腰", "768p", "9:16", 5,
                null, null, null, null);
    }

    private void vendorReturns(String optimizedPrompt) {
        when(modelClient.optimizePrompt(anyString(), anyString(), anyInt(), any(), any(), any(), any()))
                .thenReturn(new MaterialVideoModelClient.OptimizeResult(optimizedPrompt, "opt_v1"));
    }

    /** spy 本体（事务代理里面那一层）：在它上面打桩，调用仍然经过事务代理。 */
    private CreditService creditTarget() {
        return AopTestUtils.getUltimateTargetObject(credits);
    }

    private static Instant afterTheReaperThreshold() {
        return Instant.now().plus(Duration.ofMinutes(21));
    }

    private StudioPromptOptimization row(String id) {
        return repo.findById(id).orElseThrow();
    }

    private CreditHold hold(String id) {
        return holds.findByReferenceTypeAndReferenceId(REF, id).orElseThrow();
    }

    private Wallet wallet() {
        return wallets.findByUserId(user).orElseThrow();
    }

    private long entries(String id, LedgerEntryType type) {
        return ledger.findByUserIdOrderByCreatedAtDesc(user).stream()
                .filter(e -> id.equals(e.getReferenceId()) && e.getEntryType() == type)
                .count();
    }

    /**
     * 另一个会话正在执行「插入优化记录」：H2 会让撞上未提交同一唯一键的插入一直等到对方提交或回滚
     * （与 InnoDB 一致；会话状态是 RUNNING，语句停在 INSERT 上，BLOCKER_ID 不填），所以看到它就说明它卡在键上。
     */
    private boolean awaitAnotherSessionInsertingAnOptimization(Duration timeout) throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM INFORMATION_SCHEMA.SESSIONS "
                     + "WHERE LOWER(EXECUTING_STATEMENT) LIKE 'insert into video_studio_prompt_optimization%'")) {
            while (System.nanoTime() < deadline) {
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next() && rs.getInt(1) > 0) return true;
                }
                Thread.sleep(20);
            }
        }
        return false;
    }
}
