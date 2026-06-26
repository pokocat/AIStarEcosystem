package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.RechargeOrder;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.RechargeOrderRepository;
import com.aistareco.aep.repository.RechargePackageRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * RechargeService 入账核心 {@code settlePaidOrder}（v2 §4.3）。
 *
 * 验证「手工核准 / 在线回调 / 影子确认」共用的一条入账逻辑 + 条件 UPDATE 幂等闸：
 *  - 抢到结算权 → 主分录 RECHARGE（+ 可选赠送 GIFT）+ 回填 paidVia / channelPayNo / ledgerEntryId；
 *  - 重复回调（markPaid 返回 0）→ 幂等 no-op，不重复入账；
 *  - approveOrder 委托 settle，paidVia=manual + 审批人回填；非 PENDING 拒绝。
 */
class RechargeServiceTest {

    private static final String ORDER = "ro-1";
    private static final String USER = "u_owner";

    private RechargeOrderRepository orderRepo;
    private CreditService creditService;
    private RechargeService svc;
    private Map<String, RechargeOrder> db;

    @BeforeEach
    void setUp() {
        orderRepo = mock(RechargeOrderRepository.class);
        creditService = mock(CreditService.class);
        NotificationPublisher notifications = mock(NotificationPublisher.class);
        RechargePackageRepository pkgRepo = mock(RechargePackageRepository.class);
        AepUserRepository userRepo = mock(AepUserRepository.class);
        StudioRepository studioRepo = mock(StudioRepository.class);
        svc = new RechargeService(pkgRepo, orderRepo, userRepo, studioRepo, creditService, notifications);

        db = new HashMap<>();
        when(orderRepo.findById(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(db.get(inv.getArgument(0, String.class))));
        when(orderRepo.save(any())).thenAnswer(inv -> {
            RechargeOrder o = inv.getArgument(0);
            db.put(o.getId(), o);
            return o;
        });
        when(creditService.creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString()))
                .thenAnswer(inv -> ledger());
    }

    private RechargeOrder pending(long credits, long bonus) {
        RechargeOrder o = RechargeOrder.builder()
                .id(ORDER).userId(USER).packageId("pkg-1").packageTag("标准包")
                .credits(credits).bonusCredits(bonus).priceCents(9900)
                .status(RechargeOrder.Status.PENDING)
                .createdAt(Instant.now()).build();
        db.put(o.getId(), o);
        return o;
    }

    private static LedgerEntryDto ledger() {
        return new LedgerEntryDto("le_main", "w1", USER, null, null,
                "recharge", 1000, 1000, "d", "recharge_order", ORDER, Instant.now());
    }

    @Test
    void settleCreditsMainAndBonusThenBackfills() {
        pending(1000, 200);
        when(orderRepo.markPaid(eq(ORDER), any(Instant.class))).thenReturn(1);

        RechargeOrderDto dto = svc.settlePaidOrder(ORDER, "shadow", "CH-1", null, null);
        assertNotNull(dto);

        verify(creditService).creditAccount(eq(USER), eq(1000L),
                eq(LedgerEntry.LedgerEntryType.RECHARGE), eq("recharge_order"), eq(ORDER), anyString());
        verify(creditService).creditAccount(eq(USER), eq(200L),
                eq(LedgerEntry.LedgerEntryType.GIFT), eq("recharge_order_bonus"), eq(ORDER), anyString());

        RechargeOrder saved = db.get(ORDER);
        assertEquals("shadow", saved.getPaidVia());
        assertEquals("CH-1", saved.getChannelPayNo());
        assertEquals("le_main", saved.getLedgerEntryId());
    }

    @Test
    void doubleSettleCreditsOnlyOnce() {
        pending(1000, 0); // 无赠送 → 恰好 1 次 creditAccount/结算
        when(orderRepo.markPaid(eq(ORDER), any(Instant.class))).thenReturn(1).thenReturn(0);

        svc.settlePaidOrder(ORDER, "shadow", null, null, null);
        svc.settlePaidOrder(ORDER, "shadow", null, null, null); // 重复回调

        verify(creditService, times(1))
                .creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void approveDelegatesToSettleAsManual() {
        pending(1000, 0);
        when(orderRepo.markPaid(eq(ORDER), any(Instant.class))).thenReturn(1);

        svc.approveOrder(ORDER, "admin-1", "线下已收款");

        RechargeOrder saved = db.get(ORDER);
        assertEquals("manual", saved.getPaidVia());
        assertEquals("admin-1", saved.getReviewerId());
        verify(creditService).creditAccount(eq(USER), eq(1000L),
                eq(LedgerEntry.LedgerEntryType.RECHARGE), anyString(), eq(ORDER), anyString());
    }

    @Test
    void approveOnNonPendingRejectsAndDoesNotCredit() {
        RechargeOrder o = pending(1000, 0);
        o.setStatus(RechargeOrder.Status.PAID);

        assertThrows(BusinessException.class, () -> svc.approveOrder(ORDER, "admin-1", "ok"));
        verify(creditService, never())
                .creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
    }
}
