package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
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
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * v0.198 两处改动的回归：
 * <ul>
 *   <li>{@code variant_config.require_mirror=true}（画布视频）时成片镜像失败 → 任务失败、退回冻结、不结算；
 *       不带标记的老任务镜像失败 → 旧行为（保留厂商地址、照常结算）；</li>
 *   <li>条件认领：任务在认领前已被取消（不再是 queued）→ 不提交给厂商、不动积分。</li>
 * </ul>
 * 纯 Mockito；仓库按「只有 queued 才认领得到」回答（真 JPQL 的互斥见 {@link MaterialVideoJobClaimTest}）。
 */
class MaterialVideoWorkerMirrorClaimTest {

    private HttpServer http;
    private String base;
    private MaterialVideoJobRepository jobRepo;
    private MaterialVideoModelClient modelClient;
    private CreditService creditService;
    private MaterialVideoJob job;

    @BeforeEach
    void setUp() throws IOException {
        http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        http.createContext("/", ex -> {
            byte[] body = {1, 2, 3, 4};
            ex.getResponseHeaders().set("Content-Type", "video/mp4");
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        http.start();
        base = "http://127.0.0.1:" + http.getAddress().getPort();

        job = MaterialVideoJob.builder().id("mvj_m").ownerUserId("u1").scriptId("dcv_1").name("片段")
                .kind("drama-canvas").prompt("p").status("queued").progress(0).creditsHeld(40L)
                .durationSec(5).createdAt(OffsetDateTime.now()).build();
        jobRepo = mock(MaterialVideoJobRepository.class);
        when(jobRepo.findById("mvj_m")).thenAnswer(inv -> Optional.of(job));
        when(jobRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(jobRepo.claimQueued(eq("mvj_m"), any())).thenAnswer(inv -> {
            if (!"queued".equals(job.getStatus())) return 0;
            job.setStatus("submitting");
            return 1;
        });

        modelClient = mock(MaterialVideoModelClient.class);
        var submit = new MaterialVideoModelClient.SubmitResult("task_m", null, "vendor", "model-x", "generic", null);
        when(modelClient.submit(any(), anyInt(), any(), any(), any(), any(), any())).thenReturn(submit);
        when(modelClient.poll(any(MaterialVideoModelClient.SubmitResult.class))).thenReturn(
                new MaterialVideoModelClient.PollResult("succeeded", base + "/video.mp4", null, "SUCCESS", 100, null, null));
        creditService = mock(CreditService.class);
    }

    @AfterEach
    void tearDown() {
        http.stop(0);
    }

    private MaterialVideoWorker worker(CdnUploader uploader) {
        MaterialVideoProperties props = new MaterialVideoProperties();
        props.setUploadToCdn(true);
        props.setPollIntervalSeconds(1);
        @SuppressWarnings("unchecked")
        ObjectProvider<CdnUploader> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(uploader);
        return new MaterialVideoWorker(jobRepo, modelClient, props, creditService, mock(StorageQuotaService.class), provider);
    }

    /** 成片上传一律失败的假 CDN。 */
    private static final class FailingUploader implements CdnUploader {
        @Override
        public CdnUploadResult upload(Path localFile, String key, String contentType) throws IOException {
            throw new IOException("oss unavailable");
        }

        @Override
        public void delete(String key) { }

        @Override
        public String publicUrlFor(String key) { return "https://cdn.test/" + key; }

        @Override
        public String driverName() { return "failing"; }
    }

    @Test
    void requireMirror_mirrorFails_jobFailsAndHoldIsReleasedNotCommitted() {
        job.setVariantConfigJson("{\"require_mirror\":true}");
        worker(new FailingUploader()).generateAsync("mvj_m");

        assertEquals("failed", job.getStatus());
        assertTrue(job.getErrorMessage().startsWith(MaterialVideoWorker.MIRROR_FAILED_CODE), job.getErrorMessage());
        verify(creditService).releaseHold(eq("material_video_job"), eq("mvj_m"), anyString());
        verify(creditService, never()).commitHold(any(), any(), anyLong(), any());
    }

    @Test
    void withoutFlag_mirrorFails_oldBehaviour_keepsProviderUrlAndCharges() {
        worker(new FailingUploader()).generateAsync("mvj_m");

        assertEquals("succeeded", job.getStatus());
        assertEquals(base + "/video.mp4", job.getVideoUrl());
        verify(creditService).commitHold(eq("material_video_job"), eq("mvj_m"), eq(40L), anyString());
        verify(creditService, never()).releaseHold(any(), any(), any());
    }

    @Test
    void canceledBeforeClaim_isNeverSubmitted() {
        // 取消先赢：cancelQueued 的条件更新已经把它置 failed → worker 接手时直接跳过
        job.setStatus("failed");
        job.setErrorMessage(MaterialVideoJobService.CANCELED_MESSAGE);
        worker(new FailingUploader()).generateAsync("mvj_m");

        verify(modelClient, never()).submit(any(), anyInt(), any(), any(), any(), any(), any());
        verifyNoInteractions(creditService);
    }

    @Test
    void claimLostAfterLoad_raceWithCancel_isNeverSubmitted() {
        // worker 读到的还是 queued，但在它认领之前取消已经提交（数据库里已不是 queued）→ 认领影响 0 行
        when(jobRepo.claimQueued(eq("mvj_m"), any())).thenReturn(0);
        worker(new FailingUploader()).generateAsync("mvj_m");
        verify(modelClient, never()).submit(any(), anyInt(), any(), any(), any(), any(), any());
        verifyNoInteractions(creditService);
    }

    @Test
    void requireMirrorFlagParsing() {
        assertTrue(MaterialVideoWorker.extractRequireMirror("{\"require_mirror\":true,\"endpoint_id\":\"e\"}"));
        assertFalse(MaterialVideoWorker.extractRequireMirror("{\"endpoint_id\":\"e\"}"));
        assertFalse(MaterialVideoWorker.extractRequireMirror(null));
        assertFalse(MaterialVideoWorker.extractRequireMirror("not json"));
    }
}
