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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
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
        // 名字改为「视频提取 · M月D日」（原先两种来源各写死一个常量，同来源录两次会完全同名）。
        // 这里仍然钉住原意图：从视频提取的种子声音确实被创建，且能一眼看出来源。
        verify(voices).save(argThat(v -> "seed".equals(v.getKind()) && v.getName().startsWith("视频提取 · ")));
    }

    @Test
    @DisplayName("mock 时代的残留记录不得卡住删除：跳过上游、照常清本地")
    void mockLeftoversDoNotBlockDeletion() {
        // 实测事故：库里有一条 engineRef=mock-voice-xxx 的旧记录，网关删除前按数字校验 ref，
        // 于是批量删除撞到它就抛 CLIP_ENGINE_REF_INVALID 整个中止 —— 用户永远删不掉自己的分身。
        // mock ref 本来就没有对应的上游对象，跳过上游、只清本地才是正确语义。
        DapVoice mockVoice = DapVoice.builder().id("VC-mock").ownerUserId("owner-1").name("我的声音").kind("clone")
                .engine("shiliu").engineRef("mock-voice-0b135048").audioKey("clip/mock.m4a").engineStatus("ready").build();
        DapVoice realVoice = DapVoice.builder().id("VC-real").ownerUserId("owner-1").name("我的声音").kind("clone")
                .engine("shiliu").engineRef("1873405707094174").audioKey("clip/real.m4a").engineStatus("ready").build();
        when(avatars.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc("owner-1", "shiliu"))
                .thenReturn(java.util.List.of());
        when(voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(java.util.List.of(mockVoice, realVoice));

        service.delete("owner-1");

        verify(gateway, never()).deleteVoice("mock-voice-0b135048");
        verify(gateway).deleteVoice("1873405707094174");
        // 关键：两条都要落成已删除，不能因为第一条是 mock 就整批中止
        verify(voices, times(2)).save(argThat(v -> "deleted".equals(v.getEngineStatus()) && v.getDeletedAt() != null));
    }

    @Test
    void deleteRemovesEveryActiveAvatarAndVoiceVersion() {
        DapAvatar newest = DapAvatar.builder().id("DH-new").ownerUserId("owner-1").engine("shiliu")
                .engineRef("1873411191147139").engineSourceKey("clip/avatar-new.mp4").imageKey("clip/avatar-new.jpg").engineStatus("training").build();
        DapAvatar older = DapAvatar.builder().id("DH-old").ownerUserId("owner-1").engine("shiliu")
                .engineRef("1873243598304171").engineSourceKey("clip/avatar-old.mp4").engineStatus("ready").build();
        DapVoice voice = DapVoice.builder().id("VC-old").ownerUserId("owner-1").name("视频原声").kind("seed")
                .engine("shiliu").engineRef("1873405707094174").audioKey("clip/voice-old.m4a").engineStatus("ready").build();
        when(avatars.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc("owner-1", "shiliu"))
                .thenReturn(java.util.List.of(newest, older));
        when(voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(java.util.List.of(voice));

        service.delete("owner-1");

        verify(gateway).deleteAvatar("1873411191147139");
        verify(gateway).deleteAvatar("1873243598304171");
        verify(gateway).deleteVoice("1873405707094174");
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
    void avatarViewExposesDedicatedVoiceSource() {
        DapVoice voice = DapVoice.builder().id("VC-dedicated").ownerUserId("owner-1").name("我的声音").kind("clone")
                .engine("shiliu").engineRef("speaker-dedicated").engineStatus("ready").engineTrainedAt(Instant.now()).build();
        when(avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc("owner-1", "shiliu"))
                .thenReturn(Optional.empty());
        when(voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(Optional.of(voice));

        var view = service.view("owner-1");

        assertEquals("ready", view.voiceStatus());
        assertEquals("dedicated", view.voiceSource());
        assertEquals(100, view.voiceProgress());
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

    @Test
    void newAvatarCanReuseAnExistingReadyVoice() {
        DapVoice voice = DapVoice.builder().id("VC-ready").ownerUserId("owner-1").name("门店主理人声线")
                .kind("clone").engine("shiliu").engineRef("speaker-ready").engineStatus("ready").build();
        when(voices.findByIdAndOwnerUserId("VC-ready", "owner-1")).thenReturn(Optional.of(voice));
        when(avatars.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc("owner-1", "shiliu"))
                .thenReturn(List.of());
        when(gateway.cloneAvatar("owner-1", "clip/source", "speaker-ready", null))
                .thenReturn(new ShiliuGateway.Task("avatar:new", "processing", null, "new", null));

        var result = service.clone("owner-1", "avatar", file, null, "VC-ready", "橱窗形象");

        assertEquals("VC-ready", result.get("voiceId"));
        verify(gateway).cloneAvatar("owner-1", "clip/source", "speaker-ready", null);
        verify(avatars, atLeastOnce()).save(argThat(a -> "橱窗形象".equals(a.getName()) && "VC-ready".equals(a.getVoiceName())));
        verifyNoInteractions(voiceSeedExtractor);
    }

    @Test
    void renderReferencesResolveTheAvatarAndVoiceSelectedByProject() {
        DapAvatar avatar = DapAvatar.builder().id("DH-scene").ownerUserId("owner-1").engine("shiliu")
                .engineRef("avatar-scene").engineStatus("ready").voiceName("VC-scene").build();
        DapVoice voice = DapVoice.builder().id("VC-scene").ownerUserId("owner-1").engine("shiliu")
                .engineRef("speaker-scene").engineStatus("ready").build();
        when(avatars.findByIdAndOwnerUserId("DH-scene", "owner-1")).thenReturn(Optional.of(avatar));
        when(voices.findByIdAndOwnerUserId("VC-scene", "owner-1")).thenReturn(Optional.of(voice));

        assertEquals("avatar-scene", service.requiredAvatarEngineRef("owner-1", "DH-scene"));
        assertEquals("speaker-scene", service.requiredVoiceEngineRef("owner-1", "DH-scene", null));
    }
}
