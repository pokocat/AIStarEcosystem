package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdjustmentResult;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.model.CreditAdjustmentRequest;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.repository.CreditAdjustmentRequestRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * CreditOpsService（v2 §5 / §9.2）：调差/赠送只走 GIFT（不碰资金面）+ maker-checker
 * （小额直发 / 大额进审批 / maker≠checker 复核才入账）。阈值 5000。
 */
class CreditOpsServiceTest {

    private CreditService creditService;
    private CreditAdjustmentRequestRepository requestRepo;
    private com.aistareco.aep.repository.LedgerEntryRepository ledgerRepo;
    private CreditOpsService svc;
    private Map<String, CreditAdjustmentRequest> db;

    @BeforeEach
    void setUp() {
        creditService = mock(CreditService.class);
        when(creditService.creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString()))
                .thenAnswer(inv -> new LedgerEntryDto("le_x", "w1", inv.getArgument(0, String.class),
                        null, null, null, "gift", inv.getArgument(1, Long.class), 0, "d",
                        inv.getArgument(4, String.class), inv.getArgument(3, String.class), Instant.now()));
        requestRepo = mock(CreditAdjustmentRequestRepository.class);
        ledgerRepo = mock(com.aistareco.aep.repository.LedgerEntryRepository.class);
        // 默认非重复（existsByReferenceTypeAndReferenceId 未 stub → Mockito boolean 默认 false）
        db = new HashMap<>();
        when(requestRepo.save(any())).thenAnswer(inv -> {
            CreditAdjustmentRequest r = inv.getArgument(0);
            db.put(r.getId(), r);
            return r;
        });
        when(requestRepo.findById(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(db.get(inv.getArgument(0, String.class))));
        // 默认日限额 50000、actor 当日累计 0（未 stub → Mockito long 默认 0）
        svc = new CreditOpsService(creditService, requestRepo, ledgerRepo, 5000, 50000);
    }

    @Test
    void smallCompensateExecutesImmediately() {
        AdjustmentResult r = svc.compensate("u1", 300, "T-9", "补偿", "op1");
        assertFalse(r.pending());
        assertNotNull(r.entry());
        verify(creditService).creditAccount(eq("u1"), eq(300L),
                eq(LedgerEntry.LedgerEntryType.GIFT), eq("ops_compensation"), eq("T-9"), anyString());
    }

    @Test
    void largeCompensateGoesToApproval() {
        AdjustmentResult r = svc.compensate("u1", 6000, "T-9", "补偿", "op1");
        assertTrue(r.pending());
        assertNotNull(r.requestId());
        verify(creditService, never()).creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
        assertEquals(CreditAdjustmentRequest.Status.PENDING_APPROVAL, db.get(r.requestId()).getStatus());
    }

    @Test
    void largeGrantGoesToApprovalWithCampaign() {
        AdjustmentResult r = svc.grantGift("u1", 9000, "SPRING", "激励", "op1");
        assertTrue(r.pending());
        assertEquals("SPRING", db.get(r.requestId()).getCampaignId());
        verify(creditService, never()).creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void approveByDifferentCheckerExecutes() {
        AdjustmentResult r = svc.grantGift("u1", 9000, null, "激励", "op1");
        svc.approve(r.requestId(), "checker1");
        verify(creditService).creditAccount(eq("u1"), eq(9000L),
                eq(LedgerEntry.LedgerEntryType.GIFT), eq("ops_gift"), eq("u1"), anyString());
        assertEquals(CreditAdjustmentRequest.Status.APPROVED, db.get(r.requestId()).getStatus());
    }

    @Test
    void approveBySameMakerRejected() {
        AdjustmentResult r = svc.compensate("u1", 6000, "T", "补偿", "op1");
        assertThrows(BusinessException.class, () -> svc.approve(r.requestId(), "op1"));
        verify(creditService, never()).creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
        assertEquals(CreditAdjustmentRequest.Status.PENDING_APPROVAL, db.get(r.requestId()).getStatus());
    }

    @Test
    void rejectMarksRejectedAndDoesNotCredit() {
        AdjustmentResult r = svc.grantGift("u1", 9000, null, "激励", "op1");
        svc.reject(r.requestId(), "checker1", "不合理");
        assertEquals(CreditAdjustmentRequest.Status.REJECTED, db.get(r.requestId()).getStatus());
        verify(creditService, never()).creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void neverTouchesCashPlane() {
        svc.compensate("u1", 300, "T", "r", "op");
        svc.grantGift("u1", 100, null, "r", "op");
        verify(creditService, never()).creditAccount(anyString(), anyLong(),
                eq(LedgerEntry.LedgerEntryType.RECHARGE), anyString(), anyString(), anyString());
    }

    @Test
    void rejectsBlankReasonNonPositiveAndBlankTicket() {
        assertThrows(BusinessException.class, () -> svc.grantGift("u1", 100, null, "  ", "op"));
        assertThrows(BusinessException.class, () -> svc.grantGift("u1", 0, null, "r", "op"));
        assertThrows(BusinessException.class, () -> svc.compensate("u1", 100, "", "r", "op"));
        assertThrows(BusinessException.class, () -> svc.compensate("", 100, "T", "r", "op"));
    }

    // ── v2 §9.2 #5 per-actor 日限额 + #4 全量审计 ─────────────────────────────

    @Test
    void actorDailyLimitBlocksWhenExceeded() {
        // 该发起人近 24h 已累计 48000，本次 3000 → 51000 > 50000 上限 → 拒，不入账
        when(requestRepo.sumAmountByMakerSince(eq("op1"), any(), anyList())).thenReturn(48000L);
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.grantGift("u1", 3000, null, "激励", "op1"));
        assertEquals("ACTOR_DAILY_LIMIT", ex.getCode());
        verify(creditService, never()).creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void actorDailyLimitAllowsAtBoundary() {
        // 已 41000 + 本次 9000 = 50000，恰好等于上限 → 放行（> 才拒）。大额 → 进审批
        when(requestRepo.sumAmountByMakerSince(eq("op1"), any(), anyList())).thenReturn(41000L);
        AdjustmentResult r = svc.grantGift("u1", 9000, null, "激励", "op1");
        assertTrue(r.pending());
    }

    @Test
    void smallAdjustmentRecordedAsApprovedAuditRow() {
        AdjustmentResult r = svc.grantGift("u1", 100, "SPRING", "激励", "op1");
        assertFalse(r.pending());
        // 小额直发也落一条 APPROVED 审计单（计入日限额 + 可溯源）
        CreditAdjustmentRequest audit = db.values().stream()
                .filter(x -> x.getStatus() == CreditAdjustmentRequest.Status.APPROVED)
                .findFirst().orElse(null);
        assertNotNull(audit, "小额直发应落 APPROVED 审计单");
        assertEquals("op1", audit.getMakerId());
        assertNotNull(audit.getLedgerEntryId());
        assertEquals(100, audit.getAmount());
    }

    // ── §14 幂等：同工单不重复补偿 / 同活动同用户不重复发放 ──────────────────

    @Test
    void duplicateCompensateByIncidentRefRejected() {
        when(ledgerRepo.existsByReferenceTypeAndReferenceId("ops_compensation", "T-9")).thenReturn(true);
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.compensate("u1", 300, "T-9", "补偿", "op1"));
        assertEquals("DUPLICATE_INCIDENT", ex.getCode());
        verify(creditService, never()).creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void duplicateCampaignGrantSameUserRejected() {
        when(ledgerRepo.existsByReferenceTypeAndReferenceId("ops_gift_campaign:SPRING", "SPRING:u1")).thenReturn(true);
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.grantGift("u1", 100, "SPRING", "激励", "op1"));
        assertEquals("DUPLICATE_CAMPAIGN_GRANT", ex.getCode());
        verify(creditService, never()).creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void grantWithoutCampaignHasNoIdempotencyGuard() {
        // 无活动号的临时赠送：每次都是有意为之，不查幂等
        AdjustmentResult r = svc.grantGift("u1", 100, null, "临时奖励", "op1");
        assertFalse(r.pending());
        verify(ledgerRepo, never()).existsByReferenceTypeAndReferenceId(eq("ops_gift"), anyString());
    }

    @Test
    void dailyLimitCountsApprovedAndPendingStatuses() {
        svc.grantGift("u1", 100, null, "r", "op1");
        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<List<CreditAdjustmentRequest.Status>> cap =
                org.mockito.ArgumentCaptor.forClass(List.class);
        verify(requestRepo).sumAmountByMakerSince(eq("op1"), any(), cap.capture());
        assertTrue(cap.getValue().contains(CreditAdjustmentRequest.Status.APPROVED));
        assertTrue(cap.getValue().contains(CreditAdjustmentRequest.Status.PENDING_APPROVAL));
    }
}
