package com.aistareco.aep.clip;

import com.aistareco.aep.clip.repository.ClipRenderJobRepository;
import com.aistareco.aep.clip.service.ClipAvatarService;
import com.aistareco.aep.clip.service.ClipCapturePolicy;
import com.aistareco.aep.clip.service.ClipVoiceSeedExtractor;
import com.aistareco.aep.clip.service.ClipAvatarPreviewExtractor;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
    private ClipAvatarPreviewExtractor previewExtractor;
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
        previewExtractor = mock(ClipAvatarPreviewExtractor.class);
        service = new ClipAvatarService(avatars, voices, consents, mock(ClipRenderJobRepository.class), storage, shiliu, policy, voiceSeedExtractor, previewExtractor);
        file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(storage.store(eq(file), anyString(), eq("owner-1")))
                .thenReturn(new FileStorageService.StoredFile("clip/source", "u", "https://cdn.example/source", null, 1024, "video/mp4"));
        when(consents.findFirstByOwnerUserIdOrderByAcceptedAtDesc("owner-1")).thenReturn(Optional.empty());
        when(previewExtractor.extract("owner-1", "clip/source"))
                .thenReturn(new FileStorageService.StoredFile("clip/avatar-preview.jpg", "u", "https://cdn.example/avatar-preview.jpg", null, 256, "image/jpeg"));
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
        verify(avatars, atLeastOnce()).save(argThat(a -> "clip/avatar-preview.jpg".equals(a.getImageKey())));
        verify(voices).save(argThat(v -> "seed".equals(v.getKind()) && "视频原声".equals(v.getName())));
    }

    @Test
    void deleteRemovesEveryActiveAvatarAndVoiceVersion() {
        DapAvatar newest = DapAvatar.builder().id("DH-new").ownerUserId("owner-1").engine("shiliu")
                .engineRef("avatar-new").engineSourceKey("clip/avatar-new.mp4").imageKey("clip/avatar-new.jpg").engineStatus("training").build();
        DapAvatar older = DapAvatar.builder().id("DH-old").ownerUserId("owner-1").engine("shiliu")
                .engineRef("avatar-old").engineSourceKey("clip/avatar-old.mp4").engineStatus("ready").build();
        DapVoice voice = DapVoice.builder().id("VC-old").ownerUserId("owner-1").name("视频原声").kind("seed")
                .engine("shiliu").engineRef("speaker-old").audioKey("clip/voice-old.m4a").engineStatus("ready").build();
        when(avatars.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc("owner-1", "shiliu"))
                .thenReturn(java.util.List.of(newest, older));
        when(voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(java.util.List.of(voice));

        service.delete("owner-1");

        verify(gateway).deleteAvatar("avatar-new");
        verify(gateway).deleteAvatar("avatar-old");
        verify(gateway).deleteVoice("speaker-old");
        verify(storage).delete("clip/avatar-new.jpg");
        verify(avatars, times(2)).save(argThat(a -> "deleted".equals(a.getEngineStatus()) && a.getDeletedAt() != null));
        verify(voices).save(argThat(v -> "deleted".equals(v.getEngineStatus()) && v.getDeletedAt() != null));
        assertNotNull(newest.getDeletedAt());
        assertNotNull(older.getDeletedAt());
    }

    @Test
    void avatarViewReturnsSignedPreviewFrame() {
        DapAvatar avatar = DapAvatar.builder().id("DH-ready").ownerUserId("owner-1").engine("shiliu")
                .imageKey("clip/avatar-preview.jpg").engineStatus("ready").engineTrainedAt(Instant.now()).build();
        when(avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc("owner-1", "shiliu"))
                .thenReturn(Optional.of(avatar));
        when(voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(Optional.empty());
        when(storage.signedUrl("clip/avatar-preview.jpg")).thenReturn("https://cdn.example/avatar-preview.jpg");

        var view = service.view("owner-1");

        assertEquals("https://cdn.example/avatar-preview.jpg", view.imagePreviewUrl());
        assertEquals("ready", view.imageStatus());
    }

    @Test
    void legacyAvatarViewBackfillsPreviewFromTrainingVideo() {
        DapAvatar avatar = DapAvatar.builder().id("DH-legacy").ownerUserId("owner-1").engine("shiliu")
                .engineSourceKey("clip/legacy-avatar.mp4").engineStatus("ready").engineTrainedAt(Instant.now()).build();
        when(avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc("owner-1", "shiliu"))
                .thenReturn(Optional.of(avatar));
        when(voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(Optional.empty());
        var preview = new FileStorageService.StoredFile("clip/legacy-preview.jpg", "u", "s", null, 128, "image/jpeg");
        when(previewExtractor.extract("owner-1", "clip/legacy-avatar.mp4")).thenReturn(preview);
        when(storage.signedUrl("clip/legacy-preview.jpg")).thenReturn("https://cdn.example/legacy-preview.jpg");

        var view = service.view("owner-1");

        assertEquals("https://cdn.example/legacy-preview.jpg", view.imagePreviewUrl());
        verify(avatars).save(argThat(a -> "clip/legacy-preview.jpg".equals(a.getImageKey()) && a.getImageBytes() == 128));
    }
}
