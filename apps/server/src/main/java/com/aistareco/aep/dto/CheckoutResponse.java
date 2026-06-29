package com.aistareco.aep.dto;

/**
 * 充值 checkout 响应（v2 §4.1 / §6.7）。
 *
 * @param orderId     RechargeOrder.id（前端轮询订单状态用）
 * @param payDataType payData 形态：shadow / wxapp / payurl …
 * @param payData     前端拉起支付所需数据（影子 = 商户订单号；WX_LITE = wx 参数）
 */
public record CheckoutResponse(
        String orderId,
        String payDataType,
        String payData
) {}
