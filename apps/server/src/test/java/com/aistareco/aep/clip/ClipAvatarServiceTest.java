package com.aistareco.aep.clip;

import com.aistareco.aep.clip.repository.ClipRenderJobRepository;
import com.aistareco.aep.clip.service.ClipAvatarService;
import com.aistareco.aep.clip.service.ClipCapturePolicy;
import com.aistareco.aep.clip.service.ClipVoiceSeedExtractor;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapVoice;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapConsentRepository;
import com.aistareco.aep.dap.repository.DapVoiceRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ClipAvatarServiceTest {
    private DapAvatarRepository avatars;
    private DapVoiceRepository voices;
    private DapConsentRepository consents;
    private FileStorageService storage;
    private ClipCapturePolicy policy;
    private ShiliuGateway gateway;
    private ClipAvatarService service;
    private ClipVoiceSeedExtractor voiceSeedExtractor;
    private MultipartFile file;

    @BeforeEach
    void setUp() {
        avatars = mock(DapAvatarRepository.class);
        voices = mock(DapVoiceRepository.class);
        consents = mock(DapConsentRepository.class);
        storage = mock(FileStorageService.class);
        policy = mock(ClipCapturePolicy.class);
        gateway = mock(ShiliuGateway.class);
        ShiliuService shiliu = mock(ShiliuService.class);
        when(shiliu.required()).thenReturn(gateway);
        voiceSeedExtractor = mock(ClipVoiceSeedExtractor.class);
        service = new ClipAvatarService(avatars, voices, consents, mock(ClipRenderJobRepository.class), storage, shiliu, policy, voiceSeedExtractor);
        file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(storage.store(eq(file), anyString(), eq("owner-1")))
                .thenReturn(new FileStorageService.StoredFile("clip/source", "u", "https://cdn.example/source", null, 1024, "video/mp4"));
        when(consents.findFirstByOwnerUserIdOrderByAcceptedAtDesc("owner-1")).thenReturn(Optional.empty());
    }

    @Test
    void voiceCloneDoesNotRequireAuthorizationVideo() {
        when(voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(Optional.empty());
        when(gateway.cloneVoice("owner-1", "clip/source"))
                .thenReturn(new ShiliuGateway.Task("speaker:12", "processing", null, "12", null));

        var result = service.clone("owner-1", "voice", file);

        assertEquals(true, result.get("ok"));
        verify(voices).save(any(DapVoice.class));
    }

    @Test
    void avatarTrainingStartsWithoutSeparateVoiceOrAuthorization() {
        when(avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc("owner-1", "shiliu"))
                .thenReturn(Optional.empty());
        when(voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(Optional.empty());
        when(gateway.cloneAvatar("owner-1", "clip/source", null, null))
                .thenReturn(new ShiliuGateway.Task("avatar:34", "processing", null, "34", null));
        var seed = new FileStorageService.StoredFile("clip/video-seed.m4a", "u", "https://cdn.example/seed.m4a", null, 512, "audio/mp4");
        when(voiceSeedExtractor.extract("owner-1", "clip/source")).thenReturn(Optional.of(seed));
        when(gateway.cloneVoice("owner-1", "clip/video-seed.m4a"))
                .thenReturn(new ShiliuGateway.Task("speaker:56", "processing", null, "56", null));

        service.clone("owner-1", "avatar", file);

        verify(gateway).cloneAvatar("owner-1", "clip/source", null, null);
        verify(gateway).cloneVoice("owner-1", "clip/video-seed.m4a");
        verify(avatars, atLeastOnce()).save(any(DapAvatar.class));
        verify(voices).save(argThat(v -> "seed".equals(v.getKind()) && "视频原声".equals(v.getName())));
    }
}
