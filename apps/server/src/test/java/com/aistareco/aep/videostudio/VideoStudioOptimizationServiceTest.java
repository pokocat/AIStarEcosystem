package com.aistareco.aep.videostudio;

import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.security.InAppOperatorGuard;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimization;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimizationRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioPricingConfig;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.aistareco.aep.videostudio.model.StudioPromptOptimization;
import com.aistareco.aep.videostudio.model.StudioTemplate;
import com.aistareco.aep.videostudio.repository.StudioPromptOptimizationRepository;
import com.aistareco.aep.videostudio.repository.StudioTemplateRepository;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationService;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationSettlement;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationWorker;
import com.aistareco.aep.videostudio.service.VideoStudioPricing;
import com.aistareco.aep.videostudio.service.VideoStudioPricingService;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.aep.videostudio.service.VideoStudioTemplateService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 发起 / 查询智能优化（docs/video-studio-plan.md §9）：与提交生成同一个校验器、同一套错误码；
 * clientRequestId 去重（不重复冻结）；有价才冻结；派发在提交之后；线程池满了当场判失败退钱。
 */
class VideoStudioOptimizationServiceTest {

    private static final String USER = "u1";
    private static final String IMG = "video-studio-image/u1/0123456789abcdef0123456789abcdef.png";
    private static final String AUD = "video-studio-audio/u1/3123456789abcdef0123456789abcdef.mp3";
    private static final String CRID = "click-0001-abcd";

    private final ObjectMapper om = new ObjectMapper();
    private AiModelInvocationService invocation;
    private MaterialVideoModelClient modelClient;
    private VideoStudioPricingService pricing;
    private StudioTemplateRepository templateRepo;
    private StudioPromptOptimizationRepository repo;
    private CreditService credits;
    private VideoStudioOptimizationWorker worker;
    private VideoStudioOptimizationSettlement settlement;
    private PlatformTransactionManager txManager;
    /** 最近一次插入的行：提交后 create 会按 id 再读一遍（拒绝派发时要拿到判失败之后的状态）。 */
    private StudioPromptOptimization inserted;
    private VideoStudioOptimizationService svc;
    private AiAppEndpointCandidate candidate;

    @BeforeEach
    void setUp() {
        invocation = mock(AiModelInvocationService.class);
        modelClient = mock(MaterialVideoModelClient.class);
        pricing = mock(VideoStudioPricingService.class);
        templateRepo = mock(StudioTemplateRepository.class);
        repo = mock(StudioPromptOptimizationRepository.class);
        credits = mock(CreditService.class);
        worker = mock(VideoStudioOptimizationWorker.class);
        settlement = mock(VideoStudioOptimizationSettlement.class);
        txManager = mock(PlatformTransactionManager.class);
        FileStorageService fileStorage = mock(FileStorageService.class);
        MaterialVideoJobRepository jobRepo = mock(MaterialVideoJobRepository.class);
        VideoStudioTemplateService templates = new VideoStudioTemplateService(templateRepo, jobRepo, fileStorage,
                mock(InAppOperatorGuard.class), om);
        VideoStudioService studio = new VideoStudioService(invocation, modelClient, mock(MaterialVideoJobService.class),
                jobRepo, fileStorage, mock(CdnUrlSigner.class), mock(FfmpegRunner.class), om, pricing, templates, repo);
        svc = new VideoStudioOptimizationService(studio, repo, credits, worker, settlement, txManager, om);

        AiModelEndpoint h3 = AiModelEndpoint.builder().id("ep-h3").name("MiniMax H3").baseUrl("https://api.jusuanhub.com/v1")
                .model("minimax-h3").billingMode(AiModelBillingMode.PER_SECOND).enabled(true).build();
        candidate = AiAppEndpointCandidate.builder().endpointId("ep-h3").enabled(true).creditCostOverride(40L).build();
        when(invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION))
                .thenReturn(List.of(new AiModelInvocationService.ResolvedEndpoint(h3, candidate, true)));
        when(modelClient.isEndpointReady(h3)).thenReturn(true);
        when(modelClient.isJusuanMedia(h3)).thenReturn(true);
        when(modelClient.protocolDurationBounds(h3)).thenReturn(new MaterialVideoModelClient.DurationBounds(5, 15));
        priceOptimization(0L);
        when(repo.saveAndFlush(any())).thenAnswer(i -> inserted = i.getArgument(0));
        when(repo.findById(anyString())).thenAnswer(i -> Optional.ofNullable(inserted)
                .filter(r -> r.getId().equals(i.getArgument(0))));
        when(repo.findByOwnerUserIdAndClientRequestId(anyString(), anyString())).thenReturn(Optional.empty());
    }

    private void priceOptimization(long perCall) {
        when(pricing.current()).thenReturn(VideoStudioPricing.validate(
                new VideoStudioPricingConfig(new LinkedHashMap<>(), 0, 0L, perCall)));
    }

    private static VideoStudioOptimizationRequest req(String crid, String mode, String prompt, String first,
                                                      List<VideoStudioReferenceInput> refs, String templateId) {
        return new VideoStudioOptimizationRequest(crid, null, mode, prompt, "768p", "9:16", 5, first, null, refs, templateId);
    }

    private static VideoStudioOptimizationRequest t2v() {
        return req(CRID, "t2v", "  一只猫  ", null, null, null);
    }

    private String code(VideoStudioOptimizationRequest r) {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.create(USER, r));
        verify(repo, never()).saveAndFlush(any());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(worker, never()).runAsync(anyString());
        return e.getCode();
    }

    private StudioPromptOptimization saved() {
        ArgumentCaptor<StudioPromptOptimization> row = ArgumentCaptor.forClass(StudioPromptOptimization.class);
        verify(repo).saveAndFlush(row.capture());
        return row.getValue();
    }

    @Test
    @DisplayName("clientRequestId 必须是 8–128 个可见 ASCII，否则 400 VIDEO_STUDIO_REQUEST_ID_INVALID（先于一切校验）")
    void clientRequestIdRules() {
        for (String bad : new String[]{null, "", "short", "x".repeat(129), "has space 123", "中文请求编号12345"}) {
            assertEquals("VIDEO_STUDIO_REQUEST_ID_INVALID", code(req(bad, "v2v", "", null, null, null)), String.valueOf(bad));
        }
        verify(repo, never()).findByOwnerUserIdAndClientRequestId(anyString(), anyString());
    }

    @Test
    @DisplayName("与提交生成同一个校验器、同一套错误码（模式 / 提示词 / 规格 / 素材 / 归属 / 模板）")
    void sameValidatorSameCodes() {
        assertEquals("VIDEO_STUDIO_MODE_INVALID", code(req(CRID, "v2v", "p", null, null, null)));
        assertEquals("VIDEO_STUDIO_PROMPT_REQUIRED", code(req(CRID, "t2v", "   ", null, null, null)));
        assertEquals("VIDEO_STUDIO_PROMPT_TOO_LONG", code(req(CRID, "t2v", "猫".repeat(7001), null, null, null)));
        assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(new VideoStudioOptimizationRequest(CRID, null, "t2v", "p", "1080p",
                "9:16", 5, null, null, null, null)));
        assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(new VideoStudioOptimizationRequest(CRID, null, "t2v", "p", "768p",
                "9:16", 16, null, null, null, null)));
        assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(req(CRID, "t2v", "p", IMG, null, null)));
        assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(req(CRID, "i2v", "p", null, null, null)));
        assertEquals("VIDEO_STUDIO_ASSET_INVALID",
                code(req(CRID, "i2v", "p", "video-studio-image/u2/0123456789abcdef0123456789abcdef.png", null, null)));
        assertEquals("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", code(req(CRID, "t2v", "p", null, null, "vst_nope")));
        assertEquals("VIDEO_STUDIO_MODEL_UNSUPPORTED", code(new VideoStudioOptimizationRequest(CRID, "ep-other", "t2v", "p",
                "768p", "9:16", 5, null, null, null, null)));
    }

    @Test
    @DisplayName("不收费（单价 0）：不冻结；落 queued 记录（原提示词去空白、端点、快照），提交后派发 worker")
    void freeOptimizationQueuesWithoutHold() throws Exception {
        VideoStudioOptimization dto = svc.create(USER, req(CRID, "universal_reference_video", "图1跳舞", null,
                List.of(new VideoStudioReferenceInput("image", IMG), new VideoStudioReferenceInput("audio", AUD)), null));

        StudioPromptOptimization row = saved();
        assertTrue(row.getId().startsWith("vso_") && row.getId().length() >= 8 && row.getId().length() <= 32, row.getId());
        assertEquals(USER, row.getOwnerUserId());
        assertEquals(CRID, row.getClientRequestId());
        assertEquals("ep-h3", row.getEndpointId());
        assertEquals(StudioPromptOptimization.STATUS_QUEUED, row.getStatus());
        assertEquals("图1跳舞", row.getOriginalPrompt());
        assertEquals(0L, row.getCreditsHeld());
        JsonNode spec = om.readTree(row.getSpecJson());
        assertEquals("universal_reference_video", spec.path("generation_mode").asText());
        assertEquals("768p", spec.path("resolution_tier").asText());
        assertEquals("9:16", spec.path("aspect_ratio").asText());
        assertEquals(5, spec.path("seconds").asInt());
        assertEquals(AUD, spec.path("reference_inputs").get(1).path("key").asText());
        assertEquals("[\"图1\",\"音频1\"]", spec.path("labels").toString());
        assertTrue(!spec.has("seed"), "优化不带种子");
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(worker).runAsync(row.getId());

        assertEquals("queued", dto.status());
        assertEquals("图1跳舞", dto.originalPrompt());
        assertNull(dto.optimizedPrompt());
        assertEquals(0L, dto.credits());
    }

    @Test
    @DisplayName("收费：先插行（立刻 flush，占住唯一键）再按 promptOptimizationPerCall 冻结（refId = 记录 id）")
    void paidOptimizationHolds() {
        priceOptimization(5L);
        VideoStudioOptimization dto = svc.create(USER, t2v());
        StudioPromptOptimization row = saved();
        InOrder order = inOrder(repo, credits);
        order.verify(repo).saveAndFlush(row);
        order.verify(credits).hold(eq(USER), eq(5L), eq("video_studio_prompt_optimization"), eq(row.getId()), anyString());
        assertEquals(5L, row.getCreditsHeld());
        assertEquals(5L, dto.credits());
    }

    @Test
    @DisplayName("余额不足（402）：冻结在插行之后抛，同一事务回滚（真库里的效果见 VideoStudioOptimizationTransactionTest），不派发")
    void insufficientBalance() {
        priceOptimization(5L);
        when(credits.hold(anyString(), anyLong(), anyString(), anyString(), anyString()))
                .thenThrow(new BusinessException(HttpStatus.PAYMENT_REQUIRED, "PAYMENT_REQUIRED", "余额不足"));
        assertEquals("PAYMENT_REQUIRED", assertThrows(BusinessException.class, () -> svc.create(USER, t2v())).getCode());
        verify(txManager).rollback(any());
        verify(txManager, never()).commit(any());
        verify(worker, never()).runAsync(anyString());
    }

    @Test
    @DisplayName("同一用户同一 clientRequestId 已有记录 → 原样返回，不再校验、不再冻结、不再派发")
    void idempotentByClientRequestId() {
        StudioPromptOptimization existing = StudioPromptOptimization.builder().id("vso_existing").ownerUserId(USER)
                .clientRequestId(CRID).status(StudioPromptOptimization.STATUS_RUNNING).specJson("{}")
                .originalPrompt("一只猫").creditsHeld(5L).createdAt(Instant.now()).build();
        when(repo.findByOwnerUserIdAndClientRequestId(USER, CRID)).thenReturn(Optional.of(existing));
        priceOptimization(5L);

        VideoStudioOptimization dto = svc.create(USER, req(CRID, "v2v", "", null, null, null));
        assertEquals("vso_existing", dto.id());
        assertEquals("running", dto.status());
        verify(repo, never()).saveAndFlush(any());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(worker, never()).runAsync(anyString());
    }

    @Test
    @DisplayName("同一串的两次请求同时到达，输的那次插行撞唯一键：没走到冻结，读回赢家那条，不报错")
    void concurrentDuplicateReturnsWinner() {
        priceOptimization(5L);
        StudioPromptOptimization winner = StudioPromptOptimization.builder().id("vso_winner").ownerUserId(USER)
                .clientRequestId(CRID).status(StudioPromptOptimization.STATUS_QUEUED).specJson("{}")
                .originalPrompt("一只猫").creditsHeld(5L).createdAt(Instant.now()).build();
        when(repo.findByOwnerUserIdAndClientRequestId(USER, CRID))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(winner));
        when(repo.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uk_vs_opt_owner_request"));

        assertEquals("vso_winner", svc.create(USER, t2v()).id());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(worker, never()).runAsync(anyString());
        verify(txManager).rollback(any());
    }

    @Test
    @DisplayName("撞了完整性约束却读不到赢家（不是重复提交，是别的约束）：原样抛出，不吞")
    void integrityViolationWithoutWinnerIsRethrown() {
        DataIntegrityViolationException other = new DataIntegrityViolationException("NOT NULL owner_user_id");
        when(repo.saveAndFlush(any())).thenThrow(other);
        assertSame(other, assertThrows(DataIntegrityViolationException.class, () -> svc.create(USER, t2v())));
    }

    @Test
    @DisplayName("线程池排满：经结算当场判失败并退冻结（不留永远 queued 的记录），返回提交后再读的那一份")
    void queueFullFailsImmediately() {
        priceOptimization(5L);
        doThrow(new TaskRejectedException("full")).when(worker).runAsync(anyString());
        when(settlement.fail(any(), anyString())).thenAnswer(i -> {
            StudioPromptOptimization r = i.getArgument(0);
            r.setStatus(StudioPromptOptimization.STATUS_FAILED);
            r.setErrorMessage(i.getArgument(1));
            return true;
        });

        VideoStudioOptimization dto = svc.create(USER, t2v());

        StudioPromptOptimization row = saved();
        verify(settlement).fail(row, "现在排队优化的人太多，请稍后再试");
        assertEquals("failed", dto.status());
        assertEquals("现在排队优化的人太多，请稍后再试", dto.errorMessage());
    }

    @Test
    @DisplayName("线程池排满且判失败的结算回滚：请求本身不报错（记录还在 queued，兜底回收会判失败并退冻结）")
    void queueFullSettlementRollbackDoesNotFailTheRequest() {
        priceOptimization(5L);
        doThrow(new TaskRejectedException("full")).when(worker).runAsync(anyString());
        when(settlement.fail(any(), anyString())).thenThrow(new IllegalStateException("账本暂时写不进去"));

        assertEquals("queued", svc.create(USER, t2v()).status());
    }

    @Test
    @DisplayName("做同款：模板素材可以用；模板 id 记进快照")
    void templateMaterialsAccepted() throws Exception {
        String tplImg = "video-studio-image/u9/b123456789abcdef0123456789abcdef.png";
        var recipe = new VideoStudioTemplateService.TemplateRecipe("i2v", "原作", "768p", "9:16", 5, null, null, null,
                List.of(new VideoStudioTemplateService.TemplateRecipe.Material("first_frame", "image", tplImg, "首帧")));
        when(templateRepo.findById("vst_1")).thenReturn(Optional.of(StudioTemplate.builder().id("vst_1").ownerUserId("u9")
                .scope(StudioTemplate.SCOPE_OFFICIAL).status(StudioTemplate.STATUS_ACTIVE).title("t").sourceJobId("j")
                .recipeJson(om.writeValueAsString(recipe)).build()));

        svc.create(USER, req(CRID, "i2v", "动起来", tplImg, null, "vst_1"));
        assertEquals("vst_1", om.readTree(saved().getSpecJson()).path("template_id").asText());
    }

    @Test
    @DisplayName("查询：本人的才看得到，否则 404；成功才给优化结果，失败才给原因")
    void getRules() {
        StudioPromptOptimization ok = StudioPromptOptimization.builder().id("vso_ok").ownerUserId(USER).clientRequestId(CRID)
                .status(StudioPromptOptimization.STATUS_SUCCEEDED).specJson("{}").originalPrompt("一只猫")
                .optimizedPrompt("一只橘猫").errorMessage("stale").creditsHeld(5L)
                .createdAt(Instant.parse("2026-09-30T12:00:00Z")).completedAt(Instant.parse("2026-09-30T12:01:00Z")).build();
        when(repo.findById("vso_ok")).thenReturn(Optional.of(ok));
        VideoStudioOptimization dto = svc.get(USER, "vso_ok");
        assertEquals("一只橘猫", dto.optimizedPrompt());
        assertNull(dto.errorMessage());
        assertEquals("2026-09-30T12:01:00Z", dto.completedAt());

        StudioPromptOptimization failed = StudioPromptOptimization.builder().id("vso_f").ownerUserId(USER).clientRequestId("c2-000000")
                .status(StudioPromptOptimization.STATUS_FAILED).specJson("{}").originalPrompt("p")
                .optimizedPrompt("half").errorMessage("智能优化被拒：banned").build();
        when(repo.findById("vso_f")).thenReturn(Optional.of(failed));
        assertNull(svc.get(USER, "vso_f").optimizedPrompt());
        assertEquals("智能优化被拒：banned", svc.get(USER, "vso_f").errorMessage());

        assertEquals("VIDEO_STUDIO_OPTIMIZATION_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.get("u2", "vso_ok")).getCode());
        assertEquals("VIDEO_STUDIO_OPTIMIZATION_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.get(USER, "vso_missing")).getCode());
        assertEquals("VIDEO_STUDIO_OPTIMIZATION_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.get(USER, null)).getCode());
    }
}
