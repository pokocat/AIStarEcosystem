package com.aistareco.aep.controller;

import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.aep.service.payment.JeepaySignUtil;
import com.aistareco.aep.service.payment.PaymentProperties;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Jeepay 异步回调（v2 §6.4 触点②）：验签 / 金额校验 / 状态路由 / 复用幂等 settle。
 */
class PayNotifyControllerTest {

    private static final String API_KEY = "secret";
    private static final String ORDER = "ro-1";

    private RechargeService rechargeService;
    private PayNotifyController controller;

    @BeforeEach
    void setUp() {
        rechargeService = mock(RechargeService.class);
        PaymentProperties props = new PaymentProperties();
        props.getJeepay().setApiKey(API_KEY);
        controller = new PayNotifyController(rechargeService, props);
        when(rechargeService.getOrder(ORDER)).thenReturn(order(9900));
    }

    private static RechargeOrderDto order(long priceCents) {
        return new RechargeOrderDto(ORDER, "u1", null, null, null, "pkg", "标准包",
                1000, 0, priceCents, "pending", null, null, null,
                null, null, null,                   // createdAt / updatedAt / reviewedAt
                null, null, null, null, null, null, // v2 §6 在线支付：paidVia/channelPayNo/wayCode/payOrderId/paidAt/sourceApp
                null, null, null);                  // refundedAt / refundedCredits / refundLedgerEntryId
    }

    /** 带 sign 的成功回调 → 验签通过 + 金额匹配 → settle + 返回 success。 */
    private Map<String, Object> signedNotify(int state, long amount) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("mchOrderNo", ORDER);
        p.put("payOrderId", "P123");
        p.put("state", state);
        p.put("amount", amount);
        p.put("channelOrderNo", "WX-9");
        p.put("sign", JeepaySignUtil.sign(p, API_KEY));
        return p;
    }

    @Test
    void validSuccessNotifySettles() {
        String r = controller.jeepayNotify(signedNotify(2, 9900));
        assertEquals("success", r);
        verify(rechargeService).settlePaidOrder(eq(ORDER), eq("jeepay"), eq("WX-9"), isNull(), isNull());
    }

    @Test
    void badSignRejectedNoSettle() {
        Map<String, Object> p = signedNotify(2, 9900);
        p.put("sign", "DEADBEEF"); // 篡改签名
        String r = controller.jeepayNotify(p);
        assertEquals("fail", r);
        verify(rechargeService, never()).settlePaidOrder(anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    void amountMismatchRejectedNoSettle() {
        // 验签通过但金额与订单不符 → 拒绝入账（绝不按渠道金额入账）
        String r = controller.jeepayNotify(signedNotify(2, 1));
        assertEquals("fail", r);
        verify(rechargeService, never()).settlePaidOrder(anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    void nonSuccessStateNoSettleButStopsRetry() {
        String r = controller.jeepayNotify(signedNotify(1, 9900)); // state=1 非成功
        assertEquals("success", r); // 返回 success 止重投
        verify(rechargeService, never()).settlePaidOrder(anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    void orderNotFoundReturnsSuccessNoSettle() {
        when(rechargeService.getOrder(ORDER))
                .thenThrow(new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "不存在"));
        String r = controller.jeepayNotify(signedNotify(2, 9900));
        assertEquals("success", r); // 止重投
        verify(rechargeService, never()).settlePaidOrder(anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    void emptyBodyRejected() {
        assertEquals("fail", controller.jeepayNotify(null));
        assertEquals("fail", controller.jeepayNotify(Map.of()));
    }
}
