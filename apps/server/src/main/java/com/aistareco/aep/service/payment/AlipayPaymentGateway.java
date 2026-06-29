package com.aistareco.aep.service.payment;

import com.aistareco.common.BusinessException;
import com.alipay.easysdk.factory.Factory;
import com.alipay.easysdk.kernel.Config;
import com.alipay.easysdk.kernel.util.ResponseChecker;
import com.alipay.easysdk.payment.common.models.AlipayTradeQueryResponse;
import com.alipay.easysdk.payment.facetoface.models.AlipayTradePrecreateResponse;
import com.alipay.easysdk.payment.page.models.AlipayTradePagePayResponse;
import com.alipay.easysdk.payment.wap.models.AlipayTradeWapPayResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 支付宝直连网关（v2 §6 · 直连官方 SDK；v0.94 改运行时配置）。
 *
 * 复杂的协议（RSA2 签名 / 验签 / 网关交互）全交给官方 {@code alipay-easysdk}；本类只做
 * 「wayCode → 对应支付产品 + payData 形态」的薄映射,以及把已验证的入账编排接上来。
 *
 * <h2>wayCode → payData</h2>
 * <ul>
 *   <li>{@code ALI_PC}（电脑网站）/ {@code ALI_WAP}（手机网站）→ {@code payDataType=page}, payData=自动提交 HTML 表单</li>
 *   <li>{@code ALI_QR}（当面付/扫码）→ {@code payDataType=qr}, payData=二维码内容串 → 前端渲染二维码</li>
 * </ul>
 *
 * <h2>v0.94 运行时配置</h2>
 * 凭据不再来自 env 固定 driver，而是 {@link PaymentChannelConfigService}（admin 后台 DB，可热更）。
 * {@code alipay-easysdk} 的 {@code Factory} 是全局静态：{@link #ensureConfigured()} 在每次调用前按
 * 配置版本号惰性重配（version 变化才 setOptions，避免每单重配）。§8.0：机密缺失 → 503，不静默回退。
 */
@Component
public class AlipayPaymentGateway implements PaymentGateway {

    private static final Logger log = LoggerFactory.getLogger(AlipayPaymentGateway.class);

    private final PaymentChannelConfigService channelConfig;
    /** 已应用到全局 Factory 的配置版本（-1 = 未配）。version 变化即重配。 */
    private volatile int appliedVersion = -1;

    public AlipayPaymentGateway(PaymentChannelConfigService channelConfig) {
        this.channelConfig = channelConfig;
    }

    @Override
    public boolean isConfigured() {
        return channelConfig.isConfigured("alipay");
    }

    /** 惰性配置全局 Factory：机密缺失抛 503；version 变化才重配（线程安全）。 */
    private synchronized Map<String, String> ensureConfigured() {
        Map<String, String> creds = channelConfig.credentials("alipay");
        requireText(creds.get("appId"), "appId");
        requireText(creds.get("merchantPrivateKey"), "merchantPrivateKey");
        requireText(creds.get("alipayPublicKey"), "alipayPublicKey");
        requireText(creds.get("notifyUrl"), "notifyUrl");
        requireText(creds.get("gatewayHost"), "gatewayHost");

        int current = channelConfig.version("alipay");
        if (current != appliedVersion) {
            Config c = new Config();
            c.protocol = orDefault(creds.get("protocol"), "https");
            c.gatewayHost = creds.get("gatewayHost");
            c.signType = orDefault(creds.get("signType"), "RSA2");
            c.appId = creds.get("appId");
            c.merchantPrivateKey = creds.get("merchantPrivateKey");
            c.alipayPublicKey = creds.get("alipayPublicKey");
            c.notifyUrl = creds.get("notifyUrl");
            Factory.setOptions(c);
            appliedVersion = current;
            log.info("[pay][alipay] Factory 已配置 v{} appId={} gatewayHost={} notifyUrl={}",
                    current, c.appId, c.gatewayHost, c.notifyUrl);
        }
        return creds;
    }

    @Override
    public PayCreateResult createPayOrder(PayCreateCommand cmd) {
        Map<String, String> creds = ensureConfigured();
        String way = cmd.wayCode() == null || cmd.wayCode().isBlank() ? "ALI_PC" : cmd.wayCode();
        String amountYuan = String.format("%.2f", cmd.amountCents() / 100.0);
        // 支付宝下单不返回独立 payOrderId（真实 trade_no 在买家付款后才有）→ 用带前缀的商户单号做锚点。
        String payOrderId = "alipay_" + cmd.mchOrderNo();
        String returnUrl = orDefault(creds.get("returnUrl"), "");
        try {
            switch (way) {
                case "ALI_QR" -> {
                    AlipayTradePrecreateResponse r = Factory.Payment.FaceToFace()
                            .preCreate(cmd.subject(), cmd.mchOrderNo(), amountYuan);
                    ensureOk(r.code, r.msg, r.subCode, r.subMsg, cmd.mchOrderNo());
                    log.info("[pay][alipay] preCreate(QR) ok mchOrderNo={} amount={}", cmd.mchOrderNo(), amountYuan);
                    return new PayCreateResult(payOrderId, "qr", r.qrCode);
                }
                case "ALI_PC" -> {
                    AlipayTradePagePayResponse r = Factory.Payment.Page()
                            .pay(cmd.subject(), cmd.mchOrderNo(), amountYuan, returnUrl);
                    if (r == null || r.body == null || r.body.isBlank()) {
                        throw new RuntimeException("支付宝电脑网站下单返回空表单 mchOrderNo=" + cmd.mchOrderNo());
                    }
                    log.info("[pay][alipay] page pay(PC) ok mchOrderNo={} amount={}", cmd.mchOrderNo(), amountYuan);
                    return new PayCreateResult(payOrderId, "page", r.body);
                }
                case "ALI_WAP" -> {
                    AlipayTradeWapPayResponse r = Factory.Payment.Wap()
                            .pay(cmd.subject(), cmd.mchOrderNo(), amountYuan, returnUrl, returnUrl);
                    if (r == null || r.body == null || r.body.isBlank()) {
                        throw new RuntimeException("支付宝手机网站下单返回空表单 mchOrderNo=" + cmd.mchOrderNo());
                    }
                    log.info("[pay][alipay] wap pay ok mchOrderNo={} amount={}", cmd.mchOrderNo(), amountYuan);
                    return new PayCreateResult(payOrderId, "page", r.body);
                }
                default -> throw new RuntimeException("支付宝不支持的 wayCode=" + way + "（仅 ALI_PC/ALI_WAP/ALI_QR）");
            }
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("支付宝下单失败 mchOrderNo=" + cmd.mchOrderNo() + "：" + e.getMessage(), e);
        }
    }

    @Override
    public PayQueryResult queryPayOrder(String mchOrderNo) {
        ensureConfigured();
        try {
            AlipayTradeQueryResponse r = Factory.Payment.Common().query(mchOrderNo);
            if (!ResponseChecker.success(r)) {
                return new PayQueryResult(false, false, "alipay_" + mchOrderNo, 0L, null);
            }
            boolean paid = "TRADE_SUCCESS".equals(r.tradeStatus) || "TRADE_FINISHED".equals(r.tradeStatus);
            long cents = paid && r.totalAmount != null
                    ? Math.round(Double.parseDouble(r.totalAmount) * 100) : 0L;
            return new PayQueryResult(true, paid, "alipay_" + mchOrderNo, cents, r.tradeNo);
        } catch (Exception e) {
            log.debug("[pay][alipay] query 失败 mchOrderNo={}：{}", mchOrderNo, e.toString());
            return new PayQueryResult(false, false, "alipay_" + mchOrderNo, 0L, null);
        }
    }

    @Override
    public String driverName() {
        return "alipay";
    }

    /**
     * 验签支付宝异步回调（RSA2）。SDK 边界收口在本网关类，让 {@code AlipayNotifyController} 不直接碰
     * SDK 静态调用 → 可单测。未配置 / 异常 → false（拒绝入账）。
     */
    public boolean verifyNotify(Map<String, String> params) {
        try {
            ensureConfigured();
            return Factory.Payment.Common().verifyNotify(params);
        } catch (BusinessException notConfigured) {
            log.warn("[pay][alipay] verifyNotify 但渠道未配置：{}", notConfigured.getMessage());
            return false;
        } catch (Exception e) {
            log.warn("[pay][alipay] verifyNotify 异常：{}", e.toString());
            return false;
        }
    }

    private void ensureOk(String code, String msg, String subCode, String subMsg, String mchOrderNo) {
        if (!"10000".equals(code)) {
            throw new RuntimeException("支付宝下单失败 mchOrderNo=" + mchOrderNo
                    + " code=" + code + " msg=" + msg + " subCode=" + subCode + " subMsg=" + subMsg);
        }
    }

    private void requireText(String v, String key) {
        if (v == null || v.isBlank()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENT_CHANNEL_NOT_CONFIGURED",
                    "支付宝渠道未配置完整（缺 " + key + "）。请在管理后台「支付配置」补全后再试。");
        }
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }
}
