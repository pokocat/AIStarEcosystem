package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * CreditOpsService（v2 §5 / §9 积分面）：客诉补偿 / 激励赠送。
 * 关键不变量：只走 GIFT 入账（落 giftBalance），结构上不碰资金面；强制原因 + 补偿强制工单。
 */
class CreditOpsServiceTest {

    private CreditService creditService;
    private CreditOpsService svc;

    @BeforeEach
    void setUp() {
        creditService = mock(CreditService.class);
        when(creditService.creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString()))
                .thenAnswer(inv -> new LedgerEntryDto("le_x", "w1", inv.getArgument(0, String.class),
                        null, null, "gift", inv.getArgument(1, Long.class), 0, "d",
                        inv.getArgument(4, String.class), inv.getArgument(3, String.class), Instant.now()));
        svc = new CreditOpsService(creditService);
    }

    @Test
    void compensateCreditsGiftWithTicketAndReason() {
        svc.compensate("u1", 300, "TICKET-9", "生成失败补偿", "admin-1");

        ArgumentCaptor<String> refType = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> refId = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> desc = ArgumentCaptor.forClass(String.class);
        verify(creditService).creditAccount(eq("u1"), eq(300L),
                eq(LedgerEntry.LedgerEntryType.GIFT), refType.capture(), refId.capture(), desc.capture());
        assertEquals("ops_compensation", refType.getValue());
        assertEquals("TICKET-9", refId.getValue());
        assertTrue(desc.getValue().contains("生成失败补偿"));
        assertTrue(desc.getValue().contains("TICKET-9"));
        assertTrue(desc.getValue().contains("admin-1"));
    }

    @Test
    void grantWithCampaignUsesCampaignRefType() {
        svc.grantGift("u1", 100, "SPRING2026", "拉新激励", "admin-1");
        verify(creditService).creditAccount(eq("u1"), eq(100L),
                eq(LedgerEntry.LedgerEntryType.GIFT), eq("ops_gift_campaign:SPRING2026"),
                eq("SPRING2026:u1"), anyString());
    }

    @Test
    void grantWithoutCampaignUsesPlainRefType() {
        svc.grantGift("u1", 50, null, "答谢", "admin-1");
        verify(creditService).creditAccount(eq("u1"), eq(50L),
                eq(LedgerEntry.LedgerEntryType.GIFT), eq("ops_gift"), eq("u1"), anyString());
    }

    @Test
    void neverTouchesCashPlane() {
        svc.compensate("u1", 300, "T1", "r", "op");
        svc.grantGift("u1", 100, null, "r", "op");
        // 永远只 GIFT，绝不 RECHARGE / INCOME / 其它资金面类型
        verify(creditService, never()).creditAccount(anyString(), anyLong(),
                eq(LedgerEntry.LedgerEntryType.RECHARGE), anyString(), anyString(), anyString());
        verify(creditService, times(2)).creditAccount(anyString(), anyLong(),
                eq(LedgerEntry.LedgerEntryType.GIFT), anyString(), anyString(), anyString());
    }

    @Test
    void rejectsBlankReasonAndNonPositiveAndBlankTicket() {
        assertThrows(BusinessException.class, () -> svc.grantGift("u1", 100, null, "  ", "op"));
        assertThrows(BusinessException.class, () -> svc.grantGift("u1", 0, null, "r", "op"));
        assertThrows(BusinessException.class, () -> svc.compensate("u1", 100, "", "r", "op"));
        assertThrows(BusinessException.class, () -> svc.compensate("", 100, "T", "r", "op"));
        verify(creditService, never()).creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
    }
}
