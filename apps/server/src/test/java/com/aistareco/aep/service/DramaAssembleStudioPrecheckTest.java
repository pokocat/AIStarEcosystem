package com.aistareco.aep.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Caption;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Packaging;
import com.aistareco.aep.ipstudio.service.StudioPackagingService;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.picgen.FontRegistry;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Studio 成片的配音 / 字幕在拼接之前先按各段时长之和判一次（2026-10-19）：注定超长的直接拒绝，不再先下载、拼接、
 * 重编码一整遍再失败。只拒绝「拼完也一定会被拒」的 —— 成片在质量门内最多比各段之和长 {@code durationTolerance}，
 * 处在这段余量里的仍交给拼完后的最终判定。两段各 5 秒：计划 10 秒，余量 1.5 秒。ffmpeg 是 mock，下载走本机内嵌 HttpServer。
 */
class DramaAssembleStudioPrecheckTest {

    private static final List<String> CLIPS = List.of("ipstudio_gen/u1/a.mp4", "ipstudio_gen/u1/b.mp4");
    private static final String VOICE = "ipstudio_gen/u1/voice.wav";

    private HttpServer http;
    private final List<String> downloaded = new ArrayList<>();
    private final FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
    private final CdnUploader uploader = mock(CdnUploader.class);
    private final CdnUrlSigner signer = mock(CdnUrlSigner.class);
    private DramaAssembleService svc;
    private double voiceSeconds;

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
        svc = new DramaAssembleService(mock(DramaProjectRepository.class), ffmpeg, uploader, signer, mock(StorageQuotaService.class),
                new ObjectMapper(), http.getAddress().getPort(), "/cdn", "");
        ReflectionTestUtils.setField(svc, "studioPackaging", new StudioPackagingService(ffmpeg, mock(FontRegistry.class)));
        when(signer.signKey(anyString())).thenAnswer(inv -> "/cdn/" + inv.getArgument(0));
        when(uploader.upload(any(Path.class), anyString(), anyString()))
                .thenAnswer(inv -> new CdnUploader.CdnUploadResult("/cdn/x", inv.getArgument(1), 3, Instant.now()));
        when(ffmpeg.runFfmpeg(anyList())).thenAnswer(inv -> {
            List<String> args = inv.getArgument(0);
            Files.write(Path.of(args.get(args.size() - 1)), new byte[]{9, 9, 9});
            return "";
        });
        when(ffmpeg.probeMedia(any(File.class))).thenAnswer(inv -> {
            String name = ((File) inv.getArgument(0)).getName();
            if (name.startsWith("clip_")) return new FfmpegRunner.MediaProbe(5.0, "mp4", "h264", "aac", 720, 1280, 44100, 2, true);
            if (name.equals("speech.media")) return new FfmpegRunner.MediaProbe(voiceSeconds, "wav", null, "pcm_s16le", 0, 0, 24000, 1, true);
            return new FfmpegRunner.MediaProbe(10.0, "mp4", "h264", "aac", 720, 1280, 44100, 2, true);
        });
    }

    @AfterEach
    void tearDown() {
        http.stop(0);
    }

    private DramaAssembleService.AssembledVideo assemble(Packaging packaging) {
        return svc.assembleStudioKeys("u1", "IPP-1", CLIPS, "9:16", packaging);
    }

    @Test
    void voiceoverCertainToBeTooLongIsRejectedBeforeSplicing() throws Exception {
        voiceSeconds = 12.0;
        BusinessException e = assertThrows(BusinessException.class, () -> assemble(new Packaging(null, null, null, null, VOICE)));
        assertEquals("STUDIO_SPEECH_TOO_LONG", e.getCode());
        verify(ffmpeg, never()).runFfmpeg(anyList());
        verify(uploader, never()).upload(any(Path.class), anyString(), anyString());
    }

    @Test
    void captionCertainToRunPastTheEndIsRejectedBeforeSplicing() throws Exception {
        BusinessException e = assertThrows(BusinessException.class,
                () -> assemble(new Packaging(null, null, null, List.of(new Caption(0.0, 12.0, "太晚了")))));
        assertEquals("STUDIO_PACKAGING_INVALID", e.getCode());
        verify(ffmpeg, never()).runFfmpeg(anyList());
        verify(uploader, never()).upload(any(Path.class), anyString(), anyString());
    }

    @Test
    void unusableVoiceoverIsRejectedBeforeSplicing() throws Exception {
        voiceSeconds = 0;
        BusinessException e = assertThrows(BusinessException.class, () -> assemble(new Packaging(null, null, null, null, VOICE)));
        assertEquals("STUDIO_PACKAGING_INVALID", e.getCode());
        verify(ffmpeg, never()).runFfmpeg(anyList());
    }

    @Test
    void voiceoverWithinTheQualityGateSlackIsStillJudgedAfterSplicing() throws Exception {
        voiceSeconds = 11.0; // 长于计划的 10 秒，但成片在质量门内可以到 11.5 秒 —— 预检不能替最终判定做决定
        BusinessException e = assertThrows(BusinessException.class, () -> assemble(new Packaging(null, null, null, null, VOICE)));
        assertEquals("STUDIO_SPEECH_TOO_LONG", e.getCode());
        verify(ffmpeg, atLeastOnce()).runFfmpeg(anyList());
        verify(uploader, never()).upload(any(Path.class), anyString(), anyString());
    }

    @Test
    void fittingVoiceoverAssemblesAndIsDownloadedOnce() throws Exception {
        voiceSeconds = 9.0;
        DramaAssembleService.AssembledVideo a = assemble(new Packaging(null, null, null, null, VOICE));
        assertTrue(a.key().startsWith("ipstudio_gen/"), a.key());
        assertEquals(1, downloaded.stream().filter(p -> p.endsWith("/" + VOICE)).count());
        verify(uploader).upload(any(Path.class), eq(a.key()), eq("video/mp4"));
    }
}
