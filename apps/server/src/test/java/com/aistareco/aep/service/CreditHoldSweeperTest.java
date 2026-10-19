package com.aistareco.aep.service;

import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.repository.CreditHoldRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * CreditHoldSweeper（v2 §5）：超 TTL 的孤儿 ACTIVE hold 自动 releaseHold 退回原桶；
 * 单笔释放失败不阻断整批；无孤儿时不动。
 */
class CreditHoldSweeperTest {
    @Test void staleQueuedVideoExpiresTaskAndMoneyThroughItsOwningService() {
        var jobs=mock(com.aistareco.aep.repository.MaterialVideoJobRepository.class);
        var service=mock(com.aistareco.aep.service.materialvideo.MaterialVideoJobService.class);
        @SuppressWarnings("unchecked") org.springframework.beans.factory.ObjectProvider<com.aistareco.aep.service.materialvideo.MaterialVideoJobService> provider=mock(org.springframework.beans.factory.ObjectProvider.class);
        when(provider.getObject()).thenReturn(service);
        org.springframework.test.util.ReflectionTestUtils.setField(sweeper,"videoJobs",jobs);
        org.springframework.test.util.ReflectionTestUtils.setField(sweeper,"videoService",provider);
        when(holdRepo.findByStatusAndCreatedAtBefore(any(),any())).thenReturn(List.of(hold("queued","material_video_job","queued")));
        when(jobs.findById("queued")).thenReturn(java.util.Optional.of(com.aistareco.aep.model.MaterialVideoJob.builder().id("queued").ownerUserId("owner").status("queued").build()));
        sweeper.sweep();verify(service).expireQueued(eq("queued"),eq("owner"),anyString());verifyNoInteractions(creditService);
    }
    @Test void uncertainAndAcceptedVideoKeepOriginalHoldsUntilReconciled() {
        var jobs=mock(com.aistareco.aep.repository.MaterialVideoJobRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(sweeper,"videoJobs",jobs);
        when(holdRepo.findByStatusAndCreatedAtBefore(any(),any())).thenReturn(List.of(
                hold("unknown","material_video_job","unknown"),hold("accepted","material_video_job","accepted"),
                hold("orphan","material_video_job","missing")));
        when(jobs.findById("unknown")).thenReturn(java.util.Optional.of(com.aistareco.aep.model.MaterialVideoJob.builder().status("submitting").build()));
        when(jobs.findById("accepted")).thenReturn(java.util.Optional.of(com.aistareco.aep.model.MaterialVideoJob.builder().status("generating").externalTaskId("original").build()));
        when(jobs.findById("missing")).thenReturn(java.util.Optional.empty());
        sweeper.sweep();
        verify(creditService,never()).releaseHold(eq("material_video_job"),eq("unknown"),anyString());
        verify(creditService,never()).releaseHold(eq("material_video_job"),eq("accepted"),anyString());
        verify(creditService).releaseHold(eq("material_video_job"),eq("missing"),anyString());
    }
    @Test void acceptedSpeechOwnsItsHoldAcrossOutageWhileTrueOrphanIsReleased() {
        var runs=mock(com.aistareco.aep.ipstudio.repository.IpRunRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(sweeper,"ipRuns",runs);
        String ref=com.aistareco.aep.ipstudio.service.IpRunService.REF_TYPE;
        when(holdRepo.findByStatusAndCreatedAtBefore(any(),any())).thenReturn(List.of(hold("speech",ref,"active"),hold("orphan",ref,"missing")));
        when(runs.findById("active")).thenReturn(java.util.Optional.of(com.aistareco.aep.ipstudio.model.IpRun.builder().kind("studio-audio").status("running").build()));
        when(runs.findById("missing")).thenReturn(java.util.Optional.empty());
        sweeper.sweep();verify(creditService,never()).releaseHold(eq(ref),eq("active"),anyString());verify(creditService).releaseHold(eq(ref),eq("missing"),anyString());
    }

    private CreditHoldRepository holdRepo;
    private CreditService creditService;
    private CreditHoldSweeper sweeper;

    @BeforeEach
    void setUp() {
        holdRepo = mock(CreditHoldRepository.class);
        creditService = mock(CreditService.class);
        sweeper = new CreditHoldSweeper(holdRepo, creditService, 180);
    }

    private static CreditHold hold(String id, String refType, String refId) {
        return CreditHold.builder().id(id).referenceType(refType).referenceId(refId)
                .status(CreditHold.Status.ACTIVE).createdAt(Instant.EPOCH).updatedAt(Instant.EPOCH).build();
    }

    @Test
    void releasesEachStaleActiveHold() {
        when(holdRepo.findByStatusAndCreatedAtBefore(eq(CreditHold.Status.ACTIVE), any()))
                .thenReturn(List.of(hold("h1", "mixcut_job", "j1"), hold("h2", "DRAMA_SHORT", "s1")));
        sweeper.sweep();
        verify(creditService).releaseHold(eq("mixcut_job"), eq("j1"), anyString());
        verify(creditService).releaseHold(eq("DRAMA_SHORT"), eq("s1"), anyString());
    }

    @Test
    void continuesAfterOneReleaseFails() {
        when(holdRepo.findByStatusAndCreatedAtBefore(any(), any()))
                .thenReturn(List.of(hold("h1", "a", "1"), hold("h2", "b", "2")));
        doThrow(new RuntimeException("boom")).when(creditService).releaseHold(eq("a"), eq("1"), anyString());
        sweeper.sweep(); // 不抛
        verify(creditService).releaseHold(eq("b"), eq("2"), anyString());
    }

    @Test
    void noReleaseWhenNoneStale() {
        when(holdRepo.findByStatusAndCreatedAtBefore(any(), any())).thenReturn(List.of());
        sweeper.sweep();
        verify(creditService, never()).releaseHold(anyString(), anyString(), anyString());
    }
}
