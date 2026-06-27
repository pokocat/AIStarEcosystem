package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.RechargeOrder;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.RechargeOrderRepository;
import com.aistareco.aep.model.RechargePackage;
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
    private RechargePackageRepository pkgRepo;

    @BeforeEach
    void setUp() {
        orderRepo = mock(RechargeOrderRepository.class);
        creditService = mock(CreditService.class);
        NotificationPublisher notifications = mock(NotificationPublisher.class);
        pkgRepo = mock(RechargePackageRepository.class);
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
        // 模拟 markRefunded 条件 UPDATE：PAID → REFUNDED 返 1（并原子改状态），否则 0（防双退）
        when(orderRepo.markRefunded(anyString(), any())).thenAnswer(inv -> {
            RechargeOrder o = db.get(inv.getArgument(0, String.class));
            if (o != null && o.getStatus() == RechargeOrder.Status.PAID) {
                o.setStatus(RechargeOrder.Status.REFUNDED);
                return 1;
            }
            return 0;
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

    // ── v2 §15.5 / D17 退款回收 ──────────────────────────────────────────────

    @Test
    void refundPaidOrderReclaimsAndMarksRefunded() {
        RechargeOrder o = pending(1000, 0);
        o.setStatus(RechargeOrder.Status.PAID);
        // 回收 clamp 到 700（未消费部分），返回负 REFUND_CASH 分录
        when(creditService.refundCashReclaim(eq(USER), eq(1000L), eq(ORDER), anyString()))
                .thenReturn(new LedgerEntryDto("le_refund", "w1", USER, null, null,
                        "refund_cash", -700, 300, "d", "refund_cash", ORDER, Instant.now()));

        RechargeOrderDto dto = svc.refundOrder(ORDER, "fin-1", "客户申请退款");
        assertEquals("refunded", dto.status());

        RechargeOrder saved = db.get(ORDER);
        assertEquals(RechargeOrder.Status.REFUNDED, saved.getStatus());
        assertEquals("le_refund", saved.getRefundLedgerEntryId());
        assertEquals(700, saved.getRefundedCredits());
        assertEquals("fin-1", saved.getReviewerId());
        assertNotNull(saved.getRefundedAt());
        verify(creditService).refundCashReclaim(eq(USER), eq(1000L), eq(ORDER), anyString());
    }

    @Test
    void refundNonPaidRejectedAndDoesNotReclaim() {
        pending(1000, 0); // PENDING
        assertThrows(BusinessException.class, () -> svc.refundOrder(ORDER, "fin-1", "x"));
        verify(creditService, never()).refundCashReclaim(anyString(), anyLong(), anyString(), anyString());
    }

    @Test
    void refundBlankReasonRejected() {
        RechargeOrder o = pending(1000, 0);
        o.setStatus(RechargeOrder.Status.PAID);
        assertThrows(BusinessException.class, () -> svc.refundOrder(ORDER, "fin-1", "  "));
        verify(creditService, never()).refundCashReclaim(anyString(), anyLong(), anyString(), anyString());
    }

    /** 评审 H2：并发 / 重复退款只有一个抢到（markRefunded 幂等闸），第二次不再二次回收。 */
    @Test
    void refundDoubleClaimSecondRejectedNoSecondReclaim() {
        RechargeOrder o = pending(1000, 0);
        o.setStatus(RechargeOrder.Status.PAID);
        when(creditService.refundCashReclaim(eq(USER), eq(1000L), eq(ORDER), anyString()))
                .thenReturn(new LedgerEntryDto("le_refund", "w1", USER, null, null,
                        "refund_cash", -1000, 0, "d", "refund_cash", ORDER, Instant.now()));

        svc.refundOrder(ORDER, "fin-1", "首次退款"); // 抢到 → REFUNDED
        assertThrows(BusinessException.class, () -> svc.refundOrder(ORDER, "fin-2", "重复退款")); // 第二次抢 0

        verify(creditService, times(1)).refundCashReclaim(anyString(), anyLong(), anyString(), anyString());
    }

    // ── v2 §6：套餐按子应用归属 ──────────────────────────────────────────────

    private static RechargePackage pkg(String appScope) {
        return RechargePackage.builder()
                .id("pkg-x").credits(1000).priceCents(29900).tag("标准包")
                .bonusCredits(100).active(true).appScope(appScope).build();
    }

    @Test
    void checkoutRejectsPackageNotForApp() {
        when(pkgRepo.findById("pkg-x")).thenReturn(Optional.of(pkg("celebrity")));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.createPendingForCheckout(USER, "pkg-x", "ALI_PC", "drama"));
        assertEquals("PACKAGE_NOT_FOR_APP", ex.getCode());
    }

    @Test
    void checkoutAllowsPackageForMatchingApp() {
        when(pkgRepo.findById("pkg-x")).thenReturn(Optional.of(pkg("celebrity")));
        RechargeOrder o = svc.createPendingForCheckout(USER, "pkg-x", "ALI_PC", "celebrity");
        assertNotNull(o);
        assertEquals("pkg-x", o.getPackageId());
    }

    @Test
    void checkoutAllowsGlobalPackageForAnyApp() {
        when(pkgRepo.findById("pkg-x")).thenReturn(Optional.of(pkg("all")));
        assertNotNull(svc.createPendingForCheckout(USER, "pkg-x", "ALI_PC", "drama"));
        // null appScope 也视为通用
        when(pkgRepo.findById("pkg-y")).thenReturn(Optional.of(pkg(null)));
        assertNotNull(svc.createPendingForCheckout(USER, "pkg-y", "ALI_PC", "music"));
    }

    @Test
    void listPackagesFiltersByAppWhenSourceAppGiven() {
        when(pkgRepo.findActiveForApp("drama")).thenReturn(java.util.List.of(pkg("drama")));
        svc.listPackages("drama");
        verify(pkgRepo).findActiveForApp("drama");
        verify(pkgRepo, never()).findByActiveTrueOrderBySortOrderAscCreditsAsc();
    }

    // ── v2 §6 幂等下单（防重复支付）──────────────────────────────────────────

    @Test
    void checkoutReusesRecentPendingOrderForSamePackage() {
        when(pkgRepo.findById("pkg-x")).thenReturn(Optional.of(pkg("all")));
        RechargeOrder existing = RechargeOrder.builder()
                .id("ro-existing").userId(USER).packageId("pkg-x")
                .status(RechargeOrder.Status.PENDING).createdAt(Instant.now()).build();
        when(orderRepo.findFirstByUserIdAndPackageIdOrderByCreatedAtDesc(USER, "pkg-x"))
                .thenReturn(Optional.of(existing));

        RechargeOrder o = svc.createOrReuseCheckoutOrder(USER, "pkg-x", "ALI_PC", "celebrity");

        assertEquals("ro-existing", o.getId()); // 复用,不新建
    }

    @Test
    void checkoutCreatesNewWhenNoReusablePending() {
        when(pkgRepo.findById("pkg-x")).thenReturn(Optional.of(pkg("all")));
        when(orderRepo.findFirstByUserIdAndPackageIdOrderByCreatedAtDesc(USER, "pkg-x"))
                .thenReturn(Optional.empty());

        RechargeOrder o = svc.createOrReuseCheckoutOrder(USER, "pkg-x", "ALI_PC", "celebrity");

        assertNotEquals("ro-existing", o.getId());
        assertTrue(o.getId().startsWith("ro-"));
        assertEquals(RechargeOrder.Status.PENDING, o.getStatus());
    }

    @Test
    void checkoutDoesNotReusePaidOrder() {
        when(pkgRepo.findById("pkg-x")).thenReturn(Optional.of(pkg("all")));
        RechargeOrder paid = RechargeOrder.builder()
                .id("ro-paid").userId(USER).packageId("pkg-x")
                .status(RechargeOrder.Status.PAID).createdAt(Instant.now()).build();
        when(orderRepo.findFirstByUserIdAndPackageIdOrderByCreatedAtDesc(USER, "pkg-x"))
                .thenReturn(Optional.of(paid));

        RechargeOrder o = svc.createOrReuseCheckoutOrder(USER, "pkg-x", "ALI_PC", "celebrity");

        assertNotEquals("ro-paid", o.getId()); // 已支付单不复用,建新单
    }

    @Test
    void approveOnlineOrderBlockedNoFakeCredit() {
        RechargeOrder online = RechargeOrder.builder()
                .id("ro-online").userId(USER).packageId("pkg-1").credits(1000).priceCents(9900)
                .status(RechargeOrder.Status.PENDING).wayCode("ALI_PC").createdAt(Instant.now()).build();
        db.put("ro-online", online);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.approveOrder("ro-online", "fin-1", null));

        assertEquals("ONLINE_ORDER_NO_MANUAL_APPROVE", ex.getCode());
        verify(creditService, never())
                .creditAccount(anyString(), anyLong(), any(), anyString(), anyString(), anyString());
    }
}
