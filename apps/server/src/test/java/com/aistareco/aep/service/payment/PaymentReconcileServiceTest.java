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
 * 查单兜底 {@link PaymentReconcileService}：driver 无关,验证「扫 PENDING 在线订单 → 查网关 → 已支付则幂等结算」。
 * 这是直连方案在「回调丢失 / 本地无公网」时仍能跑通沙箱全流程的关键。
 */
class PaymentReconcileServiceTest {

    private final RechargeOrderRepository orderRepo = mock(RechargeOrderRepository.class);
    private final PaymentGateway gateway = mock(PaymentGateway.class);
    private final RechargeService rechargeService = mock(RechargeService.class);
    private final PaymentReconcileService svc = new PaymentReconcileService(orderRepo, gateway, rechargeService);

    private static RechargeOrder order(String id, String payOrderId, long ageSeconds) {
        return RechargeOrder.builder()
                .id(id).userId("u1").priceCents(9900)
                .payOrderId(payOrderId)
                .status(RechargeOrder.Status.PENDING)
                .createdAt(Instant.now().minusSeconds(ageSeconds))
                .build();
    }

    @Test
    void shadowDriverSkipsReconcileEntirely() {
        when(gateway.driverName()).thenReturn("shadow");
        assertEquals(0, svc.reconcilePending());
        verify(orderRepo, never()).findByStatusOrderByCreatedAtDesc(any());
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }

    @Test
    void paidPendingOrderGetsSettledIdempotently() {
        when(gateway.driverName()).thenReturn("alipay");
        when(orderRepo.findByStatusOrderByCreatedAtDesc(RechargeOrder.Status.PENDING))
                .thenReturn(List.of(order("ro-1", "alipay_ro-1", 60)));
        when(gateway.queryPayOrder("ro-1"))
                .thenReturn(new PayQueryResult(true, true, "alipay_ro-1", 9900, "2024-TRADE-1"));

        assertEquals(1, svc.reconcilePending());
        verify(rechargeService).settlePaidOrder("ro-1", "alipay", "2024-TRADE-1", null, null);
    }

    @Test
    void unpaidOrderIsNotSettled() {
        when(gateway.driverName()).thenReturn("alipay");
        when(orderRepo.findByStatusOrderByCreatedAtDesc(RechargeOrder.Status.PENDING))
                .thenReturn(List.of(order("ro-2", "alipay_ro-2", 60)));
        when(gateway.queryPayOrder("ro-2"))
                .thenReturn(new PayQueryResult(true, false, "alipay_ro-2", 0, null));

        assertEquals(0, svc.reconcilePending());
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }

    @Test
    void tooNewOrderIsSkippedToLeaveNotifyWindow() {
        when(gateway.driverName()).thenReturn("alipay");
        when(orderRepo.findByStatusOrderByCreatedAtDesc(RechargeOrder.Status.PENDING))
                .thenReturn(List.of(order("ro-3", "alipay_ro-3", 3))); // 3s < 10s 窗口

        assertEquals(0, svc.reconcilePending());
        verify(gateway, never()).queryPayOrder(any());
    }

    @Test
    void orderWithoutPayOrderIdIsSkipped() {
        when(gateway.driverName()).thenReturn("alipay");
        when(orderRepo.findByStatusOrderByCreatedAtDesc(RechargeOrder.Status.PENDING))
                .thenReturn(List.of(order("ro-4", null, 60))); // 未走网关下单（纯线下）

        assertEquals(0, svc.reconcilePending());
        verify(gateway, never()).queryPayOrder(eq("ro-4"));
    }
}
