package com.aistareco.aep.clip;

import com.aistareco.aep.clip.model.ClipRenderJob;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.aep.clip.service.*;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ClipRenderWorkerStateTest {
    private ClipRenderJobRepository jobs;
    private ClipProjectRepository projects;
    private ClipOutputStorage outputStorage;
    private ClipRenderWorkerState state;

    @BeforeEach
    void setUp() {
        jobs = mock(ClipRenderJobRepository.class);
        projects = mock(ClipProjectRepository.class);
        outputStorage = mock(ClipOutputStorage.class);
        state = new ClipRenderWorkerState(jobs, projects, mock(ShiliuService.class), mock(ClipAvatarService.class), outputStorage);
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
    void nonMockAssemblyPersistsUpstreamVideoBeforeCompleting() {
        ClipRenderJob job = job("assembling", "assemble", false);
        job.setSegmentJobsJson(java.util.Map.of("outputRef", "https://example.com/result.mp4"));
        job.setLeaseOwner("worker-a");
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));
        when(outputStorage.persist("owner-1", "https://example.com/result.mp4")).thenReturn("clip/works/result.mp4");

        state.advance(job.getId(), "worker-a");

        assertEquals("succeeded", job.getStatus());
        assertEquals("clip/works/result.mp4", job.getOutputCdnKey());
        verify(outputStorage).persist("owner-1", "https://example.com/result.mp4");
    }

    @Test
    void nonMockAssemblyFailsWhenEngineReturnedNoVideoUrl() {
        ClipRenderJob job = job("assembling", "assemble", false);
        job.setLeaseOwner("worker-a");
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));

        BusinessException error = assertThrows(BusinessException.class, () -> state.advance(job.getId(), "worker-a"));
        assertEquals("CLIP_ENGINE_OUTPUT_MISSING", error.getCode());
        verify(outputStorage, never()).persist(anyString(), anyString());
    }

    private static ClipRenderJob job(String status, String stage, boolean mock) {
        return ClipRenderJob.builder().id("cj_1").externalOwnerId("owner-1").projectId("cp_1")
                .clientRequestId("request-001").status(status).stage(stage).mock(mock)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }
}
