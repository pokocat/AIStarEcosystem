package com.aistareco.aep.service;

import com.aistareco.aep.clip.service.ClipAvatarService;
import com.aistareco.aep.clip.service.ClipOutputStorage;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.model.DramaShort;
import com.aistareco.aep.repository.DramaShortRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.function.BiConsumer;

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
        // checkpoint 现在走锁定 merge：模拟其读当前 payload、应用 mutator、写回。
        DramaShortService shorts = mock(DramaShortService.class);
        when(shorts.applyServerUpdate(eq("dvs_1"), eq("u1"), any())).thenAnswer(inv -> {
            @SuppressWarnings("unchecked")
            BiConsumer<DramaShort, ObjectNode> mutator = inv.getArgument(2);
            ObjectNode data = (ObjectNode) OM.readTree(row.getPayloadJson());
            mutator.accept(row, data);
            row.setPayloadJson(OM.writeValueAsString(data));
            return true;
        });
        var service = new DramaShortAudioService(repo, shorts, avatars, shiliu, output, signer, OM);

        var first = service.prepare("dvs_1", "u1");
        var second = service.prepare("dvs_1", "u1");

        assertEquals(1, first.path("preparedCount").asInt());
        assertEquals(1, second.path("reusedCount").asInt());
        assertTrue(OM.readTree(row.getPayloadJson()).path("shots").path(0).path("audio").hasNonNull("cdnKey"));
        verify(gateway, times(1)).previewVoice(anyString(), anyString(), anyString());
        // 一镜有台词 → 一次 checkpoint merge；第二次调用命中指纹复用，不再 merge。
        verify(shorts, times(1)).applyServerUpdate(eq("dvs_1"), eq("u1"), any());
    }
}
