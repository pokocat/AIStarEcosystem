package com.aistareco.aep.controller;

import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.aep.service.payment.WechatPaymentGateway;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * {@link WechatNotifyController}：V3 验签/解密后的入账判定（验签 / 金额 / 状态 / 幂等 / 安全）。
 * 验签解密 SDK 调用收口在 {@link WechatPaymentGateway#parseNotify}（mock 之）；只测我方判定逻辑。
 */
class WechatNotifyControllerTest {

    private static final String ORDER = "ro-wx-1";
    private final RechargeService rechargeService = mock(RechargeService.class);
    private final WechatPaymentGateway gateway = mock(WechatPaymentGateway.class);
    private final WechatNotifyController controller = new WechatNotifyController(rechargeService, gateway);

    private static RechargeOrderDto order(long priceCents) {
        return new RechargeOrderDto(ORDER, "u1", null, null, null, null, "pkg", "标准包",
                1000, 0, priceCents, "pending", null, null, null,
                null, null, null,                   // createdAt / updatedAt / reviewedAt
                null, null, null, null, null, null, // 在线支付字段
                null, null, null);                  // refund 字段
    }

    private void mockParse(WechatPaymentGateway.NotifyResult r) {
        when(gateway.parseNotify(any(), any(), any(), any(), any(), any())).thenReturn(r);
    }

    private ResponseEntity<Map<String, String>> invoke() {
        return controller.wechatNotify("serial", "sig", "ts", "nonce", "RSA", "{}");
    }

    @Test
    void validSuccessNotifySettlesAndReturnsSuccess() {
        when(rechargeService.getOrder(ORDER)).thenReturn(order(9900));
        mockParse(new WechatPaymentGateway.NotifyResult(true, ORDER, true, 9900, "WX-TRADE-1"));
        ResponseEntity<Map<String, String>> r = invoke();
        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertEquals("SUCCESS", r.getBody().get("code"));
        verify(rechargeService).settlePaidOrder(ORDER, "wechat", "WX-TRADE-1", null, null);
    }

    @Test
    void badSignReturnsFailAndDoesNotSettle() {
        mockParse(new WechatPaymentGateway.NotifyResult(false, null, false, 0, null));
        ResponseEntity<Map<String, String>> r = invoke();
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, r.getStatusCode());
        assertEquals("FAIL", r.getBody().get("code"));
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }

    @Test
    void amountMismatchReturnsFailAndDoesNotSettle() {
        when(rechargeService.getOrder(ORDER)).thenReturn(order(9900));
        mockParse(new WechatPaymentGateway.NotifyResult(true, ORDER, true, 100, "WX-TRADE-2"));
        ResponseEntity<Map<String, String>> r = invoke();
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, r.getStatusCode());
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }

    @Test
    void nonSuccessStatusReturnsSuccessWithoutSettle() {
        when(rechargeService.getOrder(ORDER)).thenReturn(order(9900));
        mockParse(new WechatPaymentGateway.NotifyResult(true, ORDER, false, 9900, null));
        ResponseEntity<Map<String, String>> r = invoke();
        assertEquals(HttpStatus.OK, r.getStatusCode());
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }

    @Test
    void unknownOrderReturnsSuccessToStopRetries() {
        mockParse(new WechatPaymentGateway.NotifyResult(true, ORDER, true, 9900, "WX-TRADE-3"));
        when(rechargeService.getOrder(ORDER))
                .thenThrow(new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));
        ResponseEntity<Map<String, String>> r = invoke();
        assertEquals(HttpStatus.OK, r.getStatusCode());
        verify(rechargeService, never()).settlePaidOrder(any(), any(), any(), any(), any());
    }
}
