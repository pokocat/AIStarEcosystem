package com.aistareco.aep.service.payment;

/**
 * 查单结果（v2 §6.4，对账 / 兜底用）。
 *
 * @param found        网关侧是否存在该订单
 * @param paid         是否已支付成功
 * @param payOrderId   支付网关订单号
 * @param amountCents  已支付金额（分），未支付为 0
 * @param channelPayNo 渠道（微信/支付宝）订单号，可空
 */
public record PayQueryResult(
        boolean found,
        boolean paid,
        String payOrderId,
        long amountCents,
        String channelPayNo
) {}
