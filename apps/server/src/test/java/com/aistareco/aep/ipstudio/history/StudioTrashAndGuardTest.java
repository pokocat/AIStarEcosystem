package com.aistareco.aep.ipstudio.history;

import com.aistareco.aep.ipstudio.director.DirectorService;
import com.aistareco.aep.ipstudio.director.DirectorWorkRepository;
import com.aistareco.aep.ipstudio.execution.IpPlanExecution;
import com.aistareco.aep.ipstudio.execution.IpPlanExecutionRepository;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.aistareco.aep.ipstudio.repository.IpProjectRevisionRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class StudioTrashAndGuardTest {
    private final IpProjectRepository projects = mock(IpProjectRepository.class);
    private final IpProjectRevisionRepository revisions = mock(IpProjectRevisionRepository.class);
    private final DirectorWorkRepository works = mock(DirectorWorkRepository.class);
    private final IpRunRepository runs = mock(IpRunRepository.class);
    private final MaterialVideoJobRepository videoJobs = mock(MaterialVideoJobRepository.class);
    private final IpPlanExecutionRepository executions = mock(IpPlanExecutionRepository.class);
    private final StudioTrashService trash = new StudioTrashService(projects, revisions, works, runs, videoJobs, executions,
            mock(DirectorService.class), new ObjectMapper(), mock(PlatformTransactionManager.class), 0);

    private IpProject project(Instant deletedAt) {
        IpProject p = new IpProject();
        p.setId("IPP-1"); p.setOwnerUserId("u1"); p.setDeletedAt(deletedAt);
        return p;
    }

    private String code(Runnable call) {
        try { call.run(); return null; } catch (BusinessException e) { return e.getCode(); }
    }

    @Test
    void onlyTrashedCanvasesWithNothingInFlightCanBePurged() {
        when(projects.lockById("IPP-1")).thenReturn(Optional.of(project(null)));
        assertThat(code(() -> trash.purgeCanvas("u1", "IPP-1"))).isEqualTo("IP_PROJECT_NOT_IN_TRASH");

        when(projects.lockById("IPP-1")).thenReturn(Optional.of(project(Instant.now())));
        when(runs.taskStates("IPP-1")).thenReturn(List.<Object[]>of(new Object[]{"running", "queued", "n1", "{}"}));
        assertThat(code(() -> trash.purgeCanvas("u1", "IPP-1"))).isEqualTo("IP_PROJECT_BUSY");

        // 任务行已是 done / video.bound，但它绑定的视频任务还在生成：同样不能删（Codex 评审的阻塞项）。
        when(runs.taskStates("IPP-1")).thenReturn(List.<Object[]>of(new Object[]{"done", "video.bound", "n1", "{\"_exec\":{\"nativeVideoJobIds\":[\"mv-1\"]}}"}));
        when(videoJobs.states(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{"mv-1", "processing", null, "u1"}));
        assertThat(code(() -> trash.purgeCanvas("u1", "IPP-1"))).isEqualTo("IP_PROJECT_BUSY");
        // 查不到视频任务也不删
        when(videoJobs.states(anyCollection())).thenReturn(List.of());
        assertThat(code(() -> trash.purgeCanvas("u1", "IPP-1"))).isEqualTo("IP_PROJECT_BUSY");
        // 制作计划还在跑也不删
        when(videoJobs.states(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{"mv-1", "succeeded", null, "u1"}));
        when(executions.findByProjectIdAndStatusIn(eq("IPP-1"), any())).thenReturn(List.of(IpPlanExecution.builder().status(IpPlanExecution.PAUSED).build()));
        assertThat(code(() -> trash.purgeCanvas("u1", "IPP-1"))).isEqualTo("IP_PROJECT_BUSY");
        verify(projects, never()).delete(any());

        when(executions.findByProjectIdAndStatusIn(eq("IPP-1"), any())).thenReturn(List.of());
        assertThat(code(() -> trash.purgeCanvas("u1", "IPP-1"))).isNull();
        verify(projects).delete(any());
    }

    @Test
    void expiredPurgeRechecksTheDeletionTimeUnderTheLock() {
        IpProject restoredThenDeletedAgain = project(Instant.now());
        when(projects.lockById("IPP-1")).thenReturn(Optional.of(restoredThenDeletedAgain));
        when(runs.taskStates("IPP-1")).thenReturn(List.of());
        assertThat(code(() -> trash.purgeCanvas("u1", "IPP-1", Instant.now().minusSeconds(3600)))).isEqualTo("IP_PROJECT_NOT_EXPIRED");
        verify(projects, never()).delete(any());
    }

    @Test
    void anotherUsersCanvasIsNotFound() {
        when(projects.lockById("IPP-1")).thenReturn(Optional.of(project(Instant.now())));
        assertThat(code(() -> trash.purgeCanvas("u2", "IPP-1"))).isEqualTo("IP_PROJECT_NOT_FOUND");
    }

    @Test
    void expiryIsOffByDefault() {
        trash.purgeExpired();
        verifyNoInteractions(projects, works);
        assertThat(trash.retentionDays()).isZero();
    }

    @Test
    void uploadGuardOnlyChecksWhenEnabled() {
        StudioStorageService storage = mock(StudioStorageService.class);
        when(storage.usage("u1")).thenReturn(new StudioStorageService.Usage(5100, 5120, 5120, 0, List.of()));
        new StudioStorageGuard(storage, false).checkUpload("u1", 100L * 1024 * 1024);
        verifyNoInteractions(storage);
        assertThatThrownBy(() -> new StudioStorageGuard(storage, true).checkUpload("u1", 100L * 1024 * 1024))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode()).isEqualTo("STORAGE_QUOTA_EXCEEDED");
        new StudioStorageGuard(storage, true).checkUpload("u1", 10L * 1024 * 1024);
    }
}
