package com.aistareco.aep.clip;

import com.aistareco.aep.clip.dto.ClipDtos.TtsPreviewDto;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.model.ClipTtsPreview;
import com.aistareco.aep.clip.repository.ClipTtsPreviewRepository;
import com.aistareco.aep.clip.service.ClipOutputStorage;
import com.aistareco.aep.clip.service.ClipProjectService;
import com.aistareco.aep.clip.service.ClipAvatarService;
import com.aistareco.aep.clip.service.ClipTtsPreviewService;
import com.aistareco.aep.clip.service.shiliu.MockShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** WORKPLAN 2026-09-05 §1.5 配音预览时间线。 */
class ClipTtsPreviewServiceTest {
    private ClipTtsPreviewRepository repo;
    private ClipProjectService projects;
    private ShiliuService shiliu;
    private ClipAvatarService avatars;
    private ClipOutputStorage outputStorage;
    private FileStorageService storage;
    private ClipTtsPreviewService previews;
    private final Map<String, ClipTtsPreview> rows = new LinkedHashMap<>();

    @BeforeEach
    void setUp() {
        repo = mock(ClipTtsPreviewRepository.class);
        projects = mock(ClipProjectService.class);
        shiliu = mock(ShiliuService.class);
        avatars = mock(ClipAvatarService.class);
        outputStorage = mock(ClipOutputStorage.class);
        storage = mock(FileStorageService.class);
        previews = new ClipTtsPreviewService(repo, projects, shiliu, avatars, outputStorage, storage);

        when(repo.save(any())).thenAnswer(inv -> {
            ClipTtsPreview row = inv.getArgument(0);
            rows.put(row.getId(), row);
            return row;
        });
        when(repo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(rows.get(inv.getArgument(0))));
        when(repo.findByExternalOwnerIdAndProjectId(anyString(), anyString())).thenAnswer(inv ->
                rows.values().stream()
                        .filter(row -> row.getExternalOwnerId().equals(inv.getArgument(0))
                                && row.getProjectId().equals(inv.getArgument(1)))
                        .findFirst());
        AtomicInteger seq = new AtomicInteger();
        when(storage.store(any(byte[].class), anyString(), anyString(), anyString(), anyString()))
                .thenAnswer(inv -> new FileStorageService.StoredFile(
                        "clip/tts-preview/mock-" + seq.incrementAndGet() + ".wav", null, null, null, 1, "audio/wav"));
        when(storage.signedUrl(anyString())).thenAnswer(inv -> "https://cdn.example.com/" + inv.getArgument(0) + "?sig=short-lived");
        when(shiliu.required()).thenReturn(new MockShiliuGateway());
        when(avatars.requiredVoiceEngineRef(anyString(), any(), any())).thenReturn("1873244706649061");
    }

    @Test
    void triggerQueuesTheWholeTimelineAndIsIdempotentWhileTheScriptIsUnchanged() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王", "我们在学院路开了十二年", "vo_1"));

        TtsPreviewDto first = previews.trigger("owner-1", "cp_1");
        assertEquals("generating", first.status());
        assertTrue(first.timelineHash().startsWith("sha256:"));
        assertEquals("vo_1", first.voiceId());
        assertEquals(3, first.segments().size(), "结尾固定段也进时间轴，否则总时长和成片对不上");
        assertNull(first.segments().get(0).audioUrl(), "还没合成的段不能给一个假的地址");
        assertEquals(0, first.credits(), "Scheme A：clip 域不扣钻石，恒为 0");

        reset(repo);
        wireRepo();
        TtsPreviewDto second = previews.trigger("owner-1", "cp_1");
        assertEquals(first.timelineHash(), second.timelineHash());
        verify(repo, never()).save(any());
    }

    @Test
    void advanceSynthesisesSegmentBySegmentThenReportsReadyWithAccumulatedStartSec() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王", "我们在学院路开了十二年", "vo_1"));
        previews.trigger("owner-1", "cp_1");
        ClipTtsPreview row = rows.values().iterator().next();
        row.setLeaseOwner("worker-a");

        previews.advance(row.getId(), "worker-a");
        assertEquals("generating", row.getStatus(), "还有一段没合成，不能报 ready");
        // 每推进一段就还回租约（和出片 worker 同一套），所以下一轮得重新拿
        row.setLeaseOwner("worker-a");
        previews.advance(row.getId(), "worker-a");
        row.setLeaseOwner("worker-a");
        previews.advance(row.getId(), "worker-a");

        assertEquals("ready", row.getStatus());
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王", "我们在学院路开了十二年", "vo_1"));
        TtsPreviewDto view = previews.view("owner-1", "cp_1");
        assertEquals("ready", view.status());
        assertEquals(3, view.segments().size());
        assertEquals(0d, view.segments().get(0).startSec());
        assertEquals(view.segments().get(0).durationSec(), view.segments().get(1).startSec(), "startSec 必须是前面各段时长的累加");
        assertEquals(view.segments().get(1).startSec() + view.segments().get(1).durationSec(),
                view.segments().get(2).startSec());
        assertEquals(view.segments().stream().mapToDouble(s -> s.durationSec()).sum(), view.totalDurationSec(), 0.05);
        assertTrue(view.segments().get(0).audioUrl().contains("sig="), "音频必须出短期签名 URL");
        assertNull(view.segments().get(2).audioUrl(), "结尾固定段没有配音");
        assertNull(view.errorCode());
    }

    @Test
    void changingTheScriptInvalidatesTheOldResultAndDropsItsAudio() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王", "我们在学院路开了十二年", "vo_1"));
        String before = previews.trigger("owner-1", "cp_1").timelineHash();
        ClipTtsPreview row = rows.values().iterator().next();
        row.setLeaseOwner("worker-a");
        previews.advance(row.getId(), "worker-a");
        String orphan = String.valueOf(com.aistareco.aep.clip.dto.ClipDtos
                .mapListValue(row.getSegmentsJson().get("items")).get(0).get("audioCdnKey"));
        assertFalse(orphan.isBlank());

        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王头", "我们在学院路开了十二年", "vo_1"));
        TtsPreviewDto after = previews.trigger("owner-1", "cp_1");
        assertNotEquals(before, after.timelineHash());
        assertEquals("generating", after.status());
        assertNull(after.segments().get(0).audioUrl());
        verify(outputStorage).deleteQuietly(orphan);
    }

    @Test
    void changingOnlyTheVoiceAlsoInvalidatesTheTimeline() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王", "我们在学院路开了十二年", "vo_1"));
        String before = previews.trigger("owner-1", "cp_1").timelineHash();
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王", "我们在学院路开了十二年", "vo_2"));
        assertNotEquals(before, previews.trigger("owner-1", "cp_1").timelineHash());
    }

    @Test
    void aStaleTimelineIsNotServedByThePollingEndpoint() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王", "我们在学院路开了十二年", "vo_1"));
        previews.trigger("owner-1", "cp_1");
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王头", "我们在学院路开了十二年", "vo_1"));

        BusinessException error = assertThrows(BusinessException.class, () -> previews.view("owner-1", "cp_1"));
        assertEquals("CLIP_TTS_PREVIEW_NOT_FOUND", error.getCode());
        assertEquals(HttpStatus.NOT_FOUND, error.getStatus());
    }

    @Test
    void missingVoiceFailsLoudlyInsteadOfReturningAnEmptyTimeline() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王", "我们在学院路开了十二年", null));
        when(avatars.requiredVoiceEngineRef(anyString(), any(), any()))
                .thenThrow(new BusinessException(HttpStatus.CONFLICT, "CLIP_VOICE_NOT_SELECTED", "还没有关联声音"));

        TtsPreviewDto view = previews.trigger("owner-1", "cp_1");
        assertEquals("failed", view.status());
        assertEquals("CLIP_VOICE_NOT_SELECTED", view.errorCode());
        assertNotNull(view.errorMessage());
    }

    @Test
    void aRealGatewayThatReturnsNothingMirrorableIsAFailureNotASilentPlaceholder() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王", "我们在学院路开了十二年", "vo_1"));
        ShiliuGateway broken = mock(ShiliuGateway.class);
        when(broken.mock()).thenReturn(false);
        when(broken.previewVoice(anyString(), anyString(), anyString()))
                .thenReturn(new ShiliuGateway.Task("t1", "succeeded", 4, "not-a-url", null));
        when(shiliu.required()).thenReturn(broken);

        previews.trigger("owner-1", "cp_1");
        ClipTtsPreview row = rows.values().iterator().next();
        row.setLeaseOwner("worker-a");
        BusinessException error = assertThrows(BusinessException.class, () -> previews.advance(row.getId(), "worker-a"));
        assertEquals("CLIP_TTS_FAILED", error.getCode());
        verify(storage, never()).store(any(byte[].class), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void failIsRecordedWithAnExplicitCode() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project("你好，我是老王", "我们在学院路开了十二年", "vo_1"));
        previews.trigger("owner-1", "cp_1");
        ClipTtsPreview row = rows.values().iterator().next();

        previews.fail(row.getId(), "CLIP_TTS_PREVIEW_TIMEOUT", "配音预览长时间没有进展，已自动终止");
        assertEquals("failed", row.getStatus());
        assertEquals("CLIP_TTS_PREVIEW_TIMEOUT", row.getErrorCode());
        assertNull(row.getLeaseOwner());
    }

    @Test
    void mockPlaceholderAudioIsARealWavOfTheRightLength() {
        byte[] wav = ClipTtsPreviewService.silentWav(2);
        assertEquals(44 + 8000 * 2 * 2, wav.length);
        assertEquals("RIFF", new String(Arrays.copyOfRange(wav, 0, 4), java.nio.charset.StandardCharsets.US_ASCII));
        assertEquals("WAVE", new String(Arrays.copyOfRange(wav, 8, 12), java.nio.charset.StandardCharsets.US_ASCII));
    }

    private void wireRepo() {
        when(repo.save(any())).thenAnswer(inv -> { ClipTtsPreview row = inv.getArgument(0); rows.put(row.getId(), row); return row; });
        when(repo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(rows.get(inv.getArgument(0))));
        when(repo.findByExternalOwnerIdAndProjectId(anyString(), anyString())).thenAnswer(inv ->
                rows.values().stream()
                        .filter(row -> row.getExternalOwnerId().equals(inv.getArgument(0))
                                && row.getProjectId().equals(inv.getArgument(1)))
                        .findFirst());
    }

    private static ClipProject project(String avatarText, String brollText, String voiceId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("segments", List.of(
                new LinkedHashMap<>(Map.of("no", 1, "role", "avatar", "text", avatarText)),
                new LinkedHashMap<>(Map.of("no", 2, "role", "broll", "text", brollText, "assetId", "ca_1")),
                new LinkedHashMap<>(Map.of("no", 3, "role", "tail", "text", "结尾", "durationSec", 3))));
        payload.put("avatarId", "av_1");
        if (voiceId != null) payload.put("voiceId", voiceId);
        return ClipProject.builder().id("cp_1").externalOwnerId("owner-1").templateId("ct_1").templateName("模板")
                .title("作品").payloadJson(payload).createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }
}
