package com.aistareco.aep.service;

import com.aistareco.aep.dto.CheckoutResponse;
import com.aistareco.aep.model.RechargeOrder;
import com.aistareco.aep.service.payment.PayCreateCommand;
import com.aistareco.aep.service.payment.PayCreateResult;
import com.aistareco.aep.service.payment.PaymentGateway;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * PaymentService.checkout 编排（v2 §4.1 / §6.7）：
 * 建 PENDING → 网关下单 → 回填 payOrderId → 返回 payData；网关异常 → 取消 + 抛 PAYMENT_GATEWAY_ERROR。
 */
class PaymentServiceTest {

    private RechargeService rechargeService;
    private PaymentGateway gateway;
    private PaymentService svc;

    @BeforeEach
    void setUp() {
        rechargeService = mock(RechargeService.class);
        gateway = mock(PaymentGateway.class);
        when(gateway.driverName()).thenReturn("shadow");
        svc = new PaymentService(rechargeService, gateway);
    }

    private static RechargeOrder order(String id) {
        return RechargeOrder.builder()
                .id(id).userId("u1").priceCents(9900)
                .status(RechargeOrder.Status.PENDING).createdAt(Instant.now()).build();
    }

    @Test
    void checkoutCreatesOrderCallsGatewayThenAttaches() {
        when(rechargeService.createPendingForCheckout("u1", "pkg-1", "SHADOW", "celebrity"))
                .thenReturn(order("ro-x"));
        when(gateway.createPayOrder(any()))
                .thenReturn(new PayCreateResult("shadow_ro-x", "shadow", "ro-x"));

        // wayCode null → driver=shadow 默认 SHADOW
        CheckoutResponse res = svc.checkout("u1", "pkg-1", null, null, null, "celebrity");

        assertEquals("ro-x", res.orderId());
        assertEquals("shadow", res.payDataType());
        assertEquals("ro-x", res.payData());
        verify(rechargeService).attachPayOrder("ro-x", "shadow_ro-x");

        ArgumentCaptor<PayCreateCommand> cap = ArgumentCaptor.forClass(PayCreateCommand.class);
        verify(gateway).createPayOrder(cap.capture());
        assertEquals(9900L, cap.getValue().amountCents());
        assertEquals("SHADOW", cap.getValue().wayCode());
        assertEquals("ro-x", cap.getValue().mchOrderNo());
    }

    @Test
    void gatewayErrorCancelsOrderAndThrows() {
        when(rechargeService.createPendingForCheckout(anyString(), anyString(), anyString(), any()))
                .thenReturn(order("ro-y"));
        when(gateway.createPayOrder(any())).thenThrow(new RuntimeException("boom"));

        assertThrows(BusinessException.class,
                () -> svc.checkout("u1", "pkg-1", "SHADOW", null, null, null));

        verify(rechargeService).cancelForGatewayError(eq("ro-y"), anyString());
        verify(rechargeService, never()).attachPayOrder(anyString(), anyString());
    }
}
