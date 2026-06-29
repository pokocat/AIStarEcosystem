package com.aistareco.aep.service;

import com.aistareco.aep.dto.CheckoutResponse;
import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.model.RechargeOrder;
import com.aistareco.aep.service.payment.PayCreateCommand;
import com.aistareco.aep.service.payment.PayCreateResult;
import com.aistareco.aep.service.payment.PayQueryResult;
import com.aistareco.aep.service.payment.PaymentGateway;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
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
        svc = new PaymentService(rechargeService, gateway, new com.aistareco.aep.service.payment.PaymentProperties());
    }

    private static RechargeOrder order(String id) {
        return RechargeOrder.builder()
                .id(id).userId("u1").priceCents(9900)
                .status(RechargeOrder.Status.PENDING).createdAt(Instant.now()).build();
    }

    @Test
    void checkoutCreatesOrderCallsGatewayThenAttaches() {
        when(rechargeService.createOrReuseCheckoutOrder("u1", "pkg-1", "SHADOW", "celebrity"))
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
        when(rechargeService.createOrReuseCheckoutOrder(anyString(), anyString(), anyString(), any()))
                .thenReturn(order("ro-y"));
        when(gateway.createPayOrder(any())).thenThrow(new RuntimeException("boom"));

        assertThrows(BusinessException.class,
                () -> svc.checkout("u1", "pkg-1", "SHADOW", null, null, null));

        verify(rechargeService).cancelForGatewayError(eq("ro-y"), anyString());
        verify(rechargeService, never()).attachPayOrder(anyString(), anyString());
    }

    // ── v2 §6 syncOrder（收银台查单）──────────────────────────────────────────

    @Test
    void syncOrderSettlesWhenGatewayPaid() {
        when(gateway.driverName()).thenReturn("alipay");
        RechargeOrder o = order("ro-p");
        o.setPayOrderId("alipay_ro-p");
        when(rechargeService.getOrderForUser("u1", "ro-p")).thenReturn(RechargeOrderDto.from(o));
        when(gateway.queryPayOrder("ro-p")).thenReturn(new PayQueryResult(true, true, "alipay_ro-p", 9900L, "trade-123"));

        svc.syncOrder("u1", "ro-p");

        verify(rechargeService).settlePaidOrder("ro-p", "alipay", "trade-123", null, null);
    }

    @Test
    void syncOrderClosesWhenOverTtlAndUnpaid() {
        when(gateway.driverName()).thenReturn("alipay");
        RechargeOrder o = order("ro-old");
        o.setPayOrderId("alipay_ro-old");
        o.setCreatedAt(Instant.now().minus(Duration.ofMinutes(60))); // 超 TTL
        when(rechargeService.getOrderForUser("u1", "ro-old")).thenReturn(RechargeOrderDto.from(o));
        when(rechargeService.pendingTtlMinutes()).thenReturn(30L);
        when(gateway.queryPayOrder("ro-old")).thenReturn(new PayQueryResult(false, false, "alipay_ro-old", 0L, null));

        svc.syncOrder("u1", "ro-old");

        verify(rechargeService).closeOrder("ro-old", "支付超时自动关闭");
        verify(rechargeService, never()).settlePaidOrder(anyString(), anyString(), any(), any(), any());
    }

    @Test
    void syncOrderTerminalReturnsAsIsNoGatewayCall() {
        RechargeOrder o = order("ro-done");
        o.setStatus(RechargeOrder.Status.PAID);
        when(rechargeService.getOrderForUser("u1", "ro-done")).thenReturn(RechargeOrderDto.from(o));

        svc.syncOrder("u1", "ro-done");

        verify(gateway, never()).queryPayOrder(anyString());
        verify(rechargeService, never()).settlePaidOrder(anyString(), anyString(), any(), any(), any());
        verify(rechargeService, never()).closeOrder(anyString(), anyString());
    }
}
