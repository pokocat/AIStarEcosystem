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
