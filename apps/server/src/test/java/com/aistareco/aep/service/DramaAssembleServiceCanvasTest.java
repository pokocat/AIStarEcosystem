package com.aistareco.aep.service;

import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * v0.198 画布合成（{@link DramaAssembleService#assembleKeys}）：按给定 key 顺序下载拼接、质量门（坏段 / 时长不对）
 * 失败即抛不交付、产物记 storage_asset。ffmpeg 是 mock（按参数把输出文件写出来），下载走本机内嵌 HttpServer。
 */
class DramaAssembleServiceCanvasTest {

    private HttpServer http;
    private final List<String> downloaded = new ArrayList<>();
    private final FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
    private final CdnUploader uploader = mock(CdnUploader.class);
    private final CdnUrlSigner signer = mock(CdnUrlSigner.class);
    private final StorageQuotaService storage = mock(StorageQuotaService.class);
    private DramaAssembleService svc;
    /** 成片 ffprobe 读出来的时长（按调用次数依次返回）。 */
    private final List<Double> outDurations = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        http.createContext("/", ex -> {
            downloaded.add(ex.getRequestURI().getPath());
            byte[] body = {1, 2, 3, 4};
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        http.start();
        int port = http.getAddress().getPort();
        svc = new DramaAssembleService(mock(DramaProjectRepository.class), ffmpeg, uploader, signer, storage,
                new ObjectMapper(), port, "/cdn", "");
        // 本地假 CDN：key → 相对地址，下载时拼本机 origin
        when(signer.signKey(anyString())).thenAnswer(inv -> "/cdn/" + inv.getArgument(0));
        when(ffmpeg.runFfmpeg(anyList())).thenAnswer(inv -> {
            List<String> args = inv.getArgument(0);
            Files.write(Path.of(args.get(args.size() - 1)), new byte[]{9, 9, 9});
            return "";
        });
        when(ffmpeg.probeMedia(any(File.class))).thenAnswer(inv -> {
            File f = inv.getArgument(0);
            if (f.getName().startsWith("clip_")) {
                return new FfmpegRunner.MediaProbe(5.0, "mp4", "h264", "aac", 720, 1280, 44100, 2, true);
            }
            double d = outDurations.isEmpty() ? 10.0 : outDurations.remove(0);
            return new FfmpegRunner.MediaProbe(d, "mp4", "h264", "aac", 720, 1280, 44100, 2, true);
        });
    }

    @AfterEach
    void tearDown() {
        http.stop(0);
    }

    @Test
    void assemblesInGivenOrder_uploadsAndRecordsStorage() throws Exception {
        DramaAssembleService.AssembledVideo a = svc.assembleKeys("u1", "dcv_1", 2,
                List.of("material-videos/b/video.mp4", "material-videos/a/video.mp4"));
        assertEquals(List.of("/cdn/material-videos/b/video.mp4", "/cdn/material-videos/a/video.mp4"), downloaded);
        assertTrue(a.key().startsWith("drama/canvas/assemblies/dcv_1_ep2_"), a.key());
        assertEquals(10, a.durationSec());
        verify(uploader).upload(any(Path.class), eq(a.key()), eq("video/mp4"));
        verify(storage).record(eq("drama"), eq("u1"), eq("成片"), eq("dcv_1"), eq(a.key()), eq(3L));
        verify(ffmpeg, times(1)).runFfmpeg(anyList()); // 流复制一次就过了质量门
    }

    @Test
    void copyDurationDrift_reencodes_stillWrong_failsWithoutUpload() throws Exception {
        outDurations.add(3.0);  // 流复制后只有 3 秒（两段各 5 秒）
        outDurations.add(4.0);  // 重编码还是不对
        BusinessException e = assertThrows(BusinessException.class, () -> svc.assembleKeys("u1", "dcv_1", 1,
                List.of("k1.mp4", "k2.mp4")));
        assertEquals("DRAMA_ASSEMBLE_FAILED", e.getCode());
        verify(ffmpeg, times(2)).runFfmpeg(anyList());
        verify(uploader, never()).upload(any(), any(), any());
        verifyNoInteractions(storage);
    }

    @Test
    void unreadableClip_failsWithWhichSegment() throws Exception {
        when(ffmpeg.probeMedia(any(File.class))).thenReturn(
                new FfmpegRunner.MediaProbe(0, "", null, null, 0, 0, 0, 0, false));
        BusinessException e = assertThrows(BusinessException.class, () -> svc.assembleKeys("u1", "dcv_1", 1,
                List.of("k1.mp4")));
        assertEquals("DRAMA_ASSEMBLE_BAD_CLIP", e.getCode());
        assertTrue(e.getMessage().contains("第 1 个片段"));
        verify(uploader, never()).upload(any(), any(), any());
    }

    @Test
    void nothingToAssemble_400() {
        assertEquals("DRAMA_CANVAS_NOTHING_TO_ASSEMBLE",
                assertThrows(BusinessException.class, () -> svc.assembleKeys("u1", "dcv_1", 1, List.of())).getCode());
    }
}
