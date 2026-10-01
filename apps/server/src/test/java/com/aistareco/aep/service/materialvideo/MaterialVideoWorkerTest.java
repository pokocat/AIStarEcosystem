package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpHeaders;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * C-1 末帧 CDN 镜像语义回归（Worker 成功分支）：
 *  - 成功：video / thumbnail / last-frame 三件均 upload，lastFrameCdnKey 落 key、lastFrameUrl 保留上游 URL；
 *  - 末帧镜像失败（best-effort，§8.0 观测类旁路例外）：任务仍 succeeded、lastFrameCdnKey=null、
 *    lastFrameUrl 保留上游、绝不 markFailed / releaseHold。
 * 纯 Mockito 单测（无 Spring，无 CDN driver 依赖）；上游成片/末帧 URL 用本机内嵌 HttpServer 供 worker 真实下载。
 */
class MaterialVideoWorkerTest {

    private HttpServer http;
    private String base;

    private MaterialVideoJobRepository jobRepo;
    private MaterialVideoModelClient modelClient;
    private CreditService creditService;
    private StorageQuotaService storage;
    private MaterialVideoJob job;

    @BeforeEach
    void setUp() throws IOException {
        http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        http.createContext("/", ex -> {
            byte[] body = new byte[]{1, 2, 3, 4};
            String ct = ex.getRequestURI().getPath().endsWith(".mp4") ? "video/mp4" : "image/png";
            ex.getResponseHeaders().set("Content-Type", ct);
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        http.start();
        base = "http://127.0.0.1:" + http.getAddress().getPort();

        job = MaterialVideoJob.builder()
                .id("mvj_test")
                .ownerUserId("u1")
                .scriptId("dp_1")
                .name("测试镜")
                .kind("drama-shot")
                .prompt("p")
                .status("queued")
                .progress(0)
                .creditsHeld(0L)
                .createdAt(OffsetDateTime.now())
                .build();

        jobRepo = mock(MaterialVideoJobRepository.class);
        when(jobRepo.findById("mvj_test")).thenReturn(Optional.of(job));
        when(jobRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        modelClient = mock(MaterialVideoModelClient.class);
        // 默认路径回归（D-11）：job.variantConfigJson 无 endpoint_id → worker 传 null → 默认端点，行为不变。
        var submit = new MaterialVideoModelClient.SubmitResult("task_1", null, "vendor", "model-x", "generic", null);
        when(modelClient.submit(any(), anyInt(), any(), any(), any(), any(), any())).thenReturn(submit);
        when(modelClient.poll(any(MaterialVideoModelClient.SubmitResult.class))).thenReturn(new MaterialVideoModelClient.PollResult(
                "succeeded", base + "/video.mp4", base + "/thumb.png", "SUCCESS", 100, null, base + "/last.png"));

        creditService = mock(CreditService.class);
        storage = mock(StorageQuotaService.class);
    }

    @AfterEach
    void tearDown() {
        http.stop(0);
    }

    private MaterialVideoWorker worker(CdnUploader uploader) {
        MaterialVideoProperties props = new MaterialVideoProperties();
        props.setUploadToCdn(true);
        props.setPollIntervalSeconds(1); // worker 内部 Math.max(2,...) → 实际 2s，一次 poll 即成功

        @SuppressWarnings("unchecked")
        ObjectProvider<CdnUploader> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(uploader);
        return new MaterialVideoWorker(jobRepo, modelClient, props, creditService, storage, provider);
    }

    /** 假 CDN：记录 upload 过的 key；lastFrameFails=true 时 last-frame key 抛 IOException（模拟末帧镜像失败）。 */
    private static final class FakeUploader implements CdnUploader {
        final ConcurrentHashMap<String, Long> uploaded = new ConcurrentHashMap<>();
        final boolean lastFrameFails;

        FakeUploader(boolean lastFrameFails) {
            this.lastFrameFails = lastFrameFails;
        }

        @Override
        public CdnUploadResult upload(Path localFile, String key, String contentType) throws IOException {
            if (lastFrameFails && key.contains("last-frame")) {
                throw new IOException("simulated last-frame upload failure");
            }
            uploaded.put(key, 4L);
            return new CdnUploadResult("https://cdn.test/" + key, key, 4L, Instant.now());
        }

        @Override
        public void delete(String key) { /* no-op */ }

        @Override
        public String publicUrlFor(String key) { return "https://cdn.test/" + key; }

        @Override
        public String driverName() { return "fake"; }
    }

    @Test
    void success_mirrors_last_frame_to_cdn_and_stores_key() {
        FakeUploader uploader = new FakeUploader(false);
        worker(uploader).generateAsync("mvj_test");

        assertEquals("succeeded", job.getStatus());
        assertTrue(uploader.uploaded.containsKey("material-videos/mvj_test/video.mp4"));
        assertTrue(uploader.uploaded.containsKey("material-videos/mvj_test/last-frame.png"));
        // 真值 = cdnKey（§4.7.4）；上游临时 URL 仍保留作 fallback
        assertEquals("material-videos/mvj_test/last-frame.png", job.getLastFrameCdnKey());
        assertNotNull(job.getLastFrameUrl());
        assertTrue(job.getLastFrameUrl().endsWith("/last.png"));
        verify(creditService, never()).releaseHold(anyString(), anyString(), anyString());
    }

    @Test
    void last_frame_mirror_failure_keeps_job_succeeded_without_key() {
        FakeUploader uploader = new FakeUploader(true);
        worker(uploader).generateAsync("mvj_test");

        // 末帧镜像失败 = 观测类旁路（§8.0 例外）：任务仍成功、不退积分，key 为空 → 下游读上游 URL 兜底
        assertEquals("succeeded", job.getStatus());
        assertNull(job.getLastFrameCdnKey());
        assertNotNull(job.getLastFrameUrl());
        assertTrue(job.getLastFrameUrl().endsWith("/last.png"));
        assertNull(job.getErrorMessage());
        // 成片本身照常镜像
        assertTrue(uploader.uploaded.containsKey("material-videos/mvj_test/video.mp4"));
        verify(creditService, never()).releaseHold(anyString(), anyString(), anyString());
    }

    @Test
    void protected_output_asset_is_downloaded_with_model_client_then_mirrored() throws Exception {
        var submit = new MaterialVideoModelClient.SubmitResult(
                "job_h3", null, "MiniMax H3", "minimax-h3", "jusuan-media", "ep-h3");
        when(modelClient.submit(any(), anyInt(), any(), any(), any(), any(), any())).thenReturn(submit);
        when(modelClient.poll(any(MaterialVideoModelClient.SubmitResult.class))).thenReturn(
                new MaterialVideoModelClient.PollResult(
                        "succeeded", null, null, "succeeded", 100, null, null, "asset_video_h3"));
        @SuppressWarnings("unchecked")
        HttpResponse<Path> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.headers()).thenReturn(HttpHeaders.of(
                Map.of("content-type", List.of("video/mp4")), (a, b) -> true));
        when(modelClient.downloadOutputAsset(eq(submit), eq("asset_video_h3"), any(Path.class)))
                .thenAnswer(inv -> {
                    Path target = inv.getArgument(2);
                    Files.write(target, new byte[]{1, 2, 3, 4});
                    when(response.body()).thenReturn(target);
                    return response;
                });

        FakeUploader uploader = new FakeUploader(false);
        worker(uploader).generateAsync("mvj_test");

        assertEquals("succeeded", job.getStatus());
        assertEquals("https://cdn.test/material-videos/mvj_test/video.mp4", job.getVideoUrl());
        assertTrue(uploader.uploaded.containsKey("material-videos/mvj_test/video.mp4"));
        verify(modelClient).downloadOutputAsset(eq(submit), eq("asset_video_h3"), any(Path.class));
    }

    @Test
    void reconcile_existing_upstream_success_mirrors_and_charges_exact_per_second_price() throws Exception {
        job.setStatus("failed");
        job.setExternalTaskId("job_h3_existing");
        job.setProviderUsed("MiniMax H3");
        job.setModelUsed("minimax-h3");
        job.setDurationSec(15);
        job.setCreditsHeld(30L);

        var submit = new MaterialVideoModelClient.SubmitResult(
                "job_h3_existing", null, "MiniMax H3", "minimax-h3", "jusuan-media", "ep-h3");
        when(modelClient.resumeExistingTask("job_h3_existing", null, "MiniMax H3", "minimax-h3"))
                .thenReturn(submit);
        when(modelClient.poll(eq(submit))).thenReturn(new MaterialVideoModelClient.PollResult(
                "succeeded", null, null, "succeeded", 100, null, null, "asset_h3_existing"));
        when(modelClient.resolveCreditCostOverride(null, 15)).thenReturn(600L);

        CreditHold hold = CreditHold.builder()
                .id("hold-recovery").userId("u1")
                .referenceType(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE)
                .referenceId("mvj_test").amount(600L).remainingAmount(600L)
                .status(CreditHold.Status.ACTIVE).build();
        when(creditService.findHold(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE, "mvj_test"))
                .thenReturn(null);
        when(creditService.hold(eq("u1"), eq(600L), eq(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE),
                eq("mvj_test"), anyString())).thenReturn(hold);

        @SuppressWarnings("unchecked")
        HttpResponse<Path> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.headers()).thenReturn(HttpHeaders.of(
                Map.of("content-type", List.of("video/mp4")), (a, b) -> true));
        when(modelClient.downloadOutputAsset(eq(submit), eq("asset_h3_existing"), any(Path.class)))
                .thenAnswer(inv -> {
                    Path target = inv.getArgument(2);
                    Files.write(target, new byte[]{1, 2, 3, 4});
                    when(response.body()).thenReturn(target);
                    return response;
                });

        MaterialVideoJob recovered = worker(new FakeUploader(false)).reconcileSucceeded("mvj_test");

        assertEquals("succeeded", recovered.getStatus());
        assertEquals(600L, recovered.getCreditsHeld());
        assertEquals("https://cdn.test/material-videos/mvj_test/video.mp4", recovered.getVideoUrl());
        verify(creditService).hold(eq("u1"), eq(600L), eq(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE),
                eq("mvj_test"), anyString());
        verify(creditService).commitHold(eq(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE),
                eq("mvj_test"), eq(600L), anyString());
    }

    @Test
    void reconcile_caller_priced_job_charges_the_frozen_price_not_the_endpoint_rate() throws Exception {
        // 视频生成区 544p · 5 秒冻的是 100（20/秒）。按端点单价 × 秒数重算会收成 768p 的 200。
        job.setStatus("failed");
        job.setExternalTaskId("job_h3_studio");
        job.setProviderUsed("MiniMax H3");
        job.setModelUsed("minimax-h3");
        job.setDurationSec(5);
        job.setCreditsHeld(100L);
        job.setPayloadJson("{\"credit_label\":\"视频生成\",\"caller_priced\":true}");

        var submit = new MaterialVideoModelClient.SubmitResult(
                "job_h3_studio", null, "MiniMax H3", "minimax-h3", "jusuan-media", "ep-h3");
        when(modelClient.resumeExistingTask("job_h3_studio", null, "MiniMax H3", "minimax-h3")).thenReturn(submit);
        when(modelClient.poll(eq(submit))).thenReturn(new MaterialVideoModelClient.PollResult(
                "succeeded", null, null, "succeeded", 100, null, null, "asset_h3_studio"));
        when(modelClient.resolveCreditCostOverride(any(), anyInt())).thenReturn(200L);

        CreditHold hold = CreditHold.builder()
                .id("hold-recovery-studio").userId("u1")
                .referenceType(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE)
                .referenceId("mvj_test").amount(100L).remainingAmount(100L)
                .status(CreditHold.Status.ACTIVE).build();
        when(creditService.findHold(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE, "mvj_test")).thenReturn(null);
        when(creditService.hold(eq("u1"), eq(100L), eq(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE),
                eq("mvj_test"), anyString())).thenReturn(hold);

        @SuppressWarnings("unchecked")
        HttpResponse<Path> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.headers()).thenReturn(HttpHeaders.of(
                Map.of("content-type", List.of("video/mp4")), (a, b) -> true));
        when(modelClient.downloadOutputAsset(eq(submit), eq("asset_h3_studio"), any(Path.class)))
                .thenAnswer(inv -> {
                    Path target = inv.getArgument(2);
                    Files.write(target, new byte[]{1, 2, 3, 4});
                    when(response.body()).thenReturn(target);
                    return response;
                });

        MaterialVideoJob recovered = worker(new FakeUploader(false)).reconcileSucceeded("mvj_test");

        assertEquals("succeeded", recovered.getStatus());
        assertEquals(100L, recovered.getCreditsHeld());
        verify(modelClient, never()).resolveCreditCostOverride(any(), anyInt());
        verify(creditService).hold(eq("u1"), eq(100L), eq(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE),
                eq("mvj_test"), anyString());
        verify(creditService).commitHold(eq(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE),
                eq("mvj_test"), eq(100L), anyString());
    }

    @Test
    void callerPricedFlagIsReadFromThePayload_andAbsentMeansNo() {
        job.setPayloadJson(null);
        assertFalse(MaterialVideoWorker.callerPriced(job));
        job.setPayloadJson("{\"credit_label\":\"带货视频生成\"}");
        assertFalse(MaterialVideoWorker.callerPriced(job));
        job.setPayloadJson("not json");
        assertFalse(MaterialVideoWorker.callerPriced(job));
        job.setPayloadJson("{\"caller_priced\":true}");
        assertTrue(MaterialVideoWorker.callerPriced(job));
    }

    @Test
    void reconcile_existing_upstream_success_keeps_the_v0131_repricing_for_endpoint_priced_jobs() throws Exception {
        // 上面那条（v0.131）是「端点定价」的老任务：冻的 30 按每秒价补收成 600。这条只是确认
        // 新加的「调用方定价」分支没有把它带跑 —— payload 里没有 caller_priced。
        job.setStatus("failed");
        job.setExternalTaskId("job_h3_existing");
        job.setProviderUsed("MiniMax H3");
        job.setModelUsed("minimax-h3");
        job.setDurationSec(15);
        job.setCreditsHeld(30L);
        job.setPayloadJson("{\"credit_label\":\"带货视频生成\"}");

        var submit = new MaterialVideoModelClient.SubmitResult(
                "job_h3_existing", null, "MiniMax H3", "minimax-h3", "jusuan-media", "ep-h3");
        when(modelClient.resumeExistingTask("job_h3_existing", null, "MiniMax H3", "minimax-h3"))
                .thenReturn(submit);
        when(modelClient.poll(eq(submit))).thenReturn(new MaterialVideoModelClient.PollResult(
                "succeeded", null, null, "succeeded", 100, null, null, "asset_h3_existing"));
        when(modelClient.resolveCreditCostOverride(null, 15)).thenReturn(600L);

        CreditHold hold = CreditHold.builder()
                .id("hold-recovery").userId("u1")
                .referenceType(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE)
                .referenceId("mvj_test").amount(600L).remainingAmount(600L)
                .status(CreditHold.Status.ACTIVE).build();
        when(creditService.findHold(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE, "mvj_test"))
                .thenReturn(null);
        when(creditService.hold(eq("u1"), eq(600L), eq(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE),
                eq("mvj_test"), anyString())).thenReturn(hold);

        @SuppressWarnings("unchecked")
        HttpResponse<Path> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.headers()).thenReturn(HttpHeaders.of(
                Map.of("content-type", List.of("video/mp4")), (a, b) -> true));
        when(modelClient.downloadOutputAsset(eq(submit), eq("asset_h3_existing"), any(Path.class)))
                .thenAnswer(inv -> {
                    Path target = inv.getArgument(2);
                    Files.write(target, new byte[]{1, 2, 3, 4});
                    when(response.body()).thenReturn(target);
                    return response;
                });

        MaterialVideoJob recovered = worker(new FakeUploader(false)).reconcileSucceeded("mvj_test");

        assertEquals("succeeded", recovered.getStatus());
        assertEquals(600L, recovered.getCreditsHeld());
        assertEquals("https://cdn.test/material-videos/mvj_test/video.mp4", recovered.getVideoUrl());
        verify(creditService).hold(eq("u1"), eq(600L), eq(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE),
                eq("mvj_test"), anyString());
        verify(creditService).commitHold(eq(MaterialVideoWorker.RECOVERY_CREDIT_REF_TYPE),
                eq("mvj_test"), eq(600L), anyString());
    }
}
