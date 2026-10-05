package com.aistareco.aep.service;

import com.aistareco.aep.dto.DramaCanvasRunDto;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasAssembleRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageBatchBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageBatchItem;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageTarget;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasScriptRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasStoryboardRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasVideoRunBody;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaCanvas;
import com.aistareco.aep.model.DramaCanvasRun;
import com.aistareco.aep.repository.DramaCanvasRepository;
import com.aistareco.aep.repository.DramaCanvasRunRepository;
import com.aistareco.aep.repository.StorageAssetRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static com.aistareco.aep.service.DramaCanvasRunTestSupport.CANVAS;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.OM;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.USER;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.inMemoryRuns;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.resourcePrompts;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.sampleDoc;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.*;

/**
 * 画布生成提交（DramaCanvasRunService）：幂等、版本、归属闸、各种 preflight 都在冻结之前、派发挂 afterCommit、
 * 视频首帧写进 first_frame_key、合成缺视频 400、取消规则。
 *
 * <p>用真的 DramaCanvasService / DramaCanvasOwnership / DramaCanvasPromptBuilder（模板走 resources 默认），
 * 仓库是内存版（条件更新 + 唯一键），事务管理器是会真触发 afterCommit 的最小实现。
 */
class DramaCanvasRunServiceTest {

    private final Map<String, DramaCanvasRun> store = new LinkedHashMap<>();
    private final DramaCanvasRunRepository runs = inMemoryRuns(store);
    private final DramaCanvasRepository canvasRepo = mock(DramaCanvasRepository.class);
    private final StorageAssetRepository assets = mock(StorageAssetRepository.class);
    private final DramaCanvasOwnership ownership = new DramaCanvasOwnership(assets);
    private final CdnUrlSigner signer = mock(CdnUrlSigner.class);
    private final DramaCanvasService canvases = new DramaCanvasService(canvasRepo, ownership, signer, OM);
    private final DramaCanvasRunWorker worker = mock(DramaCanvasRunWorker.class);
    private final DramaRenderService render = mock(DramaRenderService.class);
    private final PlatformConfigService configs = mock(PlatformConfigService.class);
    private final CreditService credits = mock(CreditService.class);
    private final AiModelInvocationService invocation = mock(AiModelInvocationService.class);
    private final MaterialVideoJobService videoJobs = mock(MaterialVideoJobService.class);
    private final MaterialVideoModelClient videoModels = mock(MaterialVideoModelClient.class);
    private final StorageQuotaService storage = mock(StorageQuotaService.class);
    private final DramaCanvasRunTestSupport.TestTxManager tm = new DramaCanvasRunTestSupport.TestTxManager();
    private final DramaCanvasRunService svc = new DramaCanvasRunService(runs, canvases, ownership,
            new DramaCanvasPromptBuilder(resourcePrompts()), worker, render, configs, credits, invocation, videoJobs,
            videoModels, storage, signer, OM, tm);

    private final AiModelEndpoint imageEp = AiModelEndpoint.builder().id("ep-img").name("img").model("m").build();
    private final AiModelEndpoint videoEp = AiModelEndpoint.builder().id("ep-vid").name("vid").model("v").build();
    private DramaCanvas canvas;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        useDoc(sampleDoc(), "9:16");
        when(configs.getLong(anyString(), anyLong())).thenAnswer(inv -> inv.getArgument(1));
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        // 以 someone/ 开头的 key 不是本人的，其余都是
        when(assets.findOwnedCdnKeys(eq("drama"), eq(USER), any())).thenAnswer(inv ->
                ((Collection<String>) inv.getArgument(2)).stream().filter(k -> !k.startsWith("someone/")).toList());
        when(signer.signKey(anyString())).thenAnswer(inv -> "https://cdn.example.com/" + inv.getArgument(0));
        when(worker.execOf(any())).thenAnswer(inv -> { // 与真 execOf 一样：没有 input_json → 空对象
            DramaCanvasRun r = inv.getArgument(0);
            JsonNode exec = r.getInputJson() == null ? null : OM.readTree(r.getInputJson()).get("_exec");
            return exec != null && exec.isObject() ? exec : OM.createObjectNode();
        });
        when(render.fillMediaPrompt(anyString(), anyMap(), anyString())).thenReturn("PROMPT");
        when(render.resolveImagePlan(any(), anyString())).thenReturn(new DramaRenderService.ImagePlan(imageEp, 2L, 6));
    }

    private void useDoc(JsonNode doc, String ratio) {
        canvas = DramaCanvasRunTestSupport.canvas(doc, ratio);
        when(canvasRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(CANVAS, USER)).thenReturn(Optional.of(canvas));
    }

    private String ver() {
        return canvas.getDocVersion();
    }

    // ── 幂等 / 版本 ────────────────────────────────────────────────────────────

    @Test
    void sameClientRequestId_returnsOriginalRun_holdsAndDispatchesOnce() {
        CanvasScriptRunBody body = new CanvasScriptRunBody("request-1", ver(), "setting", null, null);
        DramaCanvasRunDto first = svc.submitScript(USER, CANVAS, body);
        DramaCanvasRunDto again = svc.submitScript(USER, CANVAS, body);

        assertEquals(first.id(), again.id());
        assertEquals("queued", first.status());
        assertEquals("script:setting", first.target());
        assertEquals(2, first.cost());
        verify(credits, times(1)).hold(eq(USER), eq(2L), eq(DramaCanvasRunService.REF_TYPE), eq(first.id()), anyString());
        verify(worker, times(1)).dispatch(List.of(first.id()));
        assertEquals(1, store.size());
    }

    @Test
    void staleDocVersion_409_nothingFrozen() {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.submitScript(USER, CANVAS,
                new CanvasScriptRunBody("request-2", "0000000000000000", "setting", null, null)));
        assertEquals("DRAMA_CANVAS_STALE", e.getCode());
        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        verifyNoInteractions(credits);
        assertTrue(store.isEmpty());
    }

    @Test
    void concurrentDuplicateInsert_returnsTheWinner_andDoesNotDispatch() {
        boolean[] raced = {false};
        when(canvasRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(CANVAS, USER)).thenAnswer(inv -> {
            if (!raced[0]) {
                raced[0] = true; // 另一个请求抢先落了同一个 clientRequestId
                store.put("dcr_winner", DramaCanvasRun.builder().id("dcr_winner").canvasId(CANVAS).ownerUserId(USER)
                        .kind("script").target("script:setting").status("queued").cost(2).clientRequestId("request-race")
                        .build());
            }
            return Optional.of(canvas);
        });
        DramaCanvasRunDto out = svc.submitScript(USER, CANVAS, new CanvasScriptRunBody("request-race", ver(), "setting", null, null));
        assertEquals("dcr_winner", out.id());
        assertEquals(1, tm.rollbacks.get(), "输的那次整体回滚（含冻结）");
        verify(worker, never()).dispatch(any());
    }

    // ── clientRequestId 规则 / 批量命名空间 ────────────────────────────────────

    @Test
    void clientRequestId_mustBe8to64OfSafeChars_noColon() {
        for (String bad : new String[]{"short", "has:colon-123", "x".repeat(65), "空格 不行 12345"}) {
            assertEquals("DRAMA_CANVAS_REQUEST_ID_INVALID", assertThrows(BusinessException.class,
                    () -> svc.submitScript(USER, CANVAS, new CanvasScriptRunBody(bad, ver(), "setting", null, null))).getCode(), bad);
        }
        assertNotNull(svc.submitScript(USER, CANVAS, new CanvasScriptRunBody("x".repeat(64), ver(), "setting", null, null)));
        verify(credits, times(1)).hold(any(), anyLong(), any(), any(), any());
    }

    private CanvasImageBatchBody oneSceneBatch(String cri) {
        return new CanvasImageBatchBody(cri, ver(), List.of(
                new CanvasImageBatchItem(new CanvasImageTarget("scene", "sc1", null, null), 1, null)), null);
    }

    @Test
    void batchAndSingleShareTheRawKey_eitherOrderIs409() {
        svc.submitImageBatch(USER, CANVAS, oneSceneBatch("request-ns1"));
        assertEquals("DRAMA_CANVAS_REQUEST_ID_REUSED", assertThrows(BusinessException.class, () -> svc.submitImage(USER,
                CANVAS, new CanvasImageRunBody("request-ns1", ver(), new CanvasImageTarget("scene", "sc1", null, null), 1,
                        null, null))).getCode(), "批量第 0 项占着原始键：同一个键的单条出图（哪怕目标一样）也不行");

        svc.submitScript(USER, CANVAS, new CanvasScriptRunBody("request-ns2", ver(), "setting", null, null));
        assertEquals("DRAMA_CANVAS_REQUEST_ID_REUSED", assertThrows(BusinessException.class,
                () -> svc.submitImageBatch(USER, CANVAS, oneSceneBatch("request-ns2"))).getCode(), "单条用过的键不能再当批量");
        verify(credits, times(2)).hold(any(), anyLong(), any(), any(), any());
    }

    @Test
    void singleHit_mustBeTheSameKindOfRequest() {
        svc.submitScript(USER, CANVAS, new CanvasScriptRunBody("request-kind", ver(), "setting", null, null));
        assertEquals("DRAMA_CANVAS_REQUEST_ID_REUSED", assertThrows(BusinessException.class,
                () -> svc.submitExtract(USER, CANVAS, new DramaCanvasRunDto.CanvasExtractRunBody("request-kind", ver()))).getCode());
        assertEquals("DRAMA_CANVAS_REQUEST_ID_REUSED", assertThrows(BusinessException.class, () -> svc.submitScript(USER,
                CANVAS, new CanvasScriptRunBody("request-kind", ver(), "outline", null, null))).getCode(), "同是剧本，阶段不同也不行");
        // 同一种请求：原样回原记录
        assertEquals("script:setting", svc.submitScript(USER, CANVAS,
                new CanvasScriptRunBody("request-kind", ver(), "setting", null, null)).target());
    }

    @Test
    void concurrentSingleAndBatchOnSameKey_databaseLetsOnlyOneIn() {
        // 单条提交的事务进行中，批量那边抢先落了原始键（第 0 项）：单条撞唯一索引 → 回查 → 是批量的一项 → 409
        boolean[] raced = {false};
        when(canvasRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(CANVAS, USER)).thenAnswer(inv -> {
            if (!raced[0]) {
                raced[0] = true;
                ObjectNode exec = OM.createObjectNode();
                exec.putArray("batchRunIds").add("dcr_batch0");
                store.put("dcr_batch0", DramaCanvasRun.builder().id("dcr_batch0").canvasId(CANVAS).ownerUserId(USER)
                        .kind("image").target("scene:sc1").status("queued").cost(2).clientRequestId("request-race2")
                        .inputJson(OM.createObjectNode().set("_exec", exec).toString()).build());
            }
            return Optional.of(canvas);
        });
        assertEquals("DRAMA_CANVAS_REQUEST_ID_REUSED", assertThrows(BusinessException.class, () -> svc.submitScript(USER,
                CANVAS, new CanvasScriptRunBody("request-race2", ver(), "setting", null, null))).getCode());
        assertEquals(1, tm.rollbacks.get(), "单条那边整体回滚（含冻结）");
        verify(worker, never()).dispatch(any());
        assertEquals(1, store.size(), "只有一方被受理");
    }

    @Test
    void concurrentBatchAndSingleOnSameKey_batchLoses() {
        boolean[] raced = {false};
        when(canvasRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(CANVAS, USER)).thenAnswer(inv -> {
            if (!raced[0]) {
                raced[0] = true; // 单条那边抢先落了同一个原始键
                store.put("dcr_single", DramaCanvasRun.builder().id("dcr_single").canvasId(CANVAS).ownerUserId(USER)
                        .kind("script").target("script:setting").status("queued").cost(2).clientRequestId("request-race3")
                        .inputJson("{\"_exec\":{}}").build());
            }
            return Optional.of(canvas);
        });
        assertEquals("DRAMA_CANVAS_REQUEST_ID_REUSED", assertThrows(BusinessException.class,
                () -> svc.submitImageBatch(USER, CANVAS, oneSceneBatch("request-race3"))).getCode());
        verify(worker, never()).dispatchBatch(any(), any());
        assertEquals(1, store.size());
    }

    @Test
    void imageBatch_cappedAt20ItemsAnd40Images_nothingFrozen() {
        List<CanvasImageBatchItem> many = new java.util.ArrayList<>();
        for (int i = 0; i < 21; i++) many.add(new CanvasImageBatchItem(new CanvasImageTarget("scene", "sc1", null, null), 1, null));
        assertEquals("DRAMA_CANVAS_BATCH_TOO_LARGE", assertThrows(BusinessException.class, () -> svc.submitImageBatch(USER,
                CANVAS, new CanvasImageBatchBody("request-cap1", ver(), many, null))).getCode());
        List<CanvasImageBatchItem> heavy = new java.util.ArrayList<>();
        for (int i = 0; i < 11; i++) heavy.add(new CanvasImageBatchItem(new CanvasImageTarget("scene", "sc1", null, null), 4, null));
        assertEquals("DRAMA_CANVAS_BATCH_TOO_LARGE", assertThrows(BusinessException.class, () -> svc.submitImageBatch(USER,
                CANVAS, new CanvasImageBatchBody("request-cap2", ver(), heavy, null))).getCode(), "44 张 > 40");
        verifyNoInteractions(credits);
    }

    @Test
    void dispatchRejected_requestStillReturnsNormally_withTheFailedRun() {
        // 模拟 worker 在 afterCommit 里被线程池拒绝：它在自己的新事务里把这条判了失败并退款
        doAnswer(inv -> {
            List<String> ids = inv.getArgument(0);
            DramaCanvasRun r = store.get(ids.get(0));
            r.setStatus(DramaCanvasRun.STATUS_FAILED);
            r.setErrorCode("DRAMA_CANVAS_QUEUE_FULL");
            return null;
        }).when(worker).dispatch(any());
        DramaCanvasRunDto r = svc.submitScript(USER, CANVAS, new CanvasScriptRunBody("request-full", ver(), "setting", null, null));
        assertEquals("failed", r.status());
        assertEquals("DRAMA_CANVAS_QUEUE_FULL", r.errorCode());
    }

    // ── preflight 都在冻结之前 ─────────────────────────────────────────────────

    @Test
    void someoneElsesKeyInDoc_400_nothingFrozen() {
        ObjectNode doc = sampleDoc();
        ((ObjectNode) doc.path("scenes").get(0).path("images").path("versions").get(0)).put("key", "someone/else.png");
        useDoc(doc, "9:16");
        BusinessException e = assertThrows(BusinessException.class, () -> svc.submitImage(USER, CANVAS,
                new CanvasImageRunBody("request-3", ver(), new CanvasImageTarget("look", "lk1", null, null), 1, null, null)));
        assertEquals("DRAMA_CANVAS_ASSET_NOT_OWNED", e.getCode());
        verify(credits, never()).hold(any(), anyLong(), any(), any(), any());
        assertTrue(store.isEmpty());
    }

    @Test
    void lockedEpisode_409_nothingFrozen() {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.submitScript(USER, CANVAS,
                new CanvasScriptRunBody("request-4", ver(), "episode", 2, null)));
        assertEquals("DRAMA_CANVAS_EPISODE_LOCKED", e.getCode());
        verifyNoInteractions(credits);
    }

    @Test
    void llmNotConfigured_503_nothingFrozen() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(false);
        BusinessException e = assertThrows(BusinessException.class, () -> svc.submitScript(USER, CANVAS,
                new CanvasScriptRunBody("request-5", ver(), "outline", null, null)));
        assertEquals("AI_NOT_CONFIGURED", e.getCode());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, e.getStatus());
        verifyNoInteractions(credits);
        assertTrue(store.isEmpty());
    }

    @Test
    void imageEngineNotConfigured_503_nothingFrozen() {
        when(render.resolveImagePlan(any(), anyString())).thenThrow(
                new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_NOT_CONFIGURED", "没接图像模型"));
        BusinessException e = assertThrows(BusinessException.class, () -> svc.submitImage(USER, CANVAS,
                new CanvasImageRunBody("request-6", ver(), new CanvasImageTarget("scene", "sc1", null, null), 2, null, null)));
        assertEquals("IMAGE_NOT_CONFIGURED", e.getCode());
        verifyNoInteractions(credits);
    }

    // ── 冻结与派发 ─────────────────────────────────────────────────────────────

    @Test
    void imageRun_holdsUnitTimesCount_snapshotsPriceAndRefs() throws Exception {
        DramaCanvasRunDto r = svc.submitImage(USER, CANVAS,
                new CanvasImageRunBody("request-7", ver(), new CanvasImageTarget("look", "lk1", null, null), 3, null, "ep-img"));
        assertEquals(6, r.cost(), "单价 2 × 3 张");
        verify(credits).hold(eq(USER), eq(6L), eq(DramaCanvasRunService.REF_TYPE), eq(r.id()), anyString());
        assertEquals(2, r.refs().requested());
        assertEquals(2, r.refs().applied());
        JsonNode exec = OM.readTree(store.get(r.id()).getInputJson()).path("_exec");
        assertEquals(2, exec.path("unitCost").asLong(), "单价快照进 input_json，worker 只认它");
        assertEquals("ep-img", exec.path("endpointId").asText());
        assertEquals(2, exec.path("refKeys").size());
    }

    @Test
    void dispatchHappensAfterCommit_notInsideTheTransaction() {
        AtomicInteger commitsAtDispatch = new AtomicInteger(-1);
        doAnswer(inv -> {
            commitsAtDispatch.set(tm.commits.get());
            return null;
        }).when(worker).dispatch(any());
        svc.submitScript(USER, CANVAS, new CanvasScriptRunBody("request-8", ver(), "setting", null, null));
        assertEquals(1, commitsAtDispatch.get(), "派发时事务已经提交");
    }

    @Test
    void rolledBackTransaction_neverDispatches() {
        TransactionTemplate outer = new TransactionTemplate(tm);
        String[] id = new String[1];
        outer.executeWithoutResult(s -> {
            id[0] = svc.submitScript(USER, CANVAS, new CanvasScriptRunBody("request-9", ver(), "setting", null, null)).id();
            s.setRollbackOnly();
        });
        assertNotNull(id[0]);
        verify(worker, never()).dispatch(any());
    }

    @Test
    void imageBatch_oneHoldForTheWholeBatch_oneRunPerItem_idempotent() {
        CanvasImageBatchBody body = new CanvasImageBatchBody("request-b", ver(), List.of(
                new CanvasImageBatchItem(new CanvasImageTarget("look", "lk1", null, null), 2, null),
                new CanvasImageBatchItem(new CanvasImageTarget("scene", "sc1", null, null), 1, null)), null);
        List<DramaCanvasRunDto> out = svc.submitImageBatch(USER, CANVAS, body);
        assertEquals(2, out.size());
        verify(credits, times(1)).hold(eq(USER), eq(6L), eq(DramaCanvasRunService.REF_TYPE), startsWith("dcb_"), anyString());
        assertEquals("request-b", store.get(out.get(0).id()).getClientRequestId(), "第 0 项占用原始键");
        assertEquals("request-b:1", store.get(out.get(1).id()).getClientRequestId());
        assertEquals(4, out.get(0).cost());
        assertEquals(2, out.get(1).cost());
        verify(worker, times(1)).dispatchBatch(eq(List.of(out.get(0).id(), out.get(1).id())), startsWith("dcb_"));

        List<DramaCanvasRunDto> again = svc.submitImageBatch(USER, CANVAS, body);
        assertEquals(List.of(out.get(0).id(), out.get(1).id()), again.stream().map(DramaCanvasRunDto::id).toList());
        verify(credits, times(1)).hold(any(), anyLong(), any(), any(), any());
    }

    // ── 视频 ───────────────────────────────────────────────────────────────────

    private void stubVideo(MaterialVideoModelClient.DurationBounds bounds) {
        when(invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, null))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(videoEp, null, true)));
        when(videoModels.effectiveDurationBounds(isNull(), eq(videoEp))).thenReturn(bounds);
        when(render.resolveClipPlan(isNull(), anyInt())).thenAnswer(inv ->
                new DramaRenderService.ClipPlan(null, videoEp, 40L * inv.<Integer>getArgument(1), null, false, false));
        when(render.submitClip(any(), any(), eq(USER))).thenReturn(OM.createObjectNode().put("id", "mvj_1"));
    }

    @Test
    void videoRun_passesPickedFirstFrameAsFirstFrameKey() {
        stubVideo(new MaterialVideoModelClient.DurationBounds(5, 15));
        DramaCanvasRunDto r = svc.submitVideo(USER, CANVAS, new CanvasVideoRunBody("request-v", ver(), 1, "sg1", null, null));

        ArgumentCaptor<DramaRenderService.ClipSubmission> cap = ArgumentCaptor.forClass(DramaRenderService.ClipSubmission.class);
        verify(render).submitClip(any(), cap.capture(), eq(USER));
        DramaRenderService.ClipSubmission s = cap.getValue();
        assertEquals("drama/canvas/frames/f.png", s.firstFrameKey());
        assertEquals("https://cdn.example.com/drama/canvas/frames/f.png", s.firstFrameUrl());
        assertEquals(7, s.durationSec());
        assertEquals("9:16", s.ratio());
        assertEquals(CANVAS, s.scriptId());
        assertEquals("sg1", s.variantConfig().path("segment_id").asText());
        assertTrue(s.variantConfig().path("require_mirror").asBoolean(), "画布只存 key：镜像不下来就退款");
        assertEquals(DramaCanvasRunService.VIDEO_JOB_KIND, s.kind());
        assertEquals("mvj_1", store.get(r.id()).getJobId());
        assertEquals(280, r.cost(), "按秒 40 × 7 秒");
        assertEquals(1, r.refs().applied());
        verify(worker, never()).dispatch(any()); // 视频由 MaterialVideoJobService 自己派发
    }

    @Test
    void videoRun_withoutFirstFrame_isTextToVideoAndSaysSo() {
        stubVideo(new MaterialVideoModelClient.DurationBounds(5, 15));
        DramaCanvasRunDto r = svc.submitVideo(USER, CANVAS, new CanvasVideoRunBody("request-v2", ver(), 1, "sg2", null, null));
        ArgumentCaptor<DramaRenderService.ClipSubmission> cap = ArgumentCaptor.forClass(DramaRenderService.ClipSubmission.class);
        verify(render).submitClip(any(), cap.capture(), eq(USER));
        assertNull(cap.getValue().firstFrameKey());
        assertTrue(r.refs().notes().stream().anyMatch(n -> n.contains("没有首帧")), r.refs().notes().toString());
    }

    @Test
    void videoRun_segmentLongerThanModelMax_400_notSubmitted() {
        stubVideo(new MaterialVideoModelClient.DurationBounds(null, 5));
        BusinessException e = assertThrows(BusinessException.class, () -> svc.submitVideo(USER, CANVAS,
                new CanvasVideoRunBody("request-v3", ver(), 1, "sg1", null, null)));
        assertEquals("DRAMA_CANVAS_SEGMENT_TOO_LONG", e.getCode());
        verify(render, never()).submitClip(any(), any(), any());

        // 上限未知按 10 秒
        ObjectNode doc = sampleDoc();
        ((ObjectNode) doc.path("episodes").get(0).path("segments").get(0)).put("durationSec", 12);
        useDoc(doc, "9:16");
        stubVideo(new MaterialVideoModelClient.DurationBounds(null, null));
        assertEquals("DRAMA_CANVAS_SEGMENT_TOO_LONG", assertThrows(BusinessException.class, () -> svc.submitVideo(USER,
                CANVAS, new CanvasVideoRunBody("request-v4", ver(), 1, "sg1", null, null))).getCode());
    }

    @Test
    void videoRun_firstFrameNotOwned_400_notSubmitted() {
        ObjectNode doc = sampleDoc();
        ((ObjectNode) doc.path("episodes").get(0).path("segments").get(0).path("frame").path("versions").get(0))
                .put("key", "someone/frame.png");
        useDoc(doc, "9:16");
        stubVideo(new MaterialVideoModelClient.DurationBounds(5, 15));
        assertEquals("DRAMA_CANVAS_ASSET_NOT_OWNED", assertThrows(BusinessException.class, () -> svc.submitVideo(USER,
                CANVAS, new CanvasVideoRunBody("request-v5", ver(), 1, "sg1", null, null))).getCode());
        verify(render, never()).submitClip(any(), any(), any());
    }

    /** 端到端到 MaterialVideoJobService 的那一层：first_frame_key 真的写进了 variant_config（聚算 H3 只认它）。 */
    @Test
    void submitClip_writesFirstFrameKeyIntoVariantConfig() {
        MaterialVideoJobService jobs = mock(MaterialVideoJobService.class);
        when(jobs.submit(any(), any(), any())).thenReturn(List.of(OM.createObjectNode().put("id", "mvj_9")));
        DramaRenderService real = new DramaRenderService(mock(AiModelInvocationService.class),
                mock(AiModelUsageService.class), mock(com.aistareco.aep.service.ai.UpstreamModelHttp.class), jobs,
                mock(CreditService.class), mock(CdnUploader.class), mock(CdnUrlSigner.class),
                mock(PlatformConfigService.class), mock(PromptService.class), mock(DramaReferenceAssembler.class),
                mock(StorageQuotaService.class), OM, mock(MaterialVideoModelClient.class));
        ObjectNode vc = OM.createObjectNode().put("segment_id", "sg1");
        real.submitClip(new DramaRenderService.ClipPlan("ep-h3", videoEp, 200L, null, false, false),
                new DramaRenderService.ClipSubmission("drama-canvas", "片段", "短剧画布 · 片段视频", "PROMPT",
                        "https://cdn.example.com/f.png", null, "drama/canvas/frames/f.png", 5, "9:16", CANVAS, vc), USER);
        ArgumentCaptor<JsonNode> body = ArgumentCaptor.forClass(JsonNode.class);
        verify(jobs).submit(body.capture(), eq(USER), eq(MaterialVideoJobService.APP_DRAMA));
        JsonNode item = body.getValue().path("items").get(0);
        assertEquals("drama/canvas/frames/f.png", item.path("variant_config").path("first_frame_key").asText());
        assertEquals("ep-h3", item.path("variant_config").path("endpoint_id").asText());
        assertEquals(200, item.path("credit_cost").asLong());
        assertTrue(item.path("prompt").asText().contains("https://cdn.example.com/f.png"));
    }

    // ── 合成 ───────────────────────────────────────────────────────────────────

    @Test
    void assemble_segmentWithoutVideo_400_notDispatched() {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.submitAssemble(USER, CANVAS,
                new CanvasAssembleRunBody("request-a", ver(), 1)));
        assertEquals("DRAMA_CANVAS_NOTHING_TO_ASSEMBLE", e.getCode());
        verify(worker, never()).dispatch(any());
    }

    @Test
    void assemble_freeAndKeepsSegmentOrder() throws Exception {
        ObjectNode doc = sampleDoc();
        ((ObjectNode) doc.path("episodes").get(0).path("segments").get(1).path("video"))
                .putArray("versions").addObject().put("key", "material-videos/mvj_b/video.mp4").put("runId", "r1")
                .put("createdAt", "2026-09-30T00:00:00Z");
        useDoc(doc, "9:16");
        DramaCanvasRunDto r = svc.submitAssemble(USER, CANVAS, new CanvasAssembleRunBody("request-a2", ver(), 1));
        assertEquals(0, r.cost());
        verifyNoInteractions(credits);
        JsonNode keys = OM.readTree(store.get(r.id()).getInputJson()).path("_exec").path("videoKeys");
        assertEquals("[\"material-videos/mvj_a/video.mp4\",\"material-videos/mvj_b/video.mp4\"]", keys.toString());
        // 画布比例在受理时快照进运行，合成按它选成片画幅（合成不再读画布）
        assertEquals("9:16", OM.readTree(store.get(r.id()).getInputJson()).path("_exec").path("canvasRatio").asText());
        verify(worker).dispatch(List.of(r.id()));
    }

    // ── 按幂等键只查不建（runs/lookup）──────────────────────────────────────────

    @Test
    void lookup_single_batch_none_otherCanvas_otherUser_noSideEffects() {
        DramaCanvasRunDto single = svc.submitScript(USER, CANVAS,
                new CanvasScriptRunBody("request-lk1", ver(), "setting", null, null));
        List<DramaCanvasRunDto> batch = svc.submitImageBatch(USER, CANVAS, new CanvasImageBatchBody("request-lk2", ver(),
                List.of(new CanvasImageBatchItem(new CanvasImageTarget("look", "lk1", null, null), 1, null),
                        new CanvasImageBatchItem(new CanvasImageTarget("scene", "sc1", null, null), 1, null)), null));
        clearInvocations(credits, worker);

        assertEquals(List.of(single.id()), svc.lookup(USER, CANVAS, "request-lk1").stream().map(DramaCanvasRunDto::id).toList());
        assertEquals(batch.stream().map(DramaCanvasRunDto::id).toList(),
                svc.lookup(USER, CANVAS, "request-lk2").stream().map(DramaCanvasRunDto::id).toList(), "批量按原始键查到整批");
        assertTrue(svc.lookup(USER, CANVAS, "request-never").isEmpty(), "没受理过 → 空");

        // 命中的记录在别的画布上 → 空（不暴露别的画布）
        store.put("dcr_elsewhere", DramaCanvasRun.builder().id("dcr_elsewhere").canvasId("dcv_other").ownerUserId(USER)
                .kind("script").target("script:setting").status("queued").cost(2).clientRequestId("request-lk3")
                .inputJson("{}").build());
        assertTrue(svc.lookup(USER, CANVAS, "request-lk3").isEmpty());
        // 别人的记录（同一个键）查不到
        store.put("dcr_theirs", DramaCanvasRun.builder().id("dcr_theirs").canvasId(CANVAS).ownerUserId("u2")
                .kind("script").target("script:setting").status("queued").cost(2).clientRequestId("request-lk4")
                .inputJson("{}").build());
        assertTrue(svc.lookup(USER, CANVAS, "request-lk4").isEmpty());
        // 别人的画布 → 404（requireCanvas 只认本人）
        assertEquals("DRAMA_CANVAS_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.lookup("u2", CANVAS, "request-lk1")).getCode());
        // 键不合规 → 400
        assertEquals("DRAMA_CANVAS_REQUEST_ID_INVALID",
                assertThrows(BusinessException.class, () -> svc.lookup(USER, CANVAS, "bad:key-1")).getCode());

        // 只查不建：没冻结、没派发、没建记录；不看 docVersion
        verifyNoInteractions(credits);
        verify(worker, never()).dispatch(any());
        verify(worker, never()).dispatchBatch(any(), any());
        assertEquals(5, store.size());
    }

    @Test
    void lookup_videoRunIsSyncedLikeGetRuns() {
        stubVideo(new MaterialVideoModelClient.DurationBounds(5, 15));
        DramaCanvasRunDto v = svc.submitVideo(USER, CANVAS, new CanvasVideoRunBody("request-lkv", ver(), 1, "sg1", null, null));
        when(worker.syncVideo(any())).thenAnswer(inv -> {
            DramaCanvasRun r = inv.getArgument(0);
            r.setStatus(DramaCanvasRun.STATUS_RUNNING);
            return r;
        });
        List<DramaCanvasRunDto> out = svc.lookup(USER, CANVAS, "request-lkv");
        assertEquals(1, out.size());
        assertEquals(v.id(), out.get(0).id());
        assertEquals("running", out.get(0).status());
        verify(worker).syncVideo(any());
    }

    // ── 取消 / 查询 ────────────────────────────────────────────────────────────

    @Test
    void cancel_onlyQueued_refundsItsHold() {
        DramaCanvasRunDto r = svc.submitScript(USER, CANVAS, new CanvasScriptRunBody("request-c", ver(), "setting", null, null));
        DramaCanvasRunDto canceled = svc.cancel(USER, CANVAS, r.id());
        assertEquals("canceled", canceled.status());
        verify(credits).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq(r.id()), anyString());

        DramaCanvasRunDto r2 = svc.submitScript(USER, CANVAS, new CanvasScriptRunBody("request-c2", ver(), "setting", null, null));
        store.get(r2.id()).setStatus(DramaCanvasRun.STATUS_RUNNING);
        BusinessException e = assertThrows(BusinessException.class, () -> svc.cancel(USER, CANVAS, r2.id()));
        assertEquals("DRAMA_CANVAS_RUN_NOT_CANCELABLE", e.getCode());
        verify(credits, never()).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq(r2.id()), anyString());
    }

    @Test
    void cancel_videoOnlyWhileJobStillQueued() {
        stubVideo(new MaterialVideoModelClient.DurationBounds(5, 15));
        DramaCanvasRunDto r = svc.submitVideo(USER, CANVAS, new CanvasVideoRunBody("request-cv", ver(), 1, "sg1", null, null));
        when(worker.syncVideo(any())).thenAnswer(inv -> inv.getArgument(0));
        when(videoJobs.cancelQueued("mvj_1", USER)).thenReturn(false);
        assertEquals("DRAMA_CANVAS_RUN_NOT_CANCELABLE",
                assertThrows(BusinessException.class, () -> svc.cancel(USER, CANVAS, r.id())).getCode());
        when(videoJobs.cancelQueued("mvj_1", USER)).thenReturn(true);
        assertEquals("canceled", svc.cancel(USER, CANVAS, r.id()).status());
    }

    @Test
    void list_onlyThisCanvas_signsOnlyOwnKeys_capsIds() {
        DramaCanvasRun mine = DramaCanvasRunTestSupport.run("dcr_a", "image", "succeeded", OM.createObjectNode());
        mine.setResultJson("{\"images\":[{\"key\":\"drama/canvas/looks/n.png\",\"runId\":\"dcr_a\"},"
                + "{\"key\":\"someone/x.png\",\"runId\":\"dcr_a\"}]}");
        DramaCanvasRun other = DramaCanvasRunTestSupport.run("dcr_b", "image", "succeeded", OM.createObjectNode());
        other.setCanvasId("dcv_other");
        store.put(mine.getId(), mine);
        store.put(other.getId(), other);
        List<DramaCanvasRunDto> out = svc.list(USER, CANVAS, "dcr_a, dcr_b ,dcr_zzz");
        assertEquals(1, out.size());
        JsonNode images = out.get(0).result().path("images");
        assertEquals("https://cdn.example.com/drama/canvas/looks/n.png", images.get(0).path("url").asText());
        assertFalse(images.get(1).has("url"), "不是本人的 key 不签");

        StringBuilder many = new StringBuilder();
        for (int i = 0; i < 51; i++) many.append("id").append(i).append(',');
        assertEquals("DRAMA_CANVAS_TOO_MANY_RUN_IDS",
                assertThrows(BusinessException.class, () -> svc.list(USER, CANVAS, many.toString())).getCode());
    }

    // ── 分镜：片段下限跟所选视频模型（v0.198.1） ──────────────────────────────────

    private JsonNode storyboardMeta(DramaCanvasRunDto r) throws Exception {
        return OM.readTree(store.get(r.id()).getInputJson()).path("_exec").path("meta");
    }

    @Test
    void storyboard_minSegmentSec_followsTheVideoModel_clampedToMax_defaultsTo4() throws Exception {
        JsonNode h3 = storyboardMeta(svc.submitStoryboard(USER, CANVAS,
                new CanvasStoryboardRunBody("request-sb1", ver(), 1, 15, 5)));
        assertEquals(15, h3.path("maxSec").asInt());
        assertEquals(5, h3.path("minSec").asInt());

        JsonNode tooBig = storyboardMeta(svc.submitStoryboard(USER, CANVAS,
                new CanvasStoryboardRunBody("request-sb2", ver(), 1, 8, 40)));
        assertEquals(8, tooBig.path("minSec").asInt(), "下限不超过上限");

        JsonNode absent = storyboardMeta(svc.submitStoryboard(USER, CANVAS,
                new CanvasStoryboardRunBody("request-sb3", ver(), 1, null, null)));
        assertEquals(DramaCanvasPromptBuilder.SEGMENT_MIN_SEC, absent.path("minSec").asInt());
        assertEquals(DramaCanvasRunService.DEFAULT_MAX_SEGMENT_SEC, absent.path("maxSec").asInt());
    }
}
