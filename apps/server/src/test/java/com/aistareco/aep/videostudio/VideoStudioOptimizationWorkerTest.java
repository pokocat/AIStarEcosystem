package com.aistareco.aep.videostudio;

import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.materialvideo.VideoGenSpec;
import com.aistareco.aep.videostudio.model.StudioPromptOptimization;
import com.aistareco.aep.videostudio.repository.StudioPromptOptimizationRepository;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationReaper;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationSettlement;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationWorker;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 智能优化的后台执行、结算与兜底回收（docs/video-studio-plan.md §9）。
 * worker / 回收只负责「什么时候结算、结算成什么」；改状态 + 扣退在 {@link VideoStudioOptimizationSettlement}
 * 一个事务里做完（真事务下的回滚行为见 {@code VideoStudioOptimizationTransactionTest}）。
 */
class VideoStudioOptimizationWorkerTest {

    private static final String REF = "video_studio_prompt_optimization";
    private static final String SPEC = """
            {"generation_mode":"universal_reference_video","resolution_tier":"544p",
             "reference_inputs":[{"media_type":"image","key":"video-studio-image/u1/a.png"}],
             "aspect_ratio":"9:16","seconds":6,"labels":["图1"]}""";

    private StudioPromptOptimizationRepository repo;
    private StudioPromptOptimization row;

    @BeforeEach
    void setUpRow() {
        repo = mock(StudioPromptOptimizationRepository.class);
        row = StudioPromptOptimization.builder().id("vso_1").ownerUserId("u1").clientRequestId("crid-0001")
                .endpointId("ep-h3").status(StudioPromptOptimization.STATUS_QUEUED).specJson(SPEC)
                .originalPrompt("图1跳舞").creditsHeld(5L).createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }

    @Nested
    @DisplayName("worker：开工抢状态，收尾全交给结算")
    class Worker {

        private MaterialVideoModelClient modelClient;
        private VideoStudioOptimizationSettlement settlement;
        private VideoStudioOptimizationWorker worker;

        @BeforeEach
        void setUp() {
            modelClient = mock(MaterialVideoModelClient.class);
            settlement = mock(VideoStudioOptimizationSettlement.class);
            worker = new VideoStudioOptimizationWorker(repo, modelClient, settlement, new ObjectMapper());
            when(repo.findById("vso_1")).thenReturn(Optional.of(row));
            when(repo.claimRunning(eq("vso_1"), any())).thenReturn(1);
            when(settlement.succeed(any(), anyString(), any(), anyString())).thenReturn(true);
            when(settlement.fail(any(), anyString())).thenReturn(true);
        }

        private void vendorReturns(String prompt, String vendorId) {
            when(modelClient.optimizePrompt(anyString(), anyString(), anyInt(), anyString(), anyString(), any(), any()))
                    .thenReturn(new MaterialVideoModelClient.OptimizeResult(prompt, vendorId));
        }

        private void vendorThrows(Throwable t) {
            when(modelClient.optimizePrompt(anyString(), anyString(), anyInt(), anyString(), anyString(), any(), any()))
                    .thenThrow(t);
        }

        @Test
        @DisplayName("成功：快照原样交给 optimizePrompt（键 = 记录 id）→ 结算成成功，账本写「智能优化 · 全能参考」")
        void success() {
            vendorReturns("一只橘猫跳舞", "opt_v1");

            worker.run("vso_1");

            ArgumentCaptor<VideoGenSpec> spec = ArgumentCaptor.forClass(VideoGenSpec.class);
            verify(modelClient).optimizePrompt(eq("vso_1"), eq("图1跳舞"), eq(6), eq("9:16"), eq("u1"), eq("ep-h3"), spec.capture());
            assertEquals("universal_reference_video", spec.getValue().generationMode());
            assertEquals("544p", spec.getValue().resolutionTier());
            assertEquals(1, spec.getValue().references().size());
            verify(settlement).succeed(row, "一只橘猫跳舞", "opt_v1", "智能优化 · 全能参考");
            verify(settlement, never()).fail(any(), anyString());
        }

        @Test
        @DisplayName("测试 mock（临时）：名单里的账号不调厂商，拿带「测试演示」标识的固定改写，照常结算")
        void testMockSkipsTheVendor() {
            com.aistareco.aep.service.materialvideo.VideoStudioTestMock testMock =
                    mock(com.aistareco.aep.service.materialvideo.VideoStudioTestMock.class);
            when(testMock.appliesTo("u1")).thenReturn(true);
            when(testMock.optimizedPrompt("图1跳舞")).thenReturn("【测试演示，未调用厂商】图1跳舞。镜头：…");
            worker.setTestMock(testMock);

            worker.run("vso_1");

            verify(modelClient, never()).optimizePrompt(any(), any(), anyInt(), any(), any(), any(), any());
            verify(settlement).succeed(row, "【测试演示，未调用厂商】图1跳舞。镜头：…", null, "智能优化 · 全能参考");
        }

        @Test
        @DisplayName("没抢到开工（不在排队：已被回收判失败 / 重复派发）→ 不调厂商、不结算")
        void notQueuedAnymore() {
            when(repo.claimRunning(eq("vso_1"), any())).thenReturn(0);
            worker.run("vso_1");
            verify(modelClient, never()).optimizePrompt(any(), any(), anyInt(), any(), any(), any(), any());
            verify(settlement, never()).succeed(any(), any(), any(), any());
            verify(settlement, never()).fail(any(), any());
        }

        @Test
        @DisplayName("结果回来时回收已经判它失败（结算返回 false）→ 结果作废，不再补做任何结算")
        void reaperWonTheRace() {
            vendorReturns("x", null);
            when(settlement.succeed(any(), anyString(), any(), anyString())).thenReturn(false);
            worker.run("vso_1");
            verify(settlement, never()).fail(any(), any());
        }

        @Test
        @DisplayName("成功但结算回滚（扣积分抛异常）：不往外抛、不改判失败，记录留在 running 给兜底回收")
        void successSettlementRolledBackIsLeftForTheReaper() {
            vendorReturns("一只橘猫跳舞", "opt_v1");
            when(settlement.succeed(any(), anyString(), any(), anyString()))
                    .thenThrow(new IllegalStateException("账本暂时写不进去"));
            worker.run("vso_1");
            verify(settlement, never()).fail(any(), any());
        }

        @Test
        @DisplayName("厂商拒绝：失败原因就是「智能优化被拒：厂商原话」，结算成失败（退冻结）")
        void rejected() {
            vendorThrows(BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_STUDIO_OPTIMIZATION_REJECTED",
                    "智能优化被拒：prompt contains a banned term", "status=422"));
            worker.run("vso_1");
            verify(settlement).fail(row, "智能优化被拒：prompt contains a banned term");
            verify(settlement, never()).succeed(any(), any(), any(), any());
        }

        @Test
        @DisplayName("判失败的结算回滚（退冻结抛异常）：不往外抛，记录留给兜底回收")
        void failureSettlementRolledBackIsLeftForTheReaper() {
            vendorThrows(BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_STUDIO_OPTIMIZATION_REJECTED",
                    "智能优化被拒：x", "status=422"));
            when(settlement.fail(any(), anyString())).thenThrow(new IllegalStateException("账本暂时写不进去"));
            worker.run("vso_1");
            verify(settlement).fail(eq(row), anyString());
        }

        @Test
        @DisplayName("重试预算用完：收了钱的写「积分已退回」，不收钱的不提积分")
        void timeoutWording() {
            vendorThrows(BusinessException.wrapped(HttpStatus.GATEWAY_TIMEOUT, "VIDEO_STUDIO_OPTIMIZATION_TIMEOUT",
                    "智能优化超时", "last=409"));
            worker.run("vso_1");
            verify(settlement).fail(row, "智能优化超时，积分已退回");

            row.setCreditsHeld(0L);
            worker.run("vso_1");
            verify(settlement).fail(row, "智能优化超时，请重新优化");
        }

        @Test
        @DisplayName("意外异常：判失败（通用文案，不外泄内部信息）")
        void unexpectedError() {
            vendorThrows(new IllegalStateException("NPE somewhere inside"));
            worker.run("vso_1");
            ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
            verify(settlement).fail(eq(row), message.capture());
            assertFalse(message.getValue().contains("NPE"), message.getValue());
        }
    }

    @Nested
    @DisplayName("结算：先抢状态再动积分，一个事务，不吞异常")
    class Settlement {

        private CreditService credits;
        private VideoStudioOptimizationSettlement settlement;

        @BeforeEach
        void setUp() {
            credits = mock(CreditService.class);
            settlement = new VideoStudioOptimizationSettlement(repo, credits);
            when(repo.finishSucceeded(eq("vso_1"), anyString(), any(), any())).thenReturn(1);
            when(repo.finishFailed(eq("vso_1"), anyString(), any())).thenReturn(1);
            when(repo.finishFailedIfStale(eq("vso_1"), anyString(), any(), any())).thenReturn(1);
        }

        @Test
        @DisplayName("三个方法都是 REQUIRES_NEW：afterCommit 回调里调用也得自己开事务（REQUIRED 会加入已提交的那个）")
        void eachSettlementIsItsOwnTransaction() throws Exception {
            for (var m : List.of(
                    VideoStudioOptimizationSettlement.class.getMethod("succeed", StudioPromptOptimization.class,
                            String.class, String.class, String.class),
                    VideoStudioOptimizationSettlement.class.getMethod("fail", StudioPromptOptimization.class, String.class),
                    VideoStudioOptimizationSettlement.class.getMethod("failIfStale", StudioPromptOptimization.class,
                            String.class, Instant.class))) {
                Transactional tx = m.getAnnotation(Transactional.class);
                assertEquals(Propagation.REQUIRES_NEW, tx == null ? null : tx.propagation(), m.getName());
            }
        }

        @Test
        @DisplayName("成功：改成功返回 1 才按冻结额扣；返回 0（别人先改了）不扣")
        void succeedChargesOnlyWhenItWonTheTransition() {
            assertTrue(settlement.succeed(row, "一只橘猫", "opt_v1", "智能优化 · 全能参考"));
            verify(repo).finishSucceeded(eq("vso_1"), eq("一只橘猫"), eq("opt_v1"), any());
            verify(credits).commitHold(REF, "vso_1", 5L, "智能优化 · 全能参考");

            when(repo.finishSucceeded(eq("vso_1"), anyString(), any(), any())).thenReturn(0);
            assertFalse(settlement.succeed(row, "一只橘猫", "opt_v1", "智能优化 · 全能参考"));
            verify(credits).commitHold(anyString(), anyString(), anyLong(), anyString());   // 仍只有第一次
        }

        @Test
        @DisplayName("扣积分抛异常原样往外抛（让事务回滚），不吞")
        void chargeFailurePropagates() {
            IllegalStateException boom = new IllegalStateException("账本暂时写不进去");
            doThrow(boom).when(credits).commitHold(anyString(), anyString(), anyLong(), anyString());
            assertSame(boom, assertThrows(IllegalStateException.class,
                    () -> settlement.succeed(row, "一只橘猫", null, "智能优化 · 全能参考")));
        }

        @Test
        @DisplayName("失败：改失败返回 1 才退冻结（流水写原因）；返回 0 不退；退冻结抛异常原样往外抛")
        void failReleasesOnlyWhenItWonTheTransition() {
            assertTrue(settlement.fail(row, "智能优化被拒：banned"));
            verify(repo).finishFailed(eq("vso_1"), eq("智能优化被拒：banned"), any());
            verify(credits).releaseHold(eq(REF), eq("vso_1"), startsWith("智能优化失败 · 退回积分 · 智能优化被拒：banned"));

            when(repo.finishFailed(eq("vso_1"), anyString(), any())).thenReturn(0);
            assertFalse(settlement.fail(row, "x"));
            verify(credits).releaseHold(anyString(), anyString(), anyString());   // 仍只有第一次

            when(repo.finishFailed(eq("vso_1"), anyString(), any())).thenReturn(1);
            IllegalStateException boom = new IllegalStateException("账本暂时写不进去");
            doThrow(boom).when(credits).releaseHold(anyString(), anyString(), anyString());
            assertSame(boom, assertThrows(IllegalStateException.class, () -> settlement.fail(row, "x")));
        }

        @Test
        @DisplayName("回收专用的判失败：cutoff 原样交给条件更新；返回 0（刚被 worker 领走，不再卡住）就不退冻结")
        void failIfStaleOnlyReleasesRowsThatAreStillStuck() {
            Instant cutoff = Instant.parse("2026-09-30T11:40:00Z");
            assertTrue(settlement.failIfStale(row, "智能优化超时，积分已退回", cutoff));
            verify(repo).finishFailedIfStale(eq("vso_1"), eq("智能优化超时，积分已退回"), any(), eq(cutoff));
            verify(repo, never()).finishFailed(anyString(), anyString(), any());
            verify(credits).releaseHold(eq(REF), eq("vso_1"), startsWith("智能优化失败 · 退回积分 · 智能优化超时"));

            when(repo.finishFailedIfStale(eq("vso_1"), anyString(), any(), any())).thenReturn(0);
            assertFalse(settlement.failIfStale(row, "智能优化超时，积分已退回", cutoff));
            verify(credits).releaseHold(anyString(), anyString(), anyString());   // 仍只有第一次
        }

        @Test
        @DisplayName("不收费的不碰账本；失败原因为空给通用说法，过长截到 1000 字")
        void freeRowsAndMessages() {
            row.setCreditsHeld(0L);
            assertTrue(settlement.succeed(row, "p", null, "l"));
            assertTrue(settlement.fail(row, " "));
            verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
            verify(credits, never()).releaseHold(anyString(), anyString(), anyString());
            verify(repo).finishFailed(eq("vso_1"), eq("智能优化失败，请稍后重新优化"), any());

            settlement.fail(row, "长".repeat(1500));
            verify(repo).finishFailed(eq("vso_1"), eq("长".repeat(1000)), any());
        }
    }

    @Nested
    @DisplayName("兜底回收")
    class Reaper {

        @Test
        @DisplayName("只扫 updated_at 超过 20 分钟仍 queued / running 的；抢到的才算数；结算回滚的跳过、下一轮再试")
        void sweepsStaleRows() {
            VideoStudioOptimizationSettlement settlement = mock(VideoStudioOptimizationSettlement.class);
            StudioPromptOptimization finished = StudioPromptOptimization.builder().id("vso_2").ownerUserId("u2")
                    .clientRequestId("crid-0002").status(StudioPromptOptimization.STATUS_RUNNING).specJson("{}")
                    .originalPrompt("p").creditsHeld(3L).build();
            StudioPromptOptimization ledgerDown = StudioPromptOptimization.builder().id("vso_3").ownerUserId("u3")
                    .clientRequestId("crid-0003").status(StudioPromptOptimization.STATUS_QUEUED).specJson("{}")
                    .originalPrompt("p").creditsHeld(0L).build();
            when(repo.findByStatusInAndUpdatedAtBefore(any(), any())).thenReturn(List.of(ledgerDown, row, finished));
            when(settlement.failIfStale(eq(ledgerDown), anyString(), any())).thenThrow(new IllegalStateException("账本暂时写不进去"));
            when(settlement.failIfStale(eq(row), anyString(), any())).thenReturn(true);
            when(settlement.failIfStale(eq(finished), anyString(), any())).thenReturn(false);   // worker 刚好先结束了 / 刚领走
            Instant now = Instant.parse("2026-09-30T12:00:00Z");

            int n = new VideoStudioOptimizationReaper(repo, settlement).sweep(now);

            assertEquals(1, n);
            @SuppressWarnings("unchecked")
            ArgumentCaptor<Collection<String>> statuses = ArgumentCaptor.forClass(Collection.class);
            ArgumentCaptor<Instant> cutoff = ArgumentCaptor.forClass(Instant.class);
            verify(repo).findByStatusInAndUpdatedAtBefore(statuses.capture(), cutoff.capture());
            assertEquals(List.of("queued", "running"), List.copyOf(statuses.getValue()));
            assertEquals(now.minus(Duration.ofMinutes(20)), cutoff.getValue());
            // 结算时带同一个 cutoff 再判一次「还卡着」；不走不带时间条件的 fail
            verify(settlement).failIfStale(row, "智能优化超时，积分已退回", cutoff.getValue());
            verify(settlement).failIfStale(ledgerDown, "智能优化超时，请重新优化", cutoff.getValue());
            verify(settlement, never()).fail(any(), anyString());
        }
    }
}
