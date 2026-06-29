package com.aistareco.aep.service.payment;

import com.alipay.easysdk.factory.Factory;
import com.alipay.easysdk.kernel.Config;
import com.alipay.easysdk.kernel.util.ResponseChecker;
import com.alipay.easysdk.payment.common.models.AlipayTradeQueryResponse;
import com.alipay.easysdk.payment.facetoface.models.AlipayTradePrecreateResponse;
import com.alipay.easysdk.payment.page.models.AlipayTradePagePayResponse;
import com.alipay.easysdk.payment.wap.models.AlipayTradeWapPayResponse;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 支付宝直连网关（v2 §6 · 直连官方 SDK，替代聚合 Jeepay 这一跳）。
 *
 * 复杂的协议（RSA2 签名 / 验签 / 网关交互）全交给官方 {@code alipay-easysdk}；本类只做
 * 「wayCode → 对应支付产品 + payData 形态」的薄映射,以及把已验证的入账编排（settlePaidOrder）接上来。
 *
 * <h2>wayCode → payData</h2>
 * <ul>
 *   <li>{@code ALI_PC}（电脑网站,沙箱首选）/ {@code ALI_WAP}（手机网站）→ {@code payDataType=page}, payData=自动提交的 HTML 表单 → 前端写入并提交跳支付宝收银台</li>
 *   <li>{@code ALI_QR}（当面付/扫码）→ {@code payDataType=qr}, payData=二维码内容串 → 前端渲染二维码</li>
 * </ul>
 *
 * <h2>§8.0</h2>
 * driver=alipay 但缺 appId/私钥/支付宝公钥/notifyUrl → {@code @PostConstruct} fail-fast 拒绝启动。
 * 下单 API 失败 → 抛 RuntimeException（{@code PaymentService} 捕获 → 取消订单 + 502,不入账、不建假单）。
 * 金额 / 入账只信异步 notify（验签）或查单兜底,绝不据浏览器同步跳回入账。
 *
 * <p>沙箱→生产:只换 {@code appId / merchantPrivateKey / alipayPublicKey / gatewayHost} 四项,本类零改。
 */
@Component
@ConditionalOnProperty(name = "aep.payment.driver", havingValue = "alipay")
public class AlipayPaymentGateway implements PaymentGateway {

    private static final Logger log = LoggerFactory.getLogger(AlipayPaymentGateway.class);

    private final PaymentProperties.Alipay cfg;

    public AlipayPaymentGateway(PaymentProperties props) {
        this.cfg = props.getAlipay();
    }

    /** 启动期 fail-fast 校验 + 全局 Factory.setOptions（守 §8.0：缺凭证拒启,不带半配置跑）。 */
    @PostConstruct
    void init() {
        requireText(cfg.getAppId(), "aep.payment.alipay.app-id");
        requireText(cfg.getMerchantPrivateKey(), "aep.payment.alipay.merchant-private-key");
        requireText(cfg.getAlipayPublicKey(), "aep.payment.alipay.alipay-public-key");
        requireText(cfg.getNotifyUrl(), "aep.payment.alipay.notify-url");
        requireText(cfg.getGatewayHost(), "aep.payment.alipay.gateway-host");

        Config c = new Config();
        c.protocol = cfg.getProtocol();
        c.gatewayHost = cfg.getGatewayHost();
        c.signType = cfg.getSignType();
        c.appId = cfg.getAppId();
        c.merchantPrivateKey = cfg.getMerchantPrivateKey();
        c.alipayPublicKey = cfg.getAlipayPublicKey();
        c.notifyUrl = cfg.getNotifyUrl();
        Factory.setOptions(c);

        log.info("[pay][alipay] AlipayPaymentGateway 就绪 appId={} gatewayHost={} sandbox={} defaultWayCode={} notifyUrl={}",
                cfg.getAppId(), cfg.getGatewayHost(), cfg.isSandbox(), cfg.getDefaultWayCode(), cfg.getNotifyUrl());
        if (!cfg.isSandbox() && cfg.getGatewayHost().contains("alipaydev")) {
            log.warn("[pay][alipay] sandbox=false 但 gatewayHost 仍是沙箱域名,请核对是否误用沙箱网关跑生产");
        }
    }

    @Override
    public PayCreateResult createPayOrder(PayCreateCommand cmd) {
        String way = cmd.wayCode() == null || cmd.wayCode().isBlank() ? cfg.getDefaultWayCode() : cmd.wayCode();
        String amountYuan = String.format("%.2f", cmd.amountCents() / 100.0);
        // 支付宝下单不返回独立 payOrderId（真实 trade_no 在买家付款后才有）→ 用带前缀的商户单号做锚点,
        // 满足非空（reconcile 据此识别"走过网关"）;真实渠道单号在 settle 时落 channelPayNo。
        String payOrderId = "alipay_" + cmd.mchOrderNo();
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
                            .pay(cmd.subject(), cmd.mchOrderNo(), amountYuan, returnUrlOrEmpty());
                    // Page().pay 直接返回自动提交表单(body),无 code 字段成功判定 → body 非空即视为成功
                    if (r == null || r.body == null || r.body.isBlank()) {
                        throw new RuntimeException("支付宝电脑网站下单返回空表单 mchOrderNo=" + cmd.mchOrderNo());
                    }
                    log.info("[pay][alipay] page pay(PC) ok mchOrderNo={} amount={}", cmd.mchOrderNo(), amountYuan);
                    return new PayCreateResult(payOrderId, "page", r.body);
                }
                case "ALI_WAP" -> {
                    AlipayTradeWapPayResponse r = Factory.Payment.Wap()
                            .pay(cmd.subject(), cmd.mchOrderNo(), amountYuan, returnUrlOrEmpty(), returnUrlOrEmpty());
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
        try {
            AlipayTradeQueryResponse r = Factory.Payment.Common().query(mchOrderNo);
            if (!ResponseChecker.success(r)) {
                // 含 ACQ.TRADE_NOT_EXIST（precreate 后买家还没扫/还没生成交易）→ 视为存在但未支付
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
     * 验签支付宝异步回调（RSA2）。SDK 边界收口在本网关类（Factory 已在 {@link #init} 配好）,
     * 让 {@code AlipayNotifyController} 不直接碰 SDK 静态调用 → 可单测。异常 → false（拒绝入账）。
     */
    public boolean verifyNotify(java.util.Map<String, String> params) {
        try {
            return Factory.Payment.Common().verifyNotify(params);
        } catch (Exception e) {
            log.warn("[pay][alipay] verifyNotify 异常：{}", e.toString());
            return false;
        }
    }

    private String returnUrlOrEmpty() {
        return cfg.getReturnUrl() == null ? "" : cfg.getReturnUrl();
    }

    private void ensureOk(String code, String msg, String subCode, String subMsg, String mchOrderNo) {
        if (!"10000".equals(code)) {
            throw new RuntimeException("支付宝下单失败 mchOrderNo=" + mchOrderNo
                    + " code=" + code + " msg=" + msg + " subCode=" + subCode + " subMsg=" + subMsg);
        }
    }

    private static void requireText(String v, String key) {
        if (v == null || v.isBlank()) {
            throw new IllegalStateException("driver=alipay 缺必填配置：" + key
                    + "（机密经 env 注入,见 server.local.env / apps/server/.env）");
        }
    }
}
