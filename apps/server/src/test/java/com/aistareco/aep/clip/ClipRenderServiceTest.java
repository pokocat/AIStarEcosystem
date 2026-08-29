package com.aistareco.aep.clip;

import com.aistareco.aep.clip.dto.ClipDtos.*;
import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.aep.clip.service.*;
import com.aistareco.aep.clip.service.shiliu.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ClipRenderServiceTest {
    private ClipRenderJobRepository jobs;
    private ClipProjectRepository projectRepo;
    private ClipProjectService projects;
    private ClipEstimateService estimates;
    private ShiliuService shiliu;
    private ClipRenderService service;
    private ClipProject project;

    @BeforeEach
    void setUp() {
        jobs = mock(ClipRenderJobRepository.class);
        projectRepo = mock(ClipProjectRepository.class);
        projects = mock(ClipProjectService.class);
        estimates = mock(ClipEstimateService.class);
        shiliu = mock(ShiliuService.class);
        ShiliuGateway gateway = mock(ShiliuGateway.class);
        when(gateway.mock()).thenReturn(false);
        when(shiliu.required()).thenReturn(gateway);
        when(shiliu.mockMode()).thenReturn(false);
        project = ClipProject.builder().id("cp_1").externalOwnerId("owner-1").templateId("ct_1")
                .templateName("测试模板").title("测试项目").status("draft").payloadJson(Map.of("segments", List.of()))
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(projects.required("owner-1", "cp_1")).thenReturn(project);
        when(estimates.estimate("owner-1", "cp_1", null, null)).thenReturn(new EstimateDto(List.of(), 9,
                new EstimateSummary(10, 6, 0, 1, 1, 0, 20)));
        when(jobs.findByExternalOwnerIdAndClientRequestId("owner-1", "request-001")).thenReturn(Optional.empty());
        when(jobs.save(any())).thenAnswer(inv -> inv.getArgument(0));
        service = new ClipRenderService(jobs, projectRepo, projects, estimates, shiliu);
    }

    @Test
    void createsOneOwnerScopedJobOnlyAfterExactExternalQuoteMatch() {
        RenderResult result = service.render("owner-1", "cp_1", "request-001", 9);
        assertEquals("queued", result.status());
        assertTrue(result.jobId().startsWith("cj_"));
        verify(estimates).preflight("owner-1", project);
        verify(jobs).save(argThat(j -> "owner-1".equals(j.getExternalOwnerId()) && j.getCreditsHeld() == 9));
        verify(projectRepo).save(project);
    }

    @Test
    void changedExternalQuoteFailsBeforeJobCreation() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.render("owner-1", "cp_1", "request-001", 8));
        assertEquals("CLIP_QUOTE_CHANGED", error.getCode());
        verify(jobs, never()).save(any());
        verify(projectRepo, never()).save(any());
    }

    @Test
    void sameOwnerRequestIdReturnsExistingJobWithoutSecondInsert() {
        ClipRenderJob existing = ClipRenderJob.builder().id("cj_existing").externalOwnerId("owner-1")
                .projectId("cp_1").clientRequestId("request-001").creditsHeld(9).status("queued").build();
        when(jobs.findByExternalOwnerIdAndClientRequestId("owner-1", "request-001")).thenReturn(Optional.of(existing));

        RenderResult result = service.render("owner-1", "cp_1", "request-001", 9);
        assertEquals("cj_existing", result.jobId());
        verify(jobs, never()).save(any());
    }

    @Test
    void findsAcceptedJobByOwnerAndClientRequestIdForBillingReconciliation() {
        ClipRenderJob existing = ClipRenderJob.builder().id("cj_existing").externalOwnerId("owner-1")
                .projectId("cp_1").clientRequestId("request-001").creditsHeld(9).status("assembling").build();
        when(jobs.findByExternalOwnerIdAndClientRequestId("owner-1", "request-001")).thenReturn(Optional.of(existing));

        RenderResult result = service.findByRequest("owner-1", "request-001");
        assertEquals("cj_existing", result.jobId());
        assertEquals("assembling", result.status());
    }

    @Test
    void requestLookupDoesNotLeakAnotherOwnersJob() {
        when(jobs.findByExternalOwnerIdAndClientRequestId("owner-2", "request-001")).thenReturn(Optional.empty());
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.findByRequest("owner-2", "request-001"));
        assertEquals("CLIP_JOB_NOT_FOUND", error.getCode());
    }
}
