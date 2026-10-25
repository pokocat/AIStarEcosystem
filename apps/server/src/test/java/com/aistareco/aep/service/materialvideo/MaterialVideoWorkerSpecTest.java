package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;

import java.net.http.HttpHeaders;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * worker 与视频生成区相关的三件事（docs/video-studio-plan.md §5.2 / §5.7）：
 * variant_config 只在 worker 里解析一次并原样交给模型客户端；扣 / 退积分的账本文案用提交时的
 * credit_label（此前写死「带货视频生成」）；studio-* 任务的存储用量记在「视频生成」下。
 */
class MaterialVideoWorkerSpecTest {

    private MaterialVideoJobRepository jobRepo;
    private MaterialVideoModelClient modelClient;
    private CreditService creditService;
    private StorageQuotaService storage;
    private MaterialVideoJob job;

    private static final String VARIANT_CONFIG = """
            {"endpoint_id":"ep-h3","generation_mode":"universal_reference_video","resolution_tier":"768p","seed":42,
             "reference_inputs":[{"media_type":"image","key":"video-studio-image/u1/a.png"},
                                 {"media_type":"audio","key":"video-studio-audio/u1/b.mp3"}]}""";

    @BeforeEach
    void setUp() {
        job = MaterialVideoJob.builder()
                .id("mvj_studio")
                .ownerUserId("u1")
                .app(MaterialVideoJobService.APP_VIDEO_STUDIO)
                .name("全能参考 · 768p · 9:16 · 5 秒")
                .kind("studio-ref")
                .prompt("图1在跳舞")
                .durationSec(5)
                .aspectRatio("9:16")
                .variantConfigJson(VARIANT_CONFIG)
                .payloadJson("{\"id\":\"mvj_studio\",\"credit_label\":\"视频生成\"}")
                .status("queued")
                .progress(0)
                .creditsHeld(200L)
                .createdAt(OffsetDateTime.now())
                .build();

        jobRepo = mock(MaterialVideoJobRepository.class);
        when(jobRepo.findById("mvj_studio")).thenReturn(Optional.of(job));
        when(jobRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // v0.198 条件认领（同 MaterialVideoWorkerTest）：只有 queued 才认领得到；不打这个桩 Mockito 回 0，worker 直接不提交
        when(jobRepo.claimQueued(eq("mvj_studio"), any())).thenAnswer(inv -> {
            if (!"queued".equals(job.getStatus())) return 0;
            job.setStatus("submitting");
            job.setProgress(5);
            return 1;
        });
        modelClient = mock(MaterialVideoModelClient.class);
        creditService = mock(CreditService.class);
        storage = mock(StorageQuotaService.class);
    }

    private MaterialVideoWorker worker() {
        MaterialVideoProperties props = new MaterialVideoProperties();
        props.setUploadToCdn(true);
        props.setPollIntervalSeconds(1); // worker 内部 Math.max(2,...) → 实际 2s，一次 poll 即成功
        CdnUploader uploader = new CdnUploader() {
            @Override public CdnUploadResult upload(Path localFile, String key, String contentType) {
                return new CdnUploadResult("https://cdn.test/" + key, key, 4L, Instant.now());
            }
            @Override public void delete(String key) { /* no-op */ }
            @Override public String publicUrlFor(String key) { return "https://cdn.test/" + key; }
            @Override public String driverName() { return "fake"; }
        };
        @SuppressWarnings("unchecked")
        ObjectProvider<CdnUploader> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(uploader);
        return new MaterialVideoWorker(jobRepo, modelClient, props, creditService, storage, provider,
                mock(MaterialVideoCover.class));
    }

    @Test
    @DisplayName("成功：解析出的规格原样交给 submit；扣费文案用 credit_label；存储用量记「视频生成」")
    void successPassesSpecAndUsesCreditLabel() throws Exception {
        var submit = new MaterialVideoModelClient.SubmitResult("job_h3", null, "MiniMax H3", "minimax-h3",
                "jusuan-media", "ep-h3");
        when(modelClient.submit(any(), anyInt(), any(), any(), any(), any(), any(), any())).thenReturn(submit);
        when(modelClient.poll(any(MaterialVideoModelClient.SubmitResult.class))).thenReturn(
                new MaterialVideoModelClient.PollResult("succeeded", null, null, "succeeded", 100, null, null, "asset_out"));
        @SuppressWarnings("unchecked")
        HttpResponse<Path> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of("content-type", List.of("video/mp4")), (a, b) -> true));
        when(modelClient.downloadOutputAsset(eq(submit), eq("asset_out"), any(Path.class))).thenAnswer(inv -> {
            Files.write(inv.getArgument(2), new byte[]{1, 2, 3, 4});
            return response;
        });

        worker().generateAsync("mvj_studio");

        assertEquals("succeeded", job.getStatus());
        ArgumentCaptor<VideoGenSpec> spec = ArgumentCaptor.forClass(VideoGenSpec.class);
        verify(modelClient).submit(eq("图1在跳舞"), eq(5), eq("9:16"), eq("u1"), eq("celebrity"), eq("ep-h3"), spec.capture(), any());
        assertEquals(VideoGenSpec.fromVariantConfigJson(VARIANT_CONFIG), spec.getValue());
        assertEquals("universal_reference_video", spec.getValue().generationMode());
        assertEquals(2, spec.getValue().references().size());

        verify(creditService).commitHold(MaterialVideoJobService.CREDIT_REF_TYPE, "mvj_studio", 200L,
                "视频生成 · 全能参考 · 768p · 9:16 · 5 秒", null);
        verify(storage).record(eq("celebrity"), eq("u1"), eq("视频生成"), isNull(),
                eq("material-videos/mvj_studio/video.mp4"), anyLong());
    }

    @Test
    @DisplayName("厂商改写过提示词：实际用的描述只经 payload 单列更新写入（原有键不丢），出片与结算照旧")
    void vendorRewriteIsKeptBesideThePayload() throws Exception {
        var submit = new MaterialVideoModelClient.SubmitResult("job_h3", null, "MiniMax H3", "minimax-h3",
                "jusuan-media", "ep-h3");
        when(modelClient.submit(any(), anyInt(), any(), any(), any(), any(), any(), any())).thenReturn(submit);
        var rewrite = new VideoPromptRewrite("succeeded", "optimized", "She dances (S1) <d>[Chinese]走吧</d>", "popt_9", "v8");
        when(modelClient.poll(any(MaterialVideoModelClient.SubmitResult.class))).thenReturn(
                new MaterialVideoModelClient.PollResult("succeeded", null, null, "succeeded", 100, null, null, "asset_out", rewrite));
        // 模拟数据库那一列：只有 updatePayloadJson 能改 payload（整行 save 不负责这份记录）
        when(jobRepo.updatePayloadJson(eq("mvj_studio"), anyString())).thenAnswer(inv -> {
            job.setPayloadJson(inv.getArgument(1));
            return 1;
        });
        @SuppressWarnings("unchecked")
        HttpResponse<Path> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of("content-type", List.of("video/mp4")), (a, b) -> true));
        when(modelClient.downloadOutputAsset(eq(submit), eq("asset_out"), any(Path.class))).thenAnswer(inv -> {
            Files.write(inv.getArgument(2), new byte[]{1, 2, 3, 4});
            return response;
        });

        worker().generateAsync("mvj_studio");

        assertEquals("succeeded", job.getStatus());
        var payload = new com.fasterxml.jackson.databind.ObjectMapper().readTree(job.getPayloadJson());
        assertEquals("视频生成", payload.path("credit_label").asText());
        assertEquals("She dances (S1) <d>[Chinese]走吧</d>", payload.path(VideoPromptRewrite.PAYLOAD_KEY).path("prompt").asText());
        assertEquals("popt_9", payload.path(VideoPromptRewrite.PAYLOAD_KEY).path("optimizationId").asText());
        verify(creditService).commitHold(MaterialVideoJobService.CREDIT_REF_TYPE, "mvj_studio", 200L,
                "视频生成 · 全能参考 · 768p · 9:16 · 5 秒", null);
    }

    @Test
    @DisplayName("记录改写结果写不进去（存储异常）：只丢这份说明，不抛、不整行保存任务")
    void rewriteRecordFailureIsSwallowed() {
        when(jobRepo.updatePayloadJson(any(), any())).thenThrow(new IllegalStateException("db down"));
        worker().recordPromptRewrite("mvj_studio", new VideoPromptRewrite("processing", null, null, null, null));
        assertEquals("queued", job.getStatus());
        verify(jobRepo, never()).save(any());
    }

    @Test
    @DisplayName("payload 合并：换上新的改写记录，其余键原样；记录没变或原 payload 读不出 → 不写")
    void payloadMergeKeepsOtherKeys() throws Exception {
        var rewrite = new VideoPromptRewrite("processing", null, null, null, null);
        String merged = MaterialVideoWorker.withPromptRewrite("{\"credit_label\":\"视频生成\",\"caller_priced\":true}", rewrite);
        var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(merged);
        assertEquals("视频生成", node.path("credit_label").asText());
        assertEquals(true, node.path("caller_priced").asBoolean());
        assertEquals("processing", node.path(VideoPromptRewrite.PAYLOAD_KEY).path("status").asText());
        assertEquals(null, MaterialVideoWorker.withPromptRewrite(merged, rewrite));
        assertEquals(null, MaterialVideoWorker.withPromptRewrite("not json", rewrite));
        assertEquals(null, MaterialVideoWorker.withPromptRewrite("[1]", rewrite));
    }

    @Test
    @DisplayName("提交被厂商拒（4xx）：任务失败原因是给用户看的那句，退款文案用 credit_label")
    void submitRejectionReleasesWithCreditLabel() {
        when(modelClient.submit(any(), anyInt(), any(), any(), any(), any(), any(), any())).thenThrow(
                BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                        "视频模型拒绝了这次请求：orientation square is not supported", "status=400"));

        worker().generateAsync("mvj_studio");

        assertEquals("failed", job.getStatus());
        assertEquals("视频模型拒绝了这次请求：orientation square is not supported", job.getErrorMessage());
        verify(creditService).releaseHold(eq(MaterialVideoJobService.CREDIT_REF_TYPE), eq("mvj_studio"),
                startsWith("视频生成失败 · 退回积分 · 视频模型拒绝了这次请求"));
        verify(creditService, never()).commitHold(anyString(), anyString(), anyLong(), anyString(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("没传 credit_label 的老任务：账本文案保持「带货视频生成」")
    void missingCreditLabelFallsBackToLegacyText() {
        job.setPayloadJson("{\"id\":\"mvj_studio\"}");
        job.setKind("baseline");
        when(modelClient.submit(any(), anyInt(), any(), any(), any(), any(), any(), any())).thenThrow(
                new BusinessException(HttpStatus.BAD_REQUEST, "VIDEO_MODE_UNSUPPORTED", "所选视频模型不支持"));

        worker().generateAsync("mvj_studio");

        verify(creditService).releaseHold(eq(MaterialVideoJobService.CREDIT_REF_TYPE), eq("mvj_studio"),
                startsWith("带货视频生成失败 · 退回积分 · "));
    }

    @Test
    @DisplayName("账本文案 / 用量归属 / 存储分类的判定")
    void labelAppAndCategoryHelpers() {
        assertEquals("短剧分镜视频", MaterialVideoWorker.creditLabelOf(
                MaterialVideoJob.builder().payloadJson("{\"credit_label\":\"短剧分镜视频\"}").build()));
        assertEquals("带货视频生成", MaterialVideoWorker.creditLabelOf(MaterialVideoJob.builder().build()));
        assertEquals("带货视频生成", MaterialVideoWorker.creditLabelOf(
                MaterialVideoJob.builder().payloadJson("{broken").build()));

        assertEquals("drama", MaterialVideoWorker.appCodeOf(MaterialVideoJob.builder().app(MaterialVideoJobService.APP_DRAMA).kind("drama-shot").build()));
        assertEquals("studio", MaterialVideoWorker.appCodeOf(MaterialVideoJob.builder().app(MaterialVideoJobService.APP_IPSTUDIO).kind("studio-t2v").build()));
        assertEquals("celebrity", MaterialVideoWorker.appCodeOf(MaterialVideoJob.builder().app(MaterialVideoJobService.APP_VIDEO_STUDIO).kind("studio-t2v").build()));
        assertEquals("分镜视频", MaterialVideoWorker.storageCategoryOf(MaterialVideoJob.builder().kind("drama-episode").build()));
        assertEquals("视频生成", MaterialVideoWorker.storageCategoryOf(MaterialVideoJob.builder().kind("studio-flf").build()));
        assertEquals("素材视频", MaterialVideoWorker.storageCategoryOf(MaterialVideoJob.builder().kind("variant").build()));
        assertEquals("素材视频", MaterialVideoWorker.storageCategoryOf(MaterialVideoJob.builder().build()));
    }
}
