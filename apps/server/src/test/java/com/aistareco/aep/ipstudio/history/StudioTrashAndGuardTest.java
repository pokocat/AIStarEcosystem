package com.aistareco.aep.ipstudio.history;

import com.aistareco.aep.ipstudio.director.DirectorWorkRepository;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.aistareco.aep.ipstudio.repository.IpProjectRevisionRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class StudioTrashAndGuardTest {
    private final IpProjectRepository projects = mock(IpProjectRepository.class);
    private final IpProjectRevisionRepository revisions = mock(IpProjectRevisionRepository.class);
    private final DirectorWorkRepository works = mock(DirectorWorkRepository.class);
    private final IpRunRepository runs = mock(IpRunRepository.class);
    private final StudioTrashService trash = new StudioTrashService(projects, revisions, works, runs, mock(PlatformTransactionManager.class), 0);

    private IpProject project(Instant deletedAt) {
        IpProject p = new IpProject();
        p.setId("IPP-1"); p.setOwnerUserId("u1"); p.setDeletedAt(deletedAt);
        return p;
    }

    @Test
    void onlyTrashedCanvasesWithoutRunningTasksCanBePurged() {
        when(projects.findById("IPP-1")).thenReturn(Optional.of(project(null)));
        assertThatThrownBy(() -> trash.purgeCanvas("u1", "IPP-1")).isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode()).isEqualTo("IP_PROJECT_NOT_IN_TRASH");

        when(projects.findById("IPP-1")).thenReturn(Optional.of(project(Instant.now())));
        IpRun running = IpRun.builder().id("IPR-1").projectId("IPP-1").status(IpRun.STATUS_RUNNING).build();
        when(runs.findByProjectIdOrderByCreatedAtDesc("IPP-1")).thenReturn(List.of(running));
        assertThatThrownBy(() -> trash.purgeCanvas("u1", "IPP-1")).isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode()).isEqualTo("IP_PROJECT_BUSY");
        verify(projects, never()).delete(any());

        when(runs.findByProjectIdOrderByCreatedAtDesc("IPP-1")).thenReturn(List.of());
        trash.purgeCanvas("u1", "IPP-1");
        verify(projects).delete(any());
    }

    @Test
    void anotherUsersCanvasIsNotFound() {
        when(projects.findById("IPP-1")).thenReturn(Optional.of(project(Instant.now())));
        assertThatThrownBy(() -> trash.purgeCanvas("u2", "IPP-1")).isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode()).isEqualTo("IP_PROJECT_NOT_FOUND");
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
