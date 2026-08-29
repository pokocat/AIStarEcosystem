package com.aistareco.aep.service;

import com.aistareco.aep.clip.service.ClipAvatarService;
import com.aistareco.aep.clip.service.ClipOutputStorage;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.model.DramaShort;
import com.aistareco.aep.repository.DramaShortRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DramaShortAudioServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();

    @Test
    void checkpointsAndReusesMatchingDialogueAudio() throws Exception {
        DramaShortRepository repo = mock(DramaShortRepository.class);
        ClipAvatarService avatars = mock(ClipAvatarService.class);
        ShiliuService shiliu = mock(ShiliuService.class);
        ShiliuGateway gateway = mock(ShiliuGateway.class);
        ClipOutputStorage output = mock(ClipOutputStorage.class);
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        DramaShort row = DramaShort.builder().id("dvs_1").ownerUserId("u1").payloadJson("""
                {"characterAvatar":{"id":"DH-1"},"shots":[
                  {"id":"s1","no":1,"voText":"本喵懒得理你"},
                  {"id":"s2","no":2,"voText":""}]}
                """).build();
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull("dvs_1", "u1")).thenReturn(Optional.of(row));
        when(avatars.requiredVoiceEngineRef("u1", "DH-1", null)).thenReturn("10086");
        when(shiliu.required()).thenReturn(gateway);
        when(gateway.previewVoice("u1", "10086", "本喵懒得理你"))
                .thenReturn(new ShiliuGateway.Task("tts:1", "succeeded", 3, "https://vendor.test/a.mp3", null));
        when(output.persistAudio("u1", "https://vendor.test/a.mp3")).thenReturn("clip/segment-audio/u1/a.mp3");
        when(signer.signKey("clip/segment-audio/u1/a.mp3")).thenReturn("https://cdn.test/a.mp3");
        var service = new DramaShortAudioService(repo, avatars, shiliu, output, signer, OM);

        var first = service.prepare("dvs_1", "u1");
        var second = service.prepare("dvs_1", "u1");

        assertEquals(1, first.path("preparedCount").asInt());
        assertEquals(1, second.path("reusedCount").asInt());
        assertTrue(OM.readTree(row.getPayloadJson()).path("shots").path(0).path("audio").hasNonNull("cdnKey"));
        verify(gateway, times(1)).previewVoice(anyString(), anyString(), anyString());
        verify(repo, times(1)).save(row);
    }
}
