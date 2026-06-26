package com.aistareco.aep.service.payment;

/**
 * 统一下单结果（v2 §6.4）。
 *
 * @param payOrderId  支付网关订单号（落 RechargeOrder.payOrderId，幂等 + 对账）
 * @param payDataType payData 形态：shadow / wxapp / payurl / none …
 * @param payData     前端拉起支付所需数据（影子链路 = 商户订单号；WX_LITE = wx 支付参数 JSON）
 */
public record PayCreateResult(
        String payOrderId,
        String payDataType,
        String payData
) {}
