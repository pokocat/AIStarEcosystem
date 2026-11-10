package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.KnownClip;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.KnownLine;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Packaging;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.DramaAssembleService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.picgen.FontRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 整条合成链接真语音识别（2026-11-07）：真 ffmpeg + 真 /audio/transcriptions 接口。平时不跑（要有识别服务和带人声的片段），
 * 设了 STUDIO_ASR_E2E_URL（如本机 whisper-server）和 STUDIO_ASR_E2E_DIR（放 clip1.mp4 / clip2.mp4 / music.m4a）才跑，成片留在那个目录里看。
 */
@EnabledIfEnvironmentVariable(named = "STUDIO_ASR_E2E_URL", matches = ".+")
class StudioCaptionSpeechE2ETest {
    private final Path dir = Path.of(String.valueOf(System.getenv("STUDIO_ASR_E2E_DIR")));

    private DramaAssembleService service(FfmpegRunner ffmpeg, HttpServer http, Path[] uploaded) throws Exception {
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.signKey(anyString())).thenAnswer(inv -> "/cdn/" + inv.getArgument(0));
        CdnUploader uploader = mock(CdnUploader.class);
        when(uploader.upload(any(Path.class), anyString(), anyString())).thenAnswer(inv -> {
            Files.copy((Path) inv.getArgument(0), uploaded[0], java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            return new CdnUploader.CdnUploadResult("/cdn/x", inv.getArgument(1), Files.size(uploaded[0]), Instant.now());
        });
        var fonts = new FontRegistry(); fonts.load();
        var models = mock(AiModelInvocationService.class);
        var endpoint = AiModelEndpoint.builder().id("local-whisper").name("本机 Whisper").model("whisper-small").baseUrl(System.getenv("STUDIO_ASR_E2E_URL")).build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_TRANSCRIBE)).thenReturn(Optional.of(endpoint));
        var transcriber = new StudioTranscriber(models, new UpstreamModelHttp(mock(com.aistareco.aep.service.AiModelUsageService.class)), new ObjectMapper());
        var svc = new DramaAssembleService(mock(DramaProjectRepository.class), ffmpeg, uploader, signer, mock(StorageQuotaService.class),
                new ObjectMapper(), http.getAddress().getPort(), "/cdn", "");
        ReflectionTestUtils.setField(svc, "studioPackaging", new StudioPackagingService(ffmpeg, fonts));
        ReflectionTestUtils.setField(svc, "studioCaptions", new StudioCaptionService(transcriber, ffmpeg));
        return svc;
    }

    @Test void theScriptIsTimedByWhatWasReallySaidAndBurnedIn() throws Exception {
        var ffmpeg = new FfmpegRunner(new MixcutProperties());
        HttpServer http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        http.createContext("/", ex -> {
            byte[] body = Files.readAllBytes(dir.resolve(ex.getRequestURI().getPath().replaceAll(".*/", "")));
            ex.sendResponseHeaders(200, body.length); ex.getResponseBody().write(body); ex.close();
        });
        http.start();
        try {
            Path[] uploaded = {dir.resolve("known-out.mp4")};
            var svc = service(ffmpeg, http, uploaded);
            // 计划里台词从 0 秒开始，片段里实际晚了 1.5 秒，时间要跟着真实声音走；片段实际长度也和计划不一样。
            var known = List.of(
                    new KnownClip(6.0, List.of(new KnownLine("今天天气真不错，我们一起出去走走吧。", 0.0, 3.0))),
                    new KnownClip(6.0, List.of(new KnownLine("好啊，我正想去公园看看花。", 0.0, 3.0))));
            var packaging = new Packaging(null, null, null, null, null, true, known, "music.m4a", "1080p");
            var result = svc.assembleStudioKeys("u1", "IPP-e2e", List.of("clip1.mp4", "clip2.mp4"), "9:16", packaging);
            System.out.println("[e2e] known status=" + result.captionStatus() + " cues=" + result.captions());
            assertEquals("recognized", result.captionStatus());
            assertTrue(result.captions().get(0).start() >= 0.8, "第一句按真实声音延后：" + result.captions().get(0));
            var probe = ffmpeg.probeMedia(uploaded[0].toFile());
            assertEquals(1080, probe.width()); assertEquals(1920, probe.height());
            assertTrue(probe.hasAudio());

            uploaded[0] = dir.resolve("heard-out.mp4");
            var heard = svc.assembleStudioKeys("u1", "IPP-e2e", List.of("clip1.mp4", "clip2.mp4"), "9:16", new Packaging(null, null, null, null, null, true, null, null, null));
            System.out.println("[e2e] heard status=" + heard.captionStatus() + " cues=" + heard.captions());
            assertEquals("recognized", heard.captionStatus());
            assertFalse(heard.captions().isEmpty());
        } finally {
            http.stop(0);
        }
    }
}
