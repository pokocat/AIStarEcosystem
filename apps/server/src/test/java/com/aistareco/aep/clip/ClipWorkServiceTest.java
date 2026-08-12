package com.aistareco.aep.clip;

import com.aistareco.aep.clip.dto.ClipDtos.WorkDto;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.model.ClipRenderJob;
import com.aistareco.aep.clip.repository.ClipProjectRepository;
import com.aistareco.aep.clip.repository.ClipRenderJobRepository;
import com.aistareco.aep.clip.service.ClipAssetThumbnailExtractor;
import com.aistareco.aep.clip.service.ClipWorkService;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ClipWorkServiceTest {
    private ClipProjectRepository projects;
    private ClipRenderJobRepository jobs;
    private ClipWorkService service;

    @BeforeEach
    void setUp() {
        projects = mock(ClipProjectRepository.class);
        jobs = mock(ClipRenderJobRepository.class);
        service = new ClipWorkService(projects, jobs, mock(FileStorageService.class),
                mock(ShiliuService.class), mock(ClipAssetThumbnailExtractor.class));
    }

    @Test
    void exposesJobStartAndActualCompletionTime() {
        Instant created = Instant.parse("2026-08-11T18:01:02Z");
        Instant completed = Instant.parse("2026-08-11T18:04:05Z");
        ClipProject project = project("done");
        ClipRenderJob job = ClipRenderJob.builder().id("cj_1").projectId(project.getId())
                .externalOwnerId("owner-1").clientRequestId("request-001").status("succeeded")
                .createdAt(created).updatedAt(completed).completedAt(completed).build();
        when(projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull("cp_1", "owner-1")).thenReturn(Optional.of(project));
        when(jobs.findFirstByProjectIdAndExternalOwnerIdOrderByCreatedAtDesc("cp_1", "owner-1")).thenReturn(Optional.of(job));

        WorkDto result = service.get("owner-1", "cp_1");

        assertEquals(created.toString(), result.createdAt());
        assertEquals(completed.toString(), result.generatedAt());
    }

    @Test
    void deletingWorkCancelsActiveJobsAndSoftDeletesProject() {
        ClipProject project = project("generating");
        ClipRenderJob active = ClipRenderJob.builder().id("cj_active").projectId(project.getId())
                .externalOwnerId("owner-1").clientRequestId("request-active").status("assembling").build();
        ClipRenderJob completed = ClipRenderJob.builder().id("cj_done").projectId(project.getId())
                .externalOwnerId("owner-1").clientRequestId("request-done").status("succeeded").build();
        when(projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull("cp_1", "owner-1")).thenReturn(Optional.of(project));
        when(jobs.findByProjectId("cp_1")).thenReturn(List.of(active, completed));
        when(jobs.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<String> cancelledJobIds = service.delete("owner-1", "cp_1");

        assertNotNull(project.getDeletedAt());
        assertEquals(List.of("cj_active"), cancelledJobIds);
        assertEquals("cancelled", active.getStatus());
        assertEquals("用户删除作品", active.getErrorMessage());
        assertNotNull(active.getCompletedAt());
        assertEquals("succeeded", completed.getStatus());
        verify(jobs).save(active);
        verify(jobs, never()).save(completed);
        verify(projects).save(project);
    }

    private static ClipProject project(String status) {
        return ClipProject.builder().id("cp_1").externalOwnerId("owner-1").templateId("ct_1")
                .templateName("测试模板").title("测试作品").status(status).payloadJson(Map.of())
                .createdAt(Instant.parse("2026-08-11T18:00:00Z")).updatedAt(Instant.parse("2026-08-11T18:04:05Z"))
                .build();
    }
}
