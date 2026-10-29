package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.repository.IpSavedAssetRepository;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.ipstudio.service.StudioMediaImportService;
import com.aistareco.aep.service.materialvideo.*;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Also run with DIRECTOR_VOICE_TEST_DB_URL against MySQL: H2 does not enforce read-only transactions. */
@SpringBootTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=${DIRECTOR_VOICE_TEST_DB_URL:jdbc:h2:mem:director-voice;MODE=MySQL;DB_CLOSE_DELAY=-1}",
        "spring.datasource.username=${DIRECTOR_VOICE_TEST_DB_USER:sa}", "spring.datasource.password=",
        "spring.datasource.driver-class-name=${DIRECTOR_VOICE_TEST_DB_DRIVER:org.h2.Driver}",
        "aep.seed.dev-data.enabled=false", "aep.cdn.driver=local", "aep.dev-auth.enabled=false",
        "aep.director.initial-delay-ms=3600000"})
@ActiveProfiles("test")
class DirectorVoiceUploadTest {
    @Autowired DirectorService director;
    @Autowired DirectorWorkRepository works;
    @Autowired AepUserRepository users;
    @Autowired IpSavedAssetRepository saved;
    @Autowired StudioMediaImportService imports;
    @Autowired ObjectMapper om;
    @Autowired PlatformTransactionManager tx;
    @Autowired MaterialVideoInputAssets receipts;
    @Autowired MaterialVideoInputAssetRepository receiptRows;
    @MockBean com.aistareco.aep.ipstudio.service.StudioVideoService models;
    @MockBean MaterialVideoModelClient client;

    private String owner() {
        String u = "voice-" + UUID.randomUUID().toString().substring(0, 8);
        users.save(AepUser.builder().id(u).username(u).createdAt(Instant.now()).build());
        return u;
    }
    private String work(String u) throws Exception {
        var c = om.readTree("{\"settings\":{},\"assets\":[{\"id\":\"a1\",\"kind\":\"character\",\"name\":\"本人\",\"rev\":0,\"image\":{\"candidates\":[]},\"refImage\":{}}],\"episodes\":[],\"clips\":[],\"taskMeta\":{}}");
        ((com.fasterxml.jackson.databind.node.ObjectNode)c.path("assets").get(0).path("refImage")).put("key", photo(u));
        DirectorWork w = new DirectorWork(); w.setId("DW-" + UUID.randomUUID().toString().substring(0, 20));
        w.setOwnerUserId(u); w.setTitle("声音绑定验收"); w.setRevision(1); w.setContentJson(c.toString());
        w.setCreatedAt(Instant.now()); w.setUpdatedAt(Instant.now());
        return works.save(w).getId();
    }
    private MockMultipartFile audio(int seconds) {
        int length = 16000 * seconds * 2;
        var b = ByteBuffer.allocate(44 + length).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes()).putInt(36 + length).put("WAVEfmt ".getBytes()).putInt(16)
                .putShort((short)1).putShort((short)1).putInt(16000).putInt(32000).putShort((short)2)
                .putShort((short)16).put("data".getBytes()).putInt(length);
        return new MockMultipartFile("file", "本人声音.wav", "audio/wav", b.array());
    }
    private String photo(String u) { return "ipstudio_source/" + u + "/photo.png"; }
    @Test void uploadWritesLibraryThenBindsOwnedSampleAndKeepsPhoto() throws Exception {
        String u = owner(), id = work(u);
        var result = director.uploadAudio(u, id, audio(5));
        assertEquals(5, result.durationSec(), .01);
        assertTrue(saved.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(u).stream()
                .anyMatch(a -> a.getPayloadJson().contains(result.key())));
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("universal_reference_video", false, false, null, null)), List.of(), 5, 15, 7000, 100);
        when(models.models()).thenReturn(List.of(new VideoStudioModel("h3", "H3", true, true, false, contract, null)));
        var bound = director.edit(u, id, new DirectorService.EditRequest("asset.setVoice", "a1", null,
                om.createObjectNode().put("key", result.key()).put("name", "我的声音").put("durationSec", 999)));
        var character = bound.path("assets").get(0);
        assertEquals(result.key(), character.path("voice").path("key").asText());
        assertEquals(5, character.path("voice").path("durationSec").asDouble(), .01);
        assertEquals(photo(u), character.path("refImage").path("key").asText());
        verify(client).prepareAudioReference("h3", result.key(), "studio");
        assertEquals(result.key(), director.get(u, id).path("assets").get(0).path("voice").path("key").asText());
    }
    @Test void readOnlyReproducesProductionFailureAndNormalUploadSucceeds() throws Exception {
        String u = owner(), id = work(u);
        var readonly = new TransactionTemplate(tx); readonly.setReadOnly(true);
        // MySQL rejects the user row lock in saveAutomatic. H2 accepts it, so only assert the failure on MySQL.
        if (System.getenv("DIRECTOR_VOICE_TEST_DB_URL") != null)
            assertThrows(RuntimeException.class, () -> readonly.execute(s -> imports.uploadReferenceAudio(u, audio(5))));
        assertNotNull(director.uploadAudio(u, id, audio(5)).key());
    }
    @Test void rejectsForeignWorkAndInvalidDurationBeforePersisting() throws Exception {
        String u = owner(), id = work(u);
        assertEquals("DIRECTOR_WORK_NOT_FOUND", assertThrows(BusinessException.class,
                () -> director.uploadAudio("someone-else", id, audio(5))).getCode());
        for (int seconds : List.of(1, 16)) assertEquals("STUDIO_MEDIA_INVALID", assertThrows(BusinessException.class,
                () -> director.uploadAudio(u, id, audio(seconds))).getCode());
        assertTrue(saved.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(u).isEmpty());
        verifyNoInteractions(client);
    }
    @Test void supplierFailureLeavesPriorCharacterVoiceAndPhotoUntouched() throws Exception {
        String u = owner(), id = work(u);
        var sample = director.uploadAudio(u, id, audio(5));
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("universal_reference_video", false, false, null, null)), List.of(), 5, 15, 7000, 100);
        when(models.models()).thenReturn(List.of(new VideoStudioModel("h3", "H3", true, true, false, contract, null)));
        doThrow(BusinessException.badRequest("VIDEO_REF_UPLOAD_FAILED", "样本被拒绝"))
                .when(client).prepareAudioReference(anyString(), anyString(), anyString());
        assertThrows(BusinessException.class, () -> director.edit(u, id, new DirectorService.EditRequest("asset.setVoice", "a1", null,
                om.createObjectNode().put("key", sample.key()))));
        var persisted = om.readTree(works.findById(id).orElseThrow().getContentJson()).path("assets").get(0);
        assertFalse(persisted.hasNonNull("voice"));
        assertEquals(photo(u), persisted.path("refImage").path("key").asText());
    }
    @Test void concurrentFirstUseOfOneVoiceDoesNotFailWithDuplicateKey() throws Exception {
        String source = "concurrent/" + UUID.randomUUID();
        var ready = new java.util.concurrent.CountDownLatch(2);
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            java.util.concurrent.Callable<MaterialVideoInputAssets.Receipt> task = () -> receipts.resolve("h3", "base", "h3", "test-key", source, () -> {
                ready.countDown();
                try { assertTrue(ready.await(5, java.util.concurrent.TimeUnit.SECONDS)); }
                catch (InterruptedException e) { throw new RuntimeException(e); }
                return new MaterialVideoInputAssets.Receipt("shared-asset", Instant.now().plusSeconds(3600));
            });
            var first = pool.submit(task); var second = pool.submit(task);
            assertEquals("shared-asset", first.get(10, java.util.concurrent.TimeUnit.SECONDS).assetId());
            assertEquals("shared-asset", second.get(10, java.util.concurrent.TimeUnit.SECONDS).assetId());
            assertEquals(1, receiptRows.findAll().stream().filter(r -> source.equals(r.getSourceKey())).count());
        } finally { pool.shutdownNow(); }
    }
}
