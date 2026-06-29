package com.aistareco.aep.controller;

import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.aep.service.payment.AlipayPaymentGateway;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.*;

/**
 * {@link AlipayNotifyController}：RSA2 验签后的入账判定（验签 / 金额 / 状态 / 幂等 / 安全）。
 * 验签的 SDK 调用收口在 {@link AlipayPaymentGateway#verifyNotify}（mock 之）；只测我方判定逻辑。
 */
class AlipayNotifyControllerTest {

    private static final String ORDER = "ro-alipay-1";
    private final RechargeService rechargeService = mock(RechargeService.class);
    private final AlipayPaymentGateway gateway = mock(AlipayPaymentGateway.class);
    private final AlipayNotifyController controller = new AlipayNotifyController(rechargeService, gateway);

    /** priceCents=9900 的订单 DTO（仅 priceCents 被控制器用到）。 */
    private static RechargeOrderDto order(long priceCents) {
        return new RechargeOrderDto(ORDER, "u1", null, null, null, null, "pkg", "标准包",
                1000, 0, priceCents, "pending", null, null, null,
                null, null, null,                   // createdAt / updatedAt / reviewedAt
                null, null, null, null, null, null, // 在线支付字段
                null, null, null);                  // refund 字段
    }

    private static Map<String, String> notifyParams(String tradeStatus, String totalAmount) {
        Map<String, String> p = new HashMap<>();
        p.put("out_trade_no", ORDER);
        p.put("trade_no", "2024-ALIPAY-TRADE");
        p.put("trade_status", tradeStatus);
        p.put("total_amount", totalAmount);
        p.put("app_id", "2021000000000000");
        p.put("sign", "fakesign");
        return p;
    }

    /** mock 验签结果后调用控制器。 */
    private String invoke(Map<String, String> params, boolean signValid) {
        when(gateway.verifyNotify(anyMap())).thenReturn(signValid);
        return controller.alipayNotify(params);
    }

    @Test
    void validSuccessNotifySettlesAndReturnsSuccess() {
        when(rechargeService.getOrder(ORDER)).thenReturn(order(9900));
        String r = invoke(notifyParams("TRADE_SUCCESS", "99.00"), true);
        assertEquals("success", r);
        verify(rechargeService).settlePaidOrder(ORDER, "alipay", "2024-ALIPAY-TRADE", null, null);
    }

    @Test
    void badSignReturnsFailAndDoesNotSettle() {
        when(rechargeService.getOrder(ORDER)).thenReturn(order(9900));
        String r = invoke(notifyParams("TRADE_SUCCESS", "99.00"), false);
        assertEquals("fail", r);
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }

    @Test
    void amountMismatchReturnsFailAndDoesNotSettle() {
        when(rechargeService.getOrder(ORDER)).thenReturn(order(9900));
        String r = invoke(notifyParams("TRADE_SUCCESS", "1.00"), true); // 100 分 ≠ 9900
        assertEquals("fail", r);
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }

    @Test
    void nonSuccessStatusReturnsSuccessWithoutSettle() {
        when(rechargeService.getOrder(ORDER)).thenReturn(order(9900));
        String r = invoke(notifyParams("WAIT_BUYER_PAY", "99.00"), true);
        assertEquals("success", r); // 止重投但不入账
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }

    @Test
    void unknownOrderReturnsSuccessToStopRetries() {
        when(gateway.verifyNotify(anyMap())).thenReturn(true);
        when(rechargeService.getOrder(ORDER))
                .thenThrow(new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));
        String r = controller.alipayNotify(notifyParams("TRADE_SUCCESS", "99.00"));
        assertEquals("success", r);
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }
}
