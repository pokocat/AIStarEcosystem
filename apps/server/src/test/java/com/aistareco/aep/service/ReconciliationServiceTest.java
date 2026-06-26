package com.aistareco.aep.service;

import com.aistareco.aep.dto.ReconciliationReportDto;
import com.aistareco.aep.model.LedgerEntry.LedgerEntryType;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.RechargeOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 对账重算（v2 §11）：现金勾稽 + drift 告警 + 影子剔除 + 积分负债单列。
 */
class ReconciliationServiceTest {

    private LedgerEntryRepository ledgerRepo;
    private RechargeOrderRepository orderRepo;
    private ReconciliationService svc;

    @BeforeEach
    void setUp() {
        ledgerRepo = mock(LedgerEntryRepository.class);
        orderRepo = mock(RechargeOrderRepository.class);
        svc = new ReconciliationService(ledgerRepo, orderRepo);
        // 默认全 0
        when(ledgerRepo.sumAmountByType(any())).thenReturn(0L);
        when(orderRepo.sumCreditsByStatusesExcludingPaidVia(anyList(), anyString())).thenReturn(0L);
        when(orderRepo.sumCreditsByStatusesAndPaidVia(anyList(), anyString())).thenReturn(0L);
        when(orderRepo.sumRefundedCreditsExcludingPaidVia(anyString())).thenReturn(0L);
    }

    @Test
    void balancedWhenOrdersMatchLedger() {
        when(orderRepo.sumCreditsByStatusesExcludingPaidVia(anyList(), eq("shadow"))).thenReturn(1000L);
        when(ledgerRepo.sumAmountByType(LedgerEntryType.RECHARGE)).thenReturn(1000L);

        ReconciliationReportDto r = svc.compute();
        assertEquals(1000, r.grossRecharge());
        assertEquals(1000, r.ledgerRechargeNonShadow());
        assertEquals(0, r.drift());
        assertTrue(r.balanced());
        assertEquals(1000, r.netCashCredits());
    }

    @Test
    void netCashSubtractsRefundAndWithdraw() {
        when(orderRepo.sumCreditsByStatusesExcludingPaidVia(anyList(), eq("shadow"))).thenReturn(1000L);
        when(ledgerRepo.sumAmountByType(LedgerEntryType.RECHARGE)).thenReturn(1000L);
        when(orderRepo.sumRefundedCreditsExcludingPaidVia(anyString())).thenReturn(300L);
        when(ledgerRepo.sumAmountByType(LedgerEntryType.WITHDRAW)).thenReturn(-200L); // 账本为负

        ReconciliationReportDto r = svc.compute();
        assertEquals(300, r.refundedReclaimed());
        assertEquals(200, r.withdrawn());
        assertEquals(500, r.netCashCredits(), "1000 - 300 退款 - 200 提现");
        assertTrue(r.balanced());
    }

    @Test
    void driftFlaggedWhenLedgerDisagreesWithOrders() {
        when(orderRepo.sumCreditsByStatusesExcludingPaidVia(anyList(), eq("shadow"))).thenReturn(1000L);
        when(ledgerRepo.sumAmountByType(LedgerEntryType.RECHARGE)).thenReturn(900L); // 漏写一笔

        ReconciliationReportDto r = svc.compute();
        assertEquals(100, r.drift());
        assertFalse(r.balanced(), "drift≠0 必须报不平");
    }

    @Test
    void shadowExcludedFromCashReconciliation() {
        // 真实订单 1000 + 影子订单 500；账本 RECHARGE 总 1500
        when(orderRepo.sumCreditsByStatusesExcludingPaidVia(anyList(), eq("shadow"))).thenReturn(1000L);
        when(orderRepo.sumCreditsByStatusesAndPaidVia(anyList(), eq("shadow"))).thenReturn(500L);
        when(ledgerRepo.sumAmountByType(LedgerEntryType.RECHARGE)).thenReturn(1500L);

        ReconciliationReportDto r = svc.compute();
        assertEquals(500, r.shadowRecharge());
        assertEquals(1000, r.ledgerRechargeNonShadow(), "1500 账本 − 500 影子");
        assertEquals(0, r.drift());
        assertTrue(r.balanced());
    }

    @Test
    void creditLiabilitySumsGiftAdjustLicenseOnly() {
        when(ledgerRepo.sumAmountByType(LedgerEntryType.GIFT)).thenReturn(700L);
        when(ledgerRepo.sumAmountByType(LedgerEntryType.ADJUST)).thenReturn(-50L);
        when(ledgerRepo.sumAmountByType(LedgerEntryType.LICENSE_GRANT)).thenReturn(200L);

        ReconciliationReportDto r = svc.compute();
        assertEquals(700, r.giftIssued());
        assertEquals(-50, r.adjustNet());
        assertEquals(200, r.licenseGranted());
        assertEquals(850, r.creditLiability(), "gift + adjust + license");
    }
}
