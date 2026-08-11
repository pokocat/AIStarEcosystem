package com.aistareco.aep.clip;

import com.aistareco.aep.clip.model.ClipRenderJob;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.aep.clip.service.*;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ClipRenderWorkerStateTest {
    private ClipRenderJobRepository jobs;
    private ClipProjectRepository projects;
    private ClipOutputStorage outputStorage;
    private ClipAssemblyService assembly;
    private ShiliuService shiliu;
    private ClipAvatarService avatars;
    private ClipRenderWorkerState state;

    @BeforeEach
    void setUp() {
        jobs = mock(ClipRenderJobRepository.class);
        projects = mock(ClipProjectRepository.class);
        outputStorage = mock(ClipOutputStorage.class);
        assembly = mock(ClipAssemblyService.class);
        shiliu = mock(ShiliuService.class);
        avatars = mock(ClipAvatarService.class);
        state = new ClipRenderWorkerState(jobs, projects, shiliu, avatars, outputStorage, assembly);
        when(jobs.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void onlyCurrentLeaseOwnerCanAdvanceAStage() {
        ClipRenderJob job = job("queued", "tts", true);
        job.setLeaseOwner("worker-a");
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));

        state.advance(job.getId(), "worker-b");
        assertEquals("tts", job.getStage());
        verify(jobs, never()).save(any());

        state.advance(job.getId(), "worker-a");
        assertEquals("avatar", job.getStage());
        assertEquals("generating", job.getStatus());
        assertNull(job.getLeaseOwner());
        assertNull(job.getLeaseUntil());
        verify(jobs).save(job);
    }

    @Test
    void nonMockAssemblyStoresFinalVideoBeforeCompleting() {
        ClipRenderJob job = job("assembling", "assemble", false);
        job.setSegmentJobsJson(Map.of("segments", List.of()));
        job.setLeaseOwner("worker-a");
        ClipProject project = project(List.of(Map.of("no", 1, "role", "tail", "text", "结尾", "durationSec", 3)));
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));
        when(projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull("cp_1", "owner-1")).thenReturn(Optional.of(project));
        when(assembly.assemble("owner-1", project, job.getSegmentJobsJson()))
                .thenReturn(new ClipAssemblyService.Result("clip/works/result.mp4", 9));

        state.advance(job.getId(), "worker-a");

        assertEquals("succeeded", job.getStatus());
        assertEquals("clip/works/result.mp4", job.getOutputCdnKey());
        assertEquals(9, job.getDurationSec());
        verify(assembly).assemble("owner-1", project, job.getSegmentJobsJson());
    }

    @Test
    void nonMockAssemblyFailureIsNotHidden() {
        ClipRenderJob job = job("assembling", "assemble", false);
        job.setLeaseOwner("worker-a");
        ClipProject project = project(List.of(Map.of("no", 1, "role", "tail", "text", "结尾", "durationSec", 3)));
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));
        when(projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull("cp_1", "owner-1")).thenReturn(Optional.of(project));
        when(assembly.assemble(anyString(), any(), any())).thenThrow(new BusinessException(
                org.springframework.http.HttpStatus.BAD_GATEWAY, "CLIP_ASSEMBLY_FAILED", "总装失败"));

        BusinessException error = assertThrows(BusinessException.class, () -> state.advance(job.getId(), "worker-a"));
        assertEquals("CLIP_ASSEMBLY_FAILED", error.getCode());
    }

    @Test
    void ttsStageMirrorsOneBrollAudioPerAdvanceAndPersistsProgress() {
        ClipRenderJob job = job("queued", "tts", false);
        job.setLeaseOwner("worker-a");
        ClipProject project = project(List.of(
                Map.of("no", 1, "role", "avatar", "text", "我来开场"),
                Map.of("no", 2, "role", "broll", "text", "这里配店铺画面", "assetId", "ca_1"),
                Map.of("no", 3, "role", "broll", "text", "这里配产品画面", "assetId", "ca_2")
        ));
        ShiliuGateway gateway = mock(ShiliuGateway.class);
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));
        when(projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull("cp_1", "owner-1")).thenReturn(Optional.of(project));
        when(shiliu.required()).thenReturn(gateway);
        when(avatars.requiredVoiceEngineRef("owner-1")).thenReturn("speaker-1");
        when(gateway.previewVoice("owner-1", "speaker-1", "这里配店铺画面"))
                .thenReturn(new ShiliuGateway.Task("tts-1", "succeeded", 4, "https://example.com/audio.mp3", null));
        when(outputStorage.persistAudio("owner-1", "https://example.com/audio.mp3")).thenReturn("clip/audio/2.mp3");

        state.advance(job.getId(), "worker-a");

        assertEquals("tts", job.getStage());
        List<Map<String,Object>> rows = com.aistareco.aep.clip.dto.ClipDtos.mapListValue(job.getSegmentJobsJson().get("segments"));
        assertEquals("clip/audio/2.mp3", rows.get(1).get("audioCdnKey"));
        assertEquals(4, rows.get(1).get("actualDurationSec"));
        assertNull(rows.get(2).get("audioCdnKey"));
        verify(gateway, times(1)).previewVoice(anyString(), anyString(), anyString());
    }

    @Test
    void ttsStageWithoutBrollDoesNotCallVoiceGatewayEarly() {
        ClipRenderJob job = job("queued", "tts", false);
        job.setLeaseOwner("worker-a");
        ClipProject project = project(List.of(Map.of("no", 1, "role", "avatar", "text", "我来开场")));
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));
        when(projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull("cp_1", "owner-1")).thenReturn(Optional.of(project));

        state.advance(job.getId(), "worker-a");

        assertEquals("avatar", job.getStage());
        verifyNoInteractions(shiliu, avatars);
    }

    @Test
    void avatarStageWithoutAvatarSegmentsDoesNotRequireAvatarClone() {
        ClipRenderJob job = job("generating", "avatar", false);
        job.setLeaseOwner("worker-a");
        ClipProject project = project(List.of(Map.of("no", 1, "role", "broll", "text", "只配实拍画面", "assetId", "ca_1")));
        job.setSegmentJobsJson(Map.of("segments", List.of(
                Map.of("no", 1, "role", "broll", "audioCdnKey", "clip/audio/1.mp3")
        )));
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));
        when(projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull("cp_1", "owner-1")).thenReturn(Optional.of(project));

        state.advance(job.getId(), "worker-a");

        assertEquals("broll", job.getStage());
        assertEquals(60, job.getProgress());
        verifyNoInteractions(shiliu, avatars);
    }

    @Test
    void avatarStageStartsOneTaskPerAdvanceSoTaskIdsAreDurable() {
        ClipRenderJob job = job("generating", "avatar", false);
        job.setLeaseOwner("worker-a");
        ClipProject project = project(List.of(
                Map.of("no", 1, "role", "avatar", "text", "第一句"),
                Map.of("no", 2, "role", "avatar", "text", "第二句")
        ));
        ShiliuGateway gateway = mock(ShiliuGateway.class);
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));
        when(projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull("cp_1", "owner-1")).thenReturn(Optional.of(project));
        when(shiliu.required()).thenReturn(gateway);
        when(avatars.requiredAvatarEngineRef("owner-1")).thenReturn("avatar-1");
        when(avatars.requiredVoiceEngineRef("owner-1")).thenReturn("speaker-1");
        when(gateway.createVideoByText(eq("owner-1"), eq("avatar-1"), eq("speaker-1"), anyString()))
                .thenAnswer(inv -> new ShiliuGateway.Task("video:" + inv.getArgument(3), "processing", null, null, null));

        state.advance(job.getId(), "worker-a");

        assertEquals("avatar", job.getStage());
        verify(gateway, times(1)).createVideoByText(eq("owner-1"), eq("avatar-1"), eq("speaker-1"), anyString());
        List<Map<String,Object>> rows = com.aistareco.aep.clip.dto.ClipDtos.mapListValue(job.getSegmentJobsJson().get("segments"));
        assertEquals("video:第一句", rows.get(0).get("taskId"));
        assertNull(rows.get(1).get("taskId"));

        job.setLeaseOwner("worker-a");
        state.advance(job.getId(), "worker-a");
        verify(gateway, times(2)).createVideoByText(eq("owner-1"), eq("avatar-1"), eq("speaker-1"), anyString());
        rows = com.aistareco.aep.clip.dto.ClipDtos.mapListValue(job.getSegmentJobsJson().get("segments"));
        assertEquals(List.of("video:第一句", "video:第二句"), rows.stream().map(row -> row.get("taskId")).toList());
    }

    private static ClipRenderJob job(String status, String stage, boolean mock) {
        return ClipRenderJob.builder().id("cj_1").externalOwnerId("owner-1").projectId("cp_1")
                .clientRequestId("request-001").status(status).stage(stage).mock(mock)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }

    private static ClipProject project(List<Map<String,Object>> segments) {
        return ClipProject.builder().id("cp_1").externalOwnerId("owner-1").templateId("ct_1")
                .templateName("模板").title("作品").payloadJson(new java.util.LinkedHashMap<>(Map.of("segments", segments)))
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }
}
