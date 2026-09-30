package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaCanvasRun;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.DramaCanvasRunRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoWorker;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.aistareco.aep.service.DramaCanvasRunTestSupport.OM;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.copy;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.USER;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.inMemoryRuns;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.pngBytes;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.run;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * 画布运行的后台执行（DramaCanvasRunWorker）与超时回收（DramaCanvasRunSweeper）：
 * 输出形状不合格 → 失败且退款；出图逐张结算、失败的退回；批量出图整批一个冻结、跑完一次退；
 * 视频按 MaterialVideoJob 同步（key + 末帧 key 记归属）；僵死记录回收。
 */
class DramaCanvasRunWorkerTest {

    private final Map<String, DramaCanvasRun> store = new LinkedHashMap<>();
    private final DramaCanvasRunRepository runs = inMemoryRuns(store);
    private final CreditService credits = mock(CreditService.class);
    private final AiModelInvocationService invocation = mock(AiModelInvocationService.class);
    private final DramaRenderService render = mock(DramaRenderService.class);
    private final DramaCanvasOwnership ownership = mock(DramaCanvasOwnership.class);
    private final DramaAssembleService assembler = mock(DramaAssembleService.class);
    private final MaterialVideoJobRepository jobs = mock(MaterialVideoJobRepository.class);
    private final CdnUrlSigner signer = mock(CdnUrlSigner.class);
    private final MaterialVideoJobService videoJobs = mock(MaterialVideoJobService.class);
    private final com.aistareco.aep.repository.CreditHoldRepository holds =
            mock(com.aistareco.aep.repository.CreditHoldRepository.class);
    /** 会真回滚内存仓库的事务管理器：用来验证「结算抛错 → 这张图的结果也不在」。 */
    private final DramaCanvasRunTestSupport.TestTxManager tm = new DramaCanvasRunTestSupport.TestTxManager(store);
    private final DramaCanvasRunWorker worker = new DramaCanvasRunWorker(runs, credits, invocation, render, ownership,
            assembler, jobs, videoJobs, signer, OM, tm, 1);
    private final AiModelEndpoint ep = AiModelEndpoint.builder().id("ep-img").name("img").model("m").build();

    @BeforeEach
    void setUp() {
        when(render.resolveImagePlan(any(), anyString())).thenReturn(new DramaRenderService.ImagePlan(ep, 2L, 6));
        when(signer.signKey(anyString())).thenAnswer(inv -> "https://cdn.example.com/" + inv.getArgument(0));
        int[] n = {0};
        when(render.storeImageBytes(any(), anyString(), anyString())).thenAnswer(inv ->
                new DramaRenderService.StoredImage(inv.getArgument(1) + "img" + (++n[0]) + ".png", 16, "image/png"));
    }

    @AfterEach
    void tearDown() {
        worker.shutdown();
    }

    private static AiModelInvocationService.AiModelResponse reply(String content) {
        return new AiModelInvocationService.AiModelResponse(content, "stop", 10L, "ep", "m");
    }

    private DramaCanvasRun textRun(String id, String kind, ObjectNode meta, String... users) {
        ObjectNode exec = OM.createObjectNode();
        exec.put("unitCost", 4).put("holdTotal", 4).put("holdRef", id).put("label", "画布 · 测试");
        ArrayNode calls = exec.putArray("calls");
        for (String u : users) {
            calls.addObject().put("system", "sys").put("user", u).put("temperature", 0.5).put("maxTokens", 1000)
                    .put("jsonMode", true);
        }
        exec.set("meta", meta);
        DramaCanvasRun r = run(id, kind, DramaCanvasRun.STATUS_QUEUED, exec);
        r.setCost(4);
        store.put(id, r);
        return r;
    }

    private static ObjectNode storyboardMeta() {
        ObjectNode meta = OM.createObjectNode().put("no", 1).put("maxSec", 10);
        ObjectNode ids = meta.putObject("ids");
        ids.putArray("look").add("lk1");
        ids.putArray("scene");
        ids.putArray("material");
        return meta;
    }

    // ── 文字类 ─────────────────────────────────────────────────────────────────

    @Test
    void textRun_badShape_failsWithAiCallFailed_andRefunds() {
        textRun("dcr_t1", "storyboard", storyboardMeta(), "切片段");
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), any(), any()))
                .thenReturn(reply("{\"segments\":\"不是数组\"}"));
        worker.runBlocking("dcr_t1");

        DramaCanvasRun r = store.get("dcr_t1");
        assertEquals("failed", r.getStatus());
        assertEquals("AI_CALL_FAILED", r.getErrorCode());
        assertEquals(4, r.getCost(), "失败后仍显示冻结时的原值");
        assertNotNull(r.getFinishedAt());
        verify(credits).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_t1"), anyString());
        verify(credits, never()).commitHold(any(), any(), anyLong(), any());
    }

    @Test
    void textRun_ok_commitsUnitAndStoresResult() throws Exception {
        textRun("dcr_t2", "storyboard", storyboardMeta(), "切片段");
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), any(), any())).thenReturn(reply(
                "{\"segments\":[{\"text\":\"（4 秒）@[林微](look:lk1) 蹲着。\",\"durationSec\":4}],\"notes\":[]}"));
        worker.runBlocking("dcr_t2");

        DramaCanvasRun r = store.get("dcr_t2");
        assertEquals("succeeded", r.getStatus());
        JsonNode res = OM.readTree(r.getResultJson());
        assertEquals(1, res.path("storyboard").path("episodeNo").asInt());
        assertEquals(4, res.path("storyboard").path("segments").get(0).path("durationSec").asInt());
        verify(credits).commitHold(DramaCanvasRunService.REF_TYPE, "dcr_t2", 4L, "画布 · 测试");
    }

    @Test
    void outlineChunks_secondCallCarriesFirstChunk_resultConcatenated() throws Exception {
        ObjectNode meta = OM.createObjectNode().put("stage", "outline").put("total", 2);
        meta.putArray("chunks").add(OM.createObjectNode().put("fromNo", 1).put("toNo", 1))
                .add(OM.createObjectNode().put("fromNo", 2).put("toNo", 2));
        textRun("dcr_t3", "script", meta, "第一批", "第二批 " + DramaCanvasPromptBuilder.CARRY);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), any(), any()))
                .thenReturn(reply("{\"episodes\":[{\"title\":\"甲\",\"hook\":\"h\",\"summary\":\"梗概甲\"}]}"))
                .thenReturn(reply("{\"episodes\":[{\"title\":\"乙\",\"hook\":\"h\",\"summary\":\"梗概乙\"}]}"));
        worker.runBlocking("dcr_t3");

        @SuppressWarnings({"unchecked", "rawtypes"})
        ArgumentCaptor<List<Map<String, String>>> msgs = ArgumentCaptor.forClass((Class) List.class);
        verify(invocation, times(2)).invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), msgs.capture(), any());
        String second = msgs.getAllValues().get(1).get(1).get("content");
        assertTrue(second.contains("第 1 集《甲》：梗概甲"), second);
        assertFalse(second.contains(DramaCanvasPromptBuilder.CARRY));
        JsonNode eps = OM.readTree(store.get("dcr_t3").getResultJson()).path("outline").path("episodes");
        assertEquals(2, eps.size());
        assertEquals(2, eps.get(1).path("no").asInt());
    }

    @Test
    void upstreamError_isWrittenIntoTheRun_notJustThrown() {
        textRun("dcr_t4", "storyboard", storyboardMeta(), "切片段");
        when(invocation.invokeChat(any(), any(), any())).thenThrow(BusinessException.wrapped(HttpStatus.BAD_GATEWAY,
                "AI_CALL_FAILED", "AI 生成失败，请稍后重试",
                "endpoint=e purpose=p model=m status=400 body={\"error\":{\"message\":\"max_tokens too large\"}}"));
        worker.runBlocking("dcr_t4");
        DramaCanvasRun r = store.get("dcr_t4");
        assertEquals("failed", r.getStatus());
        assertEquals("AI_CALL_FAILED", r.getErrorCode());
        assertTrue(r.getErrorMessage().contains("max_tokens too large"), "4xx 把上游原话告诉用户：" + r.getErrorMessage());
        verify(credits).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_t4"), anyString());
    }

    @Test
    void canceledBeforeClaim_isNeverRun() {
        DramaCanvasRun r = textRun("dcr_t5", "storyboard", storyboardMeta(), "切片段");
        r.setStatus(DramaCanvasRun.STATUS_CANCELED);
        worker.runBlocking("dcr_t5");
        verifyNoInteractions(invocation);
        verifyNoInteractions(credits);
    }

    // ── 出图 ───────────────────────────────────────────────────────────────────

    private DramaCanvasRun imageRun(String id, int count, String holdRef, List<String> batch) {
        ObjectNode exec = OM.createObjectNode();
        exec.put("unitCost", 2).put("count", count).put("holdTotal", 2L * count).put("holdRef", holdRef)
                .put("label", "画布 · 造型出图").put("prompt", "P").put("ratio", "9:16")
                .put("keyPrefix", "drama/canvas/looks/");
        exec.putArray("refKeys").add("drama/canvas/scenes/b.png");
        if (batch != null) {
            ArrayNode ids = exec.putArray("batchRunIds");
            batch.forEach(ids::add);
        }
        DramaCanvasRun r = run(id, "image", DramaCanvasRun.STATUS_QUEUED, exec);
        r.setCost(2L * count);
        store.put(id, r);
        return r;
    }

    @Test
    void imageRun_partialFailure_chargesOnlySuccesses_refundsTheRest() throws Exception {
        imageRun("dcr_i1", 3, "dcr_i1", null);
        when(render.generateImageBytes(eq(ep), eq("P"), eq("9:16"), any()))
                .thenReturn(pngBytes())
                .thenThrow(BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED", "图片没生成出来",
                        "endpoint=img model=m status=400 body={\"error\":{\"message\":\"prompt rejected\"}}"));
        worker.runBlocking("dcr_i1");

        DramaCanvasRun r = store.get("dcr_i1");
        assertEquals("succeeded", r.getStatus());
        assertEquals(2, r.getCost(), "只算出来的那 1 张");
        JsonNode images = OM.readTree(r.getResultJson()).path("images");
        assertEquals(1, images.size());
        assertEquals("dcr_i1", images.get(0).path("runId").asText());
        String notes = OM.readTree(r.getRefsJson()).path("notes").toString();
        assertTrue(notes.contains("出了 1 张") && notes.contains("prompt rejected"), notes);
        verify(credits, times(1)).commitHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_i1"), eq(2L), anyString());
        verify(credits).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_i1"), anyString());
        verify(ownership, times(1)).record(eq(USER), startsWith("drama/canvas/looks/"), eq(16L), eq("image/png"));
        // 参考图按 key 重签后送给模型
        verify(render, atLeastOnce()).generateImageBytes(eq(ep), eq("P"), eq("9:16"),
                eq(List.of("https://cdn.example.com/drama/canvas/scenes/b.png")));
    }

    @Test
    void imageRun_notAnImage_isNotStoredNorCharged() {
        imageRun("dcr_i2", 1, "dcr_i2", null);
        when(render.generateImageBytes(any(), any(), any(), any())).thenReturn("<html>502</html>".getBytes());
        worker.runBlocking("dcr_i2");
        DramaCanvasRun r = store.get("dcr_i2");
        assertEquals("failed", r.getStatus());
        assertEquals("IMAGE_BAD_OUTPUT", r.getErrorCode());
        verify(render, never()).storeImageBytes(any(), any(), any());
        verify(credits, never()).commitHold(any(), any(), anyLong(), any());
        verify(credits).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_i2"), anyString());
    }

    @Test
    void imageBatch_sharedHold_chargedPerSuccess_releasedOnceAtTheEnd() {
        List<String> ids = List.of("dcr_b1", "dcr_b2");
        imageRun("dcr_b1", 1, "dcb_x", ids);
        imageRun("dcr_b2", 1, "dcb_x", ids);
        when(render.generateImageBytes(any(), any(), any(), any()))
                .thenReturn(pngBytes())
                .thenThrow(new BusinessException(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED", "图片没生成出来"));
        worker.runBatch(ids, "dcb_x");

        assertEquals("succeeded", store.get("dcr_b1").getStatus());
        assertEquals("failed", store.get("dcr_b2").getStatus());
        verify(credits, times(1)).commitHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcb_x"), eq(2L), anyString());
        verify(credits, times(1)).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcb_x"), anyString());
        verify(credits, never()).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_b1"), anyString());
        verify(credits, never()).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_b2"), anyString());
    }

    // ── 视频同步 ───────────────────────────────────────────────────────────────

    private DramaCanvasRun videoRun(String id, String jobId) {
        DramaCanvasRun r = run(id, "video", DramaCanvasRun.STATUS_QUEUED, OM.createObjectNode());
        r.setJobId(jobId);
        r.setCost(200);
        store.put(id, r);
        return r;
    }

    @Test
    void videoSync_succeededJob_givesKeyAndLastFrameKey_bothRecordedAsOwned() throws Exception {
        videoRun("dcr_v1", "mvj_1");
        String url = "https://cdn.example.com/media/material-videos/mvj_1/video.mp4";
        when(jobs.findById("mvj_1")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_1").status("succeeded")
                .videoUrl(url).lastFrameCdnKey("media/material-videos/mvj_1/last-frame.png").durationSec(5)
                .creditsHeld(200).completedAt(OffsetDateTime.parse("2026-09-30T10:00:00Z")).build()));
        when(signer.keyOf(url)).thenReturn("media/material-videos/mvj_1/video.mp4");

        DramaCanvasRun r = worker.syncVideo(store.get("dcr_v1"));
        assertEquals("succeeded", r.getStatus());
        JsonNode v = OM.readTree(r.getResultJson()).path("video");
        assertEquals("media/material-videos/mvj_1/video.mp4", v.path("key").asText());
        assertEquals("media/material-videos/mvj_1/last-frame.png", v.path("lastFrameKey").asText());
        assertEquals(5, v.path("durationSec").asInt());
        assertEquals("dcr_v1", v.path("runId").asText());
        assertEquals("2026-09-30T10:00:00Z", v.path("createdAt").asText());
        assertFalse(v.has("url"), "库里只存 key");
        verify(ownership).record(USER, "media/material-videos/mvj_1/video.mp4", 0, "video/mp4");
        verify(ownership).record(USER, "media/material-videos/mvj_1/last-frame.png", 0, "image/png");
    }

    @Test
    void videoSync_localFakeCdnUrl_stillYieldsKey() throws Exception {
        videoRun("dcr_v2", "mvj_2");
        when(jobs.findById("mvj_2")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_2").status("succeeded")
                .videoUrl("/cdn/material-videos/mvj_2/video.mp4").durationSec(5).build()));
        when(signer.keyOf(anyString())).thenReturn(null);
        when(signer.publicUrlFor("__k__")).thenReturn("/cdn/__k__");
        DramaCanvasRun r = worker.syncVideo(store.get("dcr_v2"));
        assertEquals("material-videos/mvj_2/video.mp4",
                OM.readTree(r.getResultJson()).path("video").path("key").asText());
    }

    @Test
    void videoSync_failedJob_failsRun_generatingJob_marksRunning() {
        videoRun("dcr_v3", "mvj_3");
        when(jobs.findById("mvj_3")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_3").status("generating").build()));
        assertEquals("running", worker.syncVideo(store.get("dcr_v3")).getStatus());
        when(jobs.findById("mvj_3")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_3").status("failed")
                .errorMessage("视频大模型返回失败（status=FAILED：内容不合规，taskId=abc123）").build()));
        DramaCanvasRun r = worker.syncVideo(store.get("dcr_v3"));
        assertEquals("failed", r.getStatus());
        assertEquals("VIDEO_GENERATION_FAILED", r.getErrorCode());
        assertTrue(r.getErrorMessage().contains("内容不合规"));
        assertFalse(r.getErrorMessage().contains("taskId"), r.getErrorMessage());
    }

    @Test
    void videoSync_providerUrlOnly_failsHonestly() {
        videoRun("dcr_v4", "mvj_4");
        when(jobs.findById("mvj_4")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_4").status("succeeded")
                .videoUrl("https://provider.example.net/tmp/v.mp4").durationSec(5).build()));
        DramaCanvasRun r = worker.syncVideo(store.get("dcr_v4"));
        assertEquals("failed", r.getStatus());
        assertEquals("DRAMA_CANVAS_VIDEO_NOT_STORED", r.getErrorCode());
    }

    @Test
    void videoSync_mirrorFailedJob_failsRunWithPlainWords() {
        videoRun("dcr_v5", "mvj_5");
        when(jobs.findById("mvj_5")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_5").status("failed")
                .errorMessage(MaterialVideoWorker.MIRROR_FAILED_CODE + "：视频生成好了，但没能存进我方存储（oss down）").build()));
        DramaCanvasRun r = worker.syncVideo(store.get("dcr_v5"));
        assertEquals("failed", r.getStatus());
        assertEquals("VIDEO_MIRROR_FAILED", r.getErrorCode());
        assertEquals("视频生成好了但没存下来，积分已退回，请重试。", r.getErrorMessage());
    }

    @Test
    void reapVideo_queuedNeverSubmittedFor30Min_expiresJobAndFailsRun() {
        videoRun("dcr_v6", "mvj_6");
        when(jobs.findById("mvj_6")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_6").status("queued")
                .createdAt(OffsetDateTime.now().minusMinutes(40)).build()));
        when(videoJobs.expireQueued(eq("mvj_6"), eq(USER), anyString())).thenReturn(true);
        assertTrue(worker.reapVideo(store.get("dcr_v6"), OffsetDateTime.now()));
        DramaCanvasRun r = store.get("dcr_v6");
        assertEquals("failed", r.getStatus());
        assertEquals("DRAMA_CANVAS_VIDEO_QUEUE_TIMEOUT", r.getErrorCode());
        assertTrue(r.getErrorMessage().contains("积分已退回"));
    }

    @Test
    void reapVideo_notYet30Min_orLostRaceToWorker_leavesItAlone() {
        videoRun("dcr_v7", "mvj_7");
        when(jobs.findById("mvj_7")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_7").status("queued")
                .createdAt(OffsetDateTime.now().minusMinutes(10)).build()));
        assertFalse(worker.reapVideo(store.get("dcr_v7"), OffsetDateTime.now()));
        verify(videoJobs, never()).expireQueued(any(), any(), any());

        when(jobs.findById("mvj_7")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_7").status("queued")
                .createdAt(OffsetDateTime.now().minusMinutes(40)).build()));
        when(videoJobs.expireQueued(eq("mvj_7"), eq(USER), anyString())).thenReturn(false); // worker 刚好接手
        assertFalse(worker.reapVideo(store.get("dcr_v7"), OffsetDateTime.now()));
        assertEquals("queued", store.get("dcr_v7").getStatus());
    }

    @Test
    void reapVideo_alreadySentToVendor_staysRunning_notesItOnce_noErrorMessage() throws Exception {
        DramaCanvasRun v = videoRun("dcr_v8", "mvj_8");
        v.setRefsJson("{\"requested\":1,\"applied\":1,\"notes\":[]}");
        when(jobs.findById("mvj_8")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_8").status("generating")
                .externalTaskId("task_8").createdAt(OffsetDateTime.now().minusMinutes(50)).build()));
        assertFalse(worker.reapVideo(store.get("dcr_v8"), OffsetDateTime.now()));
        assertFalse(worker.reapVideo(store.get("dcr_v8"), OffsetDateTime.now()));

        DramaCanvasRun r = store.get("dcr_v8");
        assertEquals("running", r.getStatus());
        assertNull(r.getErrorMessage());
        JsonNode notes = OM.readTree(r.getRefsJson()).path("notes");
        assertEquals(1, notes.size(), "只提示一次：" + notes);
        assertEquals(DramaCanvasRunWorker.SLOW_VIDEO_NOTE, notes.get(0).asText());
        assertEquals(1, OM.readTree(r.getRefsJson()).path("applied").asInt(), "原有的参考图统计保留");
        verify(videoJobs, never()).expireQueued(any(), any(), any());
    }

    // ── 超时回收 ───────────────────────────────────────────────────────────────

    @Test
    void sweeper_expiresStaleRuns_butLeavesALiveBatchAlone() {
        DramaCanvasRun stale = textRun("dcr_s1", "storyboard", storyboardMeta(), "x");
        stale.setStatus(DramaCanvasRun.STATUS_RUNNING);
        stale.setUpdatedAt(OffsetDateTime.now().minusMinutes(20));

        List<String> ids = List.of("dcr_s2", "dcr_s3");
        DramaCanvasRun b1 = imageRun("dcr_s2", 1, "dcb_live", ids);
        b1.setUpdatedAt(OffsetDateTime.now().minusMinutes(30));
        imageRun("dcr_s3", 1, "dcb_live", ids).setUpdatedAt(OffsetDateTime.now()); // 这一批还有项在动

        DramaCanvasRun assembling = run("dcr_s4", "assemble", DramaCanvasRun.STATUS_RUNNING, OM.createObjectNode());
        assembling.setUpdatedAt(OffsetDateTime.now().minusMinutes(15)); // 合成给 20 分钟
        store.put("dcr_s4", assembling);

        int n = new DramaCanvasRunSweeper(runs, worker, holds).sweep(OffsetDateTime.now());
        assertEquals(1, n);
        assertEquals("failed", store.get("dcr_s1").getStatus());
        assertEquals("DRAMA_CANVAS_RUN_TIMEOUT", store.get("dcr_s1").getErrorCode());
        verify(credits).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_s1"), anyString());
        assertEquals("queued", store.get("dcr_s2").getStatus());
        assertEquals("running", store.get("dcr_s4").getStatus());
        verify(credits, never()).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcb_live"), anyString());
    }

    @Test
    void sweeper_wholeBatchStale_expiresMembersAndReleasesSharedHoldOnce() {
        List<String> ids = List.of("dcr_s5", "dcr_s6");
        imageRun("dcr_s5", 1, "dcb_dead", ids).setUpdatedAt(OffsetDateTime.now().minusMinutes(30));
        imageRun("dcr_s6", 1, "dcb_dead", ids).setUpdatedAt(OffsetDateTime.now().minusMinutes(30));
        int n = new DramaCanvasRunSweeper(runs, worker, holds).sweep(OffsetDateTime.now());
        assertEquals(2, n);
        verify(credits, times(1)).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcb_dead"), anyString());
    }

    // ── P1-1 结算与结果同一事务 ────────────────────────────────────────────────

    @Test
    void imageRun_commitThrowsOnSecond_thatImageIsNotInResult_firstIsKeptAndCharged() throws Exception {
        imageRun("dcr_a1", 3, "dcr_a1", null);
        when(render.generateImageBytes(any(), any(), any(), any())).thenReturn(pngBytes());
        when(credits.commitHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_a1"), eq(2L), anyString()))
                .thenReturn(null)
                .thenThrow(new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT, "hold 已是终态"));
        worker.runBlocking("dcr_a1");

        DramaCanvasRun r = store.get("dcr_a1");
        assertEquals("succeeded", r.getStatus());
        JsonNode images = OM.readTree(r.getResultJson()).path("images");
        assertEquals(1, images.size(), "第二张的结算回滚了，结果里也没有它");
        assertEquals(2, r.getCost());
        verify(credits).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_a1"), anyString());
    }

    @Test
    void processDiedAfterFirstImage_sweeperKeepsItAsPartialSuccess_refundsTheRest() throws Exception {
        DramaCanvasRun r = imageRun("dcr_a2", 3, "dcr_a2", null);
        r.setStatus(DramaCanvasRun.STATUS_RUNNING);
        r.setResultJson("{\"images\":[{\"key\":\"drama/canvas/looks/one.png\",\"runId\":\"dcr_a2\"}]}");
        r.setUpdatedAt(OffsetDateTime.now().minusMinutes(20)); // worker 结算完第一张后进程没了

        assertEquals(1, new DramaCanvasRunSweeper(runs, worker, holds).sweep(OffsetDateTime.now()));
        DramaCanvasRun after = store.get("dcr_a2");
        assertEquals("succeeded", after.getStatus(), "已结算的图不能丢");
        assertEquals(2, after.getCost(), "只算出来的那张");
        assertEquals(1, OM.readTree(after.getResultJson()).path("images").size());
        assertTrue(after.getRefsJson().contains("只出了 1 张"), after.getRefsJson());
        verify(credits, times(1)).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_a2"), anyString());
        verify(credits, never()).commitHold(any(), any(), anyLong(), any());
    }

    // ── P1-2 回收与完成：只有一方生效 ─────────────────────────────────────────

    private static final String OK_STORYBOARD =
            "{\"segments\":[{\"text\":\"（4 秒）@[林微](look:lk1) 蹲着。\",\"durationSec\":4}],\"notes\":[]}";

    @Test
    void race_sweeperReadsRunningFirst_workerSucceedsFirst_onlyWorkerWins_chargedOnce() {
        DramaCanvasRun r = textRun("dcr_r1", "storyboard", storyboardMeta(), "切片段");
        r.setStatus(DramaCanvasRun.STATUS_RUNNING);
        r.setUpdatedAt(OffsetDateTime.now().minusMinutes(20));
        DramaCanvasRun seenBySweeper = copy(r); // 回收器读到的是 running + 旧心跳
        r.setStatus(DramaCanvasRun.STATUS_QUEUED); // worker 这边还能认领
        when(invocation.invokeChat(any(), any(), any())).thenReturn(reply(OK_STORYBOARD));
        worker.runBlocking("dcr_r1");                       // worker 先成功（写结果 + 结算）
        assertFalse(worker.expireStale(seenBySweeper, true)); // 回收器拿旧值收尾 → 影响 0 行

        assertEquals("succeeded", store.get("dcr_r1").getStatus());
        verify(credits, times(1)).commitHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_r1"), eq(4L), anyString());
        verify(credits, never()).releaseHold(any(), any(), any());
    }

    @Test
    void race_sweeperExpiresWhileWorkerIsGenerating_workerDoesNotCharge_refundedOnce() {
        textRun("dcr_r2", "storyboard", storyboardMeta(), "切片段");
        when(invocation.invokeChat(any(), any(), any())).thenAnswer(inv -> {
            // 模型还在算的时候，回收器用它此刻读到的值收了尾（判失败 + 退款）
            assertTrue(worker.expireStale(copy(store.get("dcr_r2")), true));
            return reply(OK_STORYBOARD);
        });
        worker.runBlocking("dcr_r2");

        DramaCanvasRun r = store.get("dcr_r2");
        assertEquals("failed", r.getStatus());
        assertEquals("DRAMA_CANVAS_RUN_TIMEOUT", r.getErrorCode());
        assertNull(r.getResultJson(), "worker 的结果没写进去");
        verify(credits, never()).commitHold(any(), any(), anyLong(), any());
        verify(credits, times(1)).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_r2"), anyString());
    }

    @Test
    void race_sweeperExpiresBetweenImages_nextImageIsNotCharged() throws Exception {
        imageRun("dcr_r3", 2, "dcr_r3", null);
        int[] calls = {0};
        when(render.generateImageBytes(any(), any(), any(), any())).thenAnswer(inv -> {
            if (++calls[0] == 2) assertTrue(worker.expireStale(copy(store.get("dcr_r3")), true));
            return pngBytes();
        });
        worker.runBlocking("dcr_r3");

        DramaCanvasRun r = store.get("dcr_r3");
        assertEquals("succeeded", r.getStatus(), "回收时已有 1 张结算过 → 部分成功");
        assertEquals(1, OM.readTree(r.getResultJson()).path("images").size());
        verify(credits, times(1)).commitHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_r3"), eq(2L), anyString());
        verify(credits, times(1)).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_r3"), anyString());
    }

    // ── P1-3 对账恢复 ─────────────────────────────────────────────────────────

    @Test
    void failedVideoRun_jobRecoveredByAdminReconcile_isFlippedBackToSucceeded() throws Exception {
        DramaCanvasRun v = videoRun("dcr_v9", "mvj_9");
        v.setStatus(DramaCanvasRun.STATUS_FAILED);
        v.setErrorCode("VIDEO_GENERATION_FAILED");
        String url = "https://cdn.example.com/media/material-videos/mvj_9/video.mp4";
        when(jobs.findById("mvj_9")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_9").status("succeeded")
                .videoUrl(url).durationSec(5).creditsHeld(200).build()));
        when(signer.keyOf(url)).thenReturn("media/material-videos/mvj_9/video.mp4");
        when(runs.findRecoverableVideoRuns(any())).thenReturn(List.of(store.get("dcr_v9")));

        assertEquals(1, worker.recoverVideos(100));
        DramaCanvasRun r = store.get("dcr_v9");
        assertEquals("succeeded", r.getStatus());
        assertNull(r.getErrorCode());
        assertEquals("media/material-videos/mvj_9/video.mp4",
                OM.readTree(r.getResultJson()).path("video").path("key").asText());
        verify(ownership).record(USER, "media/material-videos/mvj_9/video.mp4", 0, "video/mp4");
        verifyNoInteractions(videoJobs); // 只同步原任务，绝不重新提交
    }

    @Test
    void failedVideoRun_jobStillFailed_staysFailed() {
        DramaCanvasRun v = videoRun("dcr_v10", "mvj_10");
        v.setStatus(DramaCanvasRun.STATUS_FAILED);
        when(jobs.findById("mvj_10")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_10").status("failed").build()));
        assertEquals("failed", worker.syncVideo(store.get("dcr_v10")).getStatus());
    }

    // ── P2-4 线程池拒绝 ────────────────────────────────────────────────────────

    @Test
    void rejectedDispatch_failsAndRefundsImmediately_inItsOwnTransaction_evenFromAfterCommit() {
        textRun("dcr_q1", "storyboard", storyboardMeta(), "切片段");
        worker.shutdown(); // 线程池关了 → execute 必然被拒
        org.springframework.transaction.support.TransactionTemplate outer =
                new org.springframework.transaction.support.TransactionTemplate(tm);
        outer.executeWithoutResult(s -> org.springframework.transaction.support.TransactionSynchronizationManager
                .registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        worker.dispatch(List.of("dcr_q1"));
                    }
                }));
        DramaCanvasRun r = store.get("dcr_q1");
        assertEquals("failed", r.getStatus());
        assertEquals("DRAMA_CANVAS_QUEUE_FULL", r.getErrorCode());
        verify(credits).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_q1"), anyString());
        verifyNoInteractions(invocation);
    }

    // ── P2-5 单条运行时长上限 ──────────────────────────────────────────────────

    @Test
    void runPastDeadline_stopsCallingUpstream_refunds() {
        textRun("dcr_d1", "storyboard", storyboardMeta(), "切片段").setCreatedAt(OffsetDateTime.now().minusMinutes(100));
        worker.runBlocking("dcr_d1");
        assertEquals("DRAMA_CANVAS_RUN_DEADLINE", store.get("dcr_d1").getErrorCode());
        verifyNoInteractions(invocation);
        verify(credits).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_d1"), anyString());

        imageRun("dcr_d2", 2, "dcr_d2", null).setCreatedAt(OffsetDateTime.now().minusMinutes(100));
        worker.runBlocking("dcr_d2");
        assertEquals("DRAMA_CANVAS_RUN_DEADLINE", store.get("dcr_d2").getErrorCode());
        verify(render, never()).generateImageBytes(any(), any(), any(), any());
        verify(credits).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_d2"), anyString());
    }

    // ── N1 批量全部终态后共用冻结没退 ──────────────────────────────────────────

    private com.aistareco.aep.model.CreditHold activeHold(String ref) {
        return com.aistareco.aep.model.CreditHold.builder().id("h_" + ref).userId(USER)
                .referenceType(DramaCanvasRunService.REF_TYPE).referenceId(ref).amount(8).remainingAmount(6)
                .status(com.aistareco.aep.model.CreditHold.Status.ACTIVE).createdAt(java.time.Instant.now().minusSeconds(900))
                .build();
    }

    @Test
    void orphanBatchHold_allMembersTerminal_isReleased_liveBatchIsLeftAlone() {
        List<String> done = List.of("dcr_n1a", "dcr_n1b");
        imageRun("dcr_n1a", 1, "dcb_n1a", done).setStatus(DramaCanvasRun.STATUS_SUCCEEDED);
        imageRun("dcr_n1b", 1, "dcb_n1a", done).setStatus(DramaCanvasRun.STATUS_FAILED);
        List<String> live = List.of("dcr_n2a", "dcr_n2b");
        imageRun("dcr_n2a", 1, "dcb_n2a", live).setStatus(DramaCanvasRun.STATUS_SUCCEEDED);
        imageRun("dcr_n2b", 1, "dcb_n2a", live).setStatus(DramaCanvasRun.STATUS_RUNNING);
        com.aistareco.aep.model.CreditHold single = activeHold("dcr_solo"); // 单条运行的冻结：不归这里管
        when(holds.findByStatusAndCreatedAtBefore(eq(com.aistareco.aep.model.CreditHold.Status.ACTIVE), any()))
                .thenReturn(List.of(activeHold("dcb_n1a"), activeHold("dcb_n2a"), single));

        assertEquals(1, new DramaCanvasRunSweeper(runs, worker, holds).releaseOrphanBatchHolds(OffsetDateTime.now()));
        verify(credits, times(1)).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcb_n1a"), anyString());
        verify(credits, never()).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcb_n2a"), anyString());
        verify(credits, never()).releaseHold(eq(DramaCanvasRunService.REF_TYPE), eq("dcr_solo"), anyString());
    }

    @Test
    void batchHoldRef_isDerivedFromTheLeadRun_andBack() {
        String lead = DramaCanvasRunService.newRunId();
        String ref = DramaCanvasRunService.batchHoldRefOf(lead);
        assertTrue(ref.startsWith("dcb_"));
        assertEquals(lead, DramaCanvasRunService.batchLeadRunIdOf(ref));
        assertNull(DramaCanvasRunService.batchLeadRunIdOf("dcr_whatever"));
    }

    // ── N2 视频并发同步：只有赢家登记归属 ──────────────────────────────────────

    @Test
    void concurrentVideoSync_onlyTheWinnerRecordsOwnership() {
        videoRun("dcr_w1", "mvj_w1");
        String url = "https://cdn.example.com/media/material-videos/mvj_w1/video.mp4";
        when(jobs.findById("mvj_w1")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_w1").status("succeeded")
                .videoUrl(url).lastFrameCdnKey("media/material-videos/mvj_w1/last-frame.png").durationSec(5).build()));
        when(signer.keyOf(url)).thenReturn("media/material-videos/mvj_w1/video.mp4");
        DramaCanvasRun seenByOther = copy(store.get("dcr_w1")); // 另一路（GET 或回收器）同时读到的 queued

        assertEquals("succeeded", worker.syncVideo(store.get("dcr_w1")).getStatus());
        worker.syncVideo(seenByOther); // 输家：条件更新影响 0 行

        verify(ownership, times(1)).record(USER, "media/material-videos/mvj_w1/video.mp4", 0, "video/mp4");
        verify(ownership, times(1)).record(USER, "media/material-videos/mvj_w1/last-frame.png", 0, "image/png");
    }

    // ── N3 登记失败可重试 ──────────────────────────────────────────────────────

    @Test
    void ownershipRecordFails_markedRetryable_thenAutoRecovers() throws Exception {
        videoRun("dcr_w2", "mvj_w2");
        String url = "https://cdn.example.com/media/material-videos/mvj_w2/video.mp4";
        when(jobs.findById("mvj_w2")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_w2").status("succeeded")
                .videoUrl(url).durationSec(5).creditsHeld(200).build()));
        when(signer.keyOf(url)).thenReturn("media/material-videos/mvj_w2/video.mp4");
        doThrow(new RuntimeException("db hiccup")).doNothing()
                .when(ownership).record(USER, "media/material-videos/mvj_w2/video.mp4", 0, "video/mp4");

        DramaCanvasRun r = worker.syncVideo(store.get("dcr_w2"));
        assertEquals("failed", r.getStatus());
        assertEquals("DRAMA_CANVAS_VIDEO_RECORD_FAILED", r.getErrorCode(), "不是 NOT_STORED：平台 key 是有的，可以重试");
        assertNull(r.getResultJson(), "登记失败时状态迁移一起回滚了，没留半截结果");

        when(runs.findRecoverableVideoRuns(any())).thenReturn(List.of(store.get("dcr_w2")));
        assertEquals(1, worker.recoverVideos(100));
        DramaCanvasRun after = store.get("dcr_w2");
        assertEquals("succeeded", after.getStatus());
        assertEquals("media/material-videos/mvj_w2/video.mp4",
                OM.readTree(after.getResultJson()).path("video").path("key").asText());
    }

    // ── 错误文案 ───────────────────────────────────────────────────────────────

    @Test
    void upstreamRejection_4xxSaysWhy_5xxStaysVague_secretsMasked() {
        assertTrue(DramaCanvasRunWorker.upstreamRejection(
                "endpoint=e status=422 body={\"message\":\"size must be one of 1024x1024\"}").contains("size must be"));
        assertNull(DramaCanvasRunWorker.upstreamRejection("endpoint=e status=503 body={\"message\":\"overloaded\"}"));
        assertEquals("模型拒绝了这次请求（上游 400），积分已退回。",
                DramaCanvasRunWorker.upstreamRejection("status=400 body=<html>bad</html>"));
        String masked = DramaCanvasRunWorker.upstreamRejection(
                "status=401 body={\"error\":{\"message\":\"invalid key sk-abcdef1234567890\"}}");
        assertFalse(masked.contains("abcdef1234567890"), masked);
    }
}
