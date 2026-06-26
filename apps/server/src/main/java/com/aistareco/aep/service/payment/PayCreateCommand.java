package com.aistareco.aep.service.payment;

/**
 * 统一下单入参（v2 §6.4）。
 *
 * @param mchOrderNo 商户订单号（= RechargeOrder.id），幂等锚点
 * @param amountCents 金额（分）
 * @param wayCode    支付方式（WX_LITE / WX_NATIVE / ALI_QR / SHADOW…）
 * @param subject    订单标题
 * @param openid     微信小程序 openid（WX_LITE 必填；其余可空）
 * @param clientIp   下单客户端 IP（部分渠道必填；可空）
 */
public record PayCreateCommand(
        String mchOrderNo,
        long amountCents,
        String wayCode,
        String subject,
        String openid,
        String clientIp
) {}
