package com.aistareco.aep.service.payment;

import com.aistareco.aep.model.RechargeOrder;
import com.aistareco.aep.repository.RechargeOrderRepository;
import com.aistareco.aep.service.RechargeService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * 查单兜底 {@link PaymentReconcileService}（v0.94 多渠道）：扫 PENDING 在线订单 → 按 wayCode 推导渠道
 * → 查对应网关 → 已支付则幂等结算。影子单（wayCode=SHADOW）跳过。
 */
class PaymentReconcileServiceTest {

    private final RechargeOrderRepository orderRepo = mock(RechargeOrderRepository.class);
    private final PaymentGatewayRegistry registry = mock(PaymentGatewayRegistry.class);
    private final PaymentGateway alipay = mock(PaymentGateway.class);
    private final RechargeService rechargeService = mock(RechargeService.class);
    private final PaymentReconcileService svc = new PaymentReconcileService(orderRepo, registry, rechargeService);

    private static RechargeOrder order(String id, String wayCode, String payOrderId, long ageSeconds) {
        return RechargeOrder.builder()
                .id(id).userId("u1").priceCents(9900)
                .wayCode(wayCode)
                .payOrderId(payOrderId)
                .status(RechargeOrder.Status.PENDING)
                .createdAt(Instant.now().minusSeconds(ageSeconds))
                .build();
    }

    @Test
    void shadowOrderIsSkipped() {
        when(orderRepo.findByStatusOrderByCreatedAtDesc(RechargeOrder.Status.PENDING))
                .thenReturn(List.of(order("ro-s", "SHADOW", "shadow_ro-s", 60)));
        assertEquals(0, svc.reconcilePending());
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }

    @Test
    void paidPendingOrderGetsSettledIdempotently() {
        when(registry.get("alipay")).thenReturn(alipay);
        when(orderRepo.findByStatusOrderByCreatedAtDesc(RechargeOrder.Status.PENDING))
                .thenReturn(List.of(order("ro-1", "ALI_PC", "alipay_ro-1", 60)));
        when(alipay.queryPayOrder("ro-1"))
                .thenReturn(new PayQueryResult(true, true, "alipay_ro-1", 9900, "2024-TRADE-1"));

        assertEquals(1, svc.reconcilePending());
        verify(rechargeService).settlePaidOrder("ro-1", "alipay", "2024-TRADE-1", null, null);
    }

    @Test
    void unpaidOrderIsNotSettled() {
        when(registry.get("alipay")).thenReturn(alipay);
        when(orderRepo.findByStatusOrderByCreatedAtDesc(RechargeOrder.Status.PENDING))
                .thenReturn(List.of(order("ro-2", "ALI_PC", "alipay_ro-2", 60)));
        when(alipay.queryPayOrder("ro-2"))
                .thenReturn(new PayQueryResult(true, false, "alipay_ro-2", 0, null));

        assertEquals(0, svc.reconcilePending());
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }

    @Test
    void tooNewOrderIsSkippedToLeaveNotifyWindow() {
        when(registry.get("alipay")).thenReturn(alipay);
        when(orderRepo.findByStatusOrderByCreatedAtDesc(RechargeOrder.Status.PENDING))
                .thenReturn(List.of(order("ro-3", "ALI_PC", "alipay_ro-3", 3))); // 3s < 10s 窗口

        assertEquals(0, svc.reconcilePending());
        verify(alipay, never()).queryPayOrder(any());
    }

    @Test
    void orderWithoutPayOrderIdIsSkipped() {
        when(orderRepo.findByStatusOrderByCreatedAtDesc(RechargeOrder.Status.PENDING))
                .thenReturn(List.of(order("ro-4", "ALI_PC", null, 60))); // 未走网关下单（纯线下）

        assertEquals(0, svc.reconcilePending());
        verify(registry, never()).get(eq("alipay"));
    }
}
