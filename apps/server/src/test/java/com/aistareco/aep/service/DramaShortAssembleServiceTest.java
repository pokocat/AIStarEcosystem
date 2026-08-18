package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaShort;
import com.aistareco.aep.repository.DramaShortRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.clip.service.ClipOverlayRenderer;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DramaShortAssembleServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();

    @Test
    void buildPlanOrdersShotsAndFingerprintsAcceptedMedia() throws Exception {
        JsonNode data = OM.readTree("""
                {"shots":[
                  {"id":"s2","no":2,"dur":7,"flow":"done","videoUrl":"/cdn/v2.mp4"},
                  {"id":"s1","no":1,"dur":5,"flow":"done","videoUrl":"/cdn/v1.mp4"}
                ]}
                """);

        var plan = DramaShortAssembleService.buildPlan(data);

        assertEquals(List.of("/cdn/v1.mp4", "/cdn/v2.mp4"), plan.clipUrls());
        assertEquals(12, plan.expectedDurationSec());
        assertEquals(64, plan.fingerprint().length());
        assertEquals(plan.fingerprint(), DramaShortAssembleService.buildPlan(data).fingerprint());
    }

    @Test
    void buildPlanRejectsAnyUnacceptedOrMissingClip() throws Exception {
        JsonNode data = OM.readTree("""
                {"shots":[
                  {"id":"s1","no":1,"dur":5,"flow":"done","videoUrl":"/cdn/v1.mp4"},
                  {"id":"s2","no":2,"dur":5,"flow":"clip","videoUrl":"/cdn/v2.mp4"},
                  {"id":"s3","no":3,"dur":5,"flow":"done"}
                ]}
                """);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> DramaShortAssembleService.buildPlan(data));
        assertEquals("DRAMA_SHORT_ASSEMBLE_INCOMPLETE", ex.getCode());
        assertTrue(ex.getMessage().contains("2"));
        assertTrue(ex.getMessage().contains("3"));
    }

    @Test
    void buildPlanRejectsDialogueWithoutMatchingPreparedAudio() throws Exception {
        JsonNode data = OM.readTree("""
                {"shots":[{"id":"s1","no":1,"dur":5,"flow":"done","videoUrl":"/cdn/v1.mp4","voText":"退后"}]}
                """);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> DramaShortAssembleService.buildPlan(data));

        assertEquals("DRAMA_SHORT_ASSEMBLE_AUDIO_INCOMPLETE", ex.getCode());
        assertTrue(ex.getMessage().contains("1"));
    }

    @Test
    void assembleRejectsExternalClipBeforeFfmpegOrUpload() throws Exception {
        DramaShortRepository repo = mock(DramaShortRepository.class);
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        CdnUploader uploader = mock(CdnUploader.class);
        StorageQuotaService storage = mock(StorageQuotaService.class);
        DramaShort row = DramaShort.builder()
                .id("dvs_x")
                .ownerUserId("u1")
                .payloadJson("{\"shots\":[{\"id\":\"s1\",\"no\":1,\"dur\":5,\"flow\":\"done\",\"videoUrl\":\"http://169.254.169.254/latest/meta-data\"}]}")
                .build();
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull("dvs_x", "u1")).thenReturn(Optional.of(row));
        var service = service(repo, ffmpeg, uploader, storage);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.assemble("dvs_x", "u1"));

        assertEquals("VIDEO_URL_NOT_ALLOWED", ex.getCode());
        verifyNoInteractions(ffmpeg, uploader);
        verify(storage).checkQuota("drama", "u1", 0);
    }

    @Test
    void unchangedAssemblyIsIdempotentAndDoesNotDownloadAgain() throws Exception {
        DramaShortRepository repo = mock(DramaShortRepository.class);
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        CdnUploader uploader = mock(CdnUploader.class);
        StorageQuotaService storage = mock(StorageQuotaService.class);
        ObjectNode data = (ObjectNode) OM.readTree("""
                {"shots":[{"id":"s1","no":1,"dur":5,"flow":"done","videoUrl":"/cdn/v1.mp4"}]}
                """);
        var plan = DramaShortAssembleService.buildPlan(data);
        ObjectNode assembled = OM.createObjectNode();
        assembled.put("cdnKey", "drama/shorts/dvs_x/final-existing.mp4");
        assembled.put("durationSec", 5);
        assembled.put("shotCount", 1);
        assembled.put("sourceFingerprint", plan.fingerprint());
        assembled.put("at", "2026-08-18T10:00:00Z");
        data.set("assembled", assembled);
        DramaShort row = DramaShort.builder()
                .id("dvs_x").ownerUserId("u1").status("done").payloadJson(OM.writeValueAsString(data)).build();
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull("dvs_x", "u1")).thenReturn(Optional.of(row));
        var service = service(repo, ffmpeg, uploader, storage);

        JsonNode result = service.assemble("dvs_x", "u1");

        assertEquals("drama/shorts/dvs_x/final-existing.mp4", result.path("cdnKey").asText());
        assertEquals(5, result.path("durationSec").asLong());
        verifyNoInteractions(ffmpeg, storage);
        verify(uploader, never()).upload(any(), anyString(), anyString());
        verify(uploader, never()).delete(anyString());
        verify(repo, never()).save(any());
    }

    @Test
    void staleButUnchangedAssemblyIsReactivatedWithoutRerendering() throws Exception {
        DramaShortRepository repo = mock(DramaShortRepository.class);
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        CdnUploader uploader = mock(CdnUploader.class);
        StorageQuotaService storage = mock(StorageQuotaService.class);
        ObjectNode data = (ObjectNode) OM.readTree("""
                {"shots":[{"id":"s1","no":1,"dur":5,"flow":"done","videoUrl":"/cdn/v1.mp4"}]}
                """);
        var plan = DramaShortAssembleService.buildPlan(data);
        ObjectNode assembled = OM.createObjectNode();
        assembled.put("cdnKey", "drama/shorts/dvs_x/final-existing.mp4");
        assembled.put("durationSec", 5);
        assembled.put("shotCount", 1);
        assembled.put("sourceFingerprint", plan.fingerprint());
        assembled.put("stale", true);
        data.set("assembled", assembled);
        DramaShort row = DramaShort.builder()
                .id("dvs_x").ownerUserId("u1").status("draft").payloadJson(OM.writeValueAsString(data)).build();
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull("dvs_x", "u1")).thenReturn(Optional.of(row));
        var service = service(repo, ffmpeg, uploader, storage);

        service.assemble("dvs_x", "u1");

        assertEquals("done", row.getStatus());
        assertEquals(100, row.getProgress());
        assertFalse(OM.readTree(row.getPayloadJson()).path("assembled").has("stale"));
        verify(repo).save(row);
        verifyNoInteractions(ffmpeg, storage);
        verify(uploader, never()).upload(any(), anyString(), anyString());
        verify(uploader, never()).delete(anyString());
    }

    private static DramaShortAssembleService service(DramaShortRepository repo,
                                                      FfmpegRunner ffmpeg,
                                                      CdnUploader uploader,
                                                      StorageQuotaService storage) {
        return new DramaShortAssembleService(repo, ffmpeg, uploader, CdnUrlSigner.NOOP,
                storage, mock(FileStorageService.class), mock(ClipOverlayRenderer.class),
                OM, 8080, "/cdn", "https://oss.example.com/media");
    }
}
