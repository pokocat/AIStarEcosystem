package com.aistareco.aep.service.payment;

/**
 * 支付网关抽象（v2 §6.3，照 CdnUploader 范式）。
 *
 * 实现按 {@code aep.payment.driver} 注入：
 *   - jeepay  → JeepayPaymentGateway（生产真实，P1 落地）
 *   - shadow  → {@link ShadowPaymentGateway}（dev/test/staging 影子链路，无外部依赖）
 *
 * §8.0：driver=jeepay 未配 / 调用失败时由上层抛带码错误（不入账、不建假单），
 * 绝不静默回退到 shadow —— shadow 只能由显式 driver=shadow 选中。
 */
public interface PaymentGateway {

    /** 统一下单：建支付网关订单，返回前端拉起支付所需的 payData。 */
    PayCreateResult createPayOrder(PayCreateCommand cmd);

    /** 查单（对账 / 兜底）：按商户订单号查支付网关侧订单态。 */
    PayQueryResult queryPayOrder(String mchOrderNo);

    /** 当前 driver 名（shadow / jeepay）。 */
    String driverName();
}
