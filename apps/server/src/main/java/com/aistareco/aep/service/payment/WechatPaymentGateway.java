package com.aistareco.aep.service.payment;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wechat.pay.java.core.Config;
import com.wechat.pay.java.core.RSAAutoCertificateConfig;
import com.wechat.pay.java.core.notification.NotificationConfig;
import com.wechat.pay.java.core.notification.NotificationParser;
import com.wechat.pay.java.core.notification.RequestParam;
import com.wechat.pay.java.service.payments.h5.H5Service;
import com.wechat.pay.java.service.payments.jsapi.JsapiService;
import com.wechat.pay.java.service.payments.model.Transaction;
import com.wechat.pay.java.service.payments.nativepay.NativePayService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 微信支付直连网关（v0.94 · 官方 wechatpay-java V3 SDK）。支持 Native 扫码 / JSAPI 小程序 / H5 手机浏览器。
 *
 * <h2>wayCode → payData</h2>
 * <ul>
 *   <li>{@code WX_NATIVE}（扫码）→ {@code payDataType=qr}, payData=code_url → 前端渲染二维码</li>
 *   <li>{@code WX_JSAPI}（小程序）→ {@code payDataType=jsapi}, payData=wx.requestPayment 参数 JSON（需 openid）</li>
 *   <li>{@code WX_H5}（手机浏览器）→ {@code payDataType=redirect}, payData=h5_url → 前端跳转</li>
 * </ul>
 *
 * <h2>v0.94 运行时配置 + §8.0</h2>
 * 机密来自 {@link PaymentChannelConfigService}（admin 后台 DB，可热更）。{@link #ensureConfigured()} 按
 * 配置版本号惰性构建 SDK Config（{@code RSAAutoCertificateConfig} 自动下载/轮换平台证书）+ 三个产品 service。
 * 机密缺失 → 503 PAYMENT_CHANNEL_NOT_CONFIGURED（不静默回退）；调用失败 → RuntimeException（上层取消单 + 502）。
 */
@Component
public class WechatPaymentGateway implements PaymentGateway {

    private static final Logger log = LoggerFactory.getLogger(WechatPaymentGateway.class);

    private final PaymentChannelConfigService channelConfig;
    private final ObjectMapper om;

    private volatile int builtVersion = -1;
    private volatile Config config;
    private volatile NativePayService nativeService;
    private volatile JsapiService jsapiService;
    private volatile H5Service h5Service;
    private volatile String appId;
    private volatile String mchId;
    private volatile String notifyUrl;

    public WechatPaymentGateway(PaymentChannelConfigService channelConfig, ObjectMapper om) {
        this.channelConfig = channelConfig;
        this.om = om;
    }

    @Override
    public String driverName() {
        return "wechat";
    }

    @Override
    public boolean isConfigured() {
        return channelConfig.isConfigured("wechat");
    }

    /** 惰性构建 SDK：机密缺失抛 503；version 变化才重建（线程安全）。 */
    private synchronized void ensureConfigured() {
        Map<String, String> creds = channelConfig.credentials("wechat");
        String mch = require(creds, "mchId");
        String app = require(creds, "appId");
        String apiV3Key = require(creds, "apiV3Key");
        String privateKey = require(creds, "merchantPrivateKey");
        String serial = require(creds, "merchantSerialNumber");
        String notify = require(creds, "notifyUrl");

        int current = channelConfig.version("wechat");
        if (current != builtVersion || config == null) {
            Config c = new RSAAutoCertificateConfig.Builder()
                    .merchantId(mch)
                    .privateKey(privateKey)
                    .merchantSerialNumber(serial)
                    .apiV3Key(apiV3Key)
                    .build();
            this.config = c;
            this.nativeService = new NativePayService.Builder().config(c).build();
            this.jsapiService = new JsapiService.Builder().config(c).build();
            this.h5Service = new H5Service.Builder().config(c).build();
            this.appId = app;
            this.mchId = mch;
            this.notifyUrl = notify;
            this.builtVersion = current;
            log.info("[pay][wechat] SDK 已构建 v{} mchId={} appId={} notifyUrl={}", current, mch, app, notify);
        }
    }

    @Override
    public PayCreateResult createPayOrder(PayCreateCommand cmd) {
        ensureConfigured();
        String way = cmd.wayCode() == null || cmd.wayCode().isBlank() ? "WX_NATIVE" : cmd.wayCode();
        String payOrderId = "wechat_" + cmd.mchOrderNo();
        try {
            return switch (way) {
                case "WX_NATIVE" -> {
                    com.wechat.pay.java.service.payments.nativepay.model.PrepayRequest req =
                            new com.wechat.pay.java.service.payments.nativepay.model.PrepayRequest();
                    req.setAppid(appId);
                    req.setMchid(mchId);
                    req.setDescription(cmd.subject());
                    req.setOutTradeNo(cmd.mchOrderNo());
                    req.setNotifyUrl(notifyUrl);
                    com.wechat.pay.java.service.payments.nativepay.model.Amount amt =
                            new com.wechat.pay.java.service.payments.nativepay.model.Amount();
                    amt.setTotal((int) cmd.amountCents());
                    req.setAmount(amt);
                    String codeUrl = nativeService.prepay(req).getCodeUrl();
                    log.info("[pay][wechat] native prepay ok mchOrderNo={}", cmd.mchOrderNo());
                    yield new PayCreateResult(payOrderId, "qr", codeUrl);
                }
                case "WX_JSAPI" -> {
                    if (cmd.openid() == null || cmd.openid().isBlank()) {
                        throw new BusinessException(HttpStatus.BAD_REQUEST, "WX_OPENID_REQUIRED",
                                "微信小程序支付需要先获取 openid");
                    }
                    com.wechat.pay.java.service.payments.jsapi.model.PrepayRequest req =
                            new com.wechat.pay.java.service.payments.jsapi.model.PrepayRequest();
                    req.setAppid(appId);
                    req.setMchid(mchId);
                    req.setDescription(cmd.subject());
                    req.setOutTradeNo(cmd.mchOrderNo());
                    req.setNotifyUrl(notifyUrl);
                    com.wechat.pay.java.service.payments.jsapi.model.Amount amt =
                            new com.wechat.pay.java.service.payments.jsapi.model.Amount();
                    amt.setTotal((int) cmd.amountCents());
                    req.setAmount(amt);
                    com.wechat.pay.java.service.payments.jsapi.model.Payer payer =
                            new com.wechat.pay.java.service.payments.jsapi.model.Payer();
                    payer.setOpenid(cmd.openid());
                    req.setPayer(payer);
                    String prepayId = jsapiService.prepay(req).getPrepayId();
                    // 组装 wx.requestPayment 参数并用商户私钥 RSA 签名（SDK 0.2.x 无 prepayWithRequestPayment）。
                    String ts = String.valueOf(java.time.Instant.now().getEpochSecond());
                    String nonceStr = java.util.UUID.randomUUID().toString().replace("-", "");
                    String pkg = "prepay_id=" + prepayId;
                    String message = appId + "\n" + ts + "\n" + nonceStr + "\n" + pkg + "\n";
                    String paySign = config.createSigner().sign(message).getSign();
                    ObjectNode pay = om.createObjectNode();
                    pay.put("appId", appId);
                    pay.put("timeStamp", ts);
                    pay.put("nonceStr", nonceStr);
                    pay.put("package", pkg);
                    pay.put("signType", "RSA");
                    pay.put("paySign", paySign);
                    log.info("[pay][wechat] jsapi prepay ok mchOrderNo={}", cmd.mchOrderNo());
                    yield new PayCreateResult(payOrderId, "jsapi", om.writeValueAsString(pay));
                }
                case "WX_H5" -> {
                    com.wechat.pay.java.service.payments.h5.model.PrepayRequest req =
                            new com.wechat.pay.java.service.payments.h5.model.PrepayRequest();
                    req.setAppid(appId);
                    req.setMchid(mchId);
                    req.setDescription(cmd.subject());
                    req.setOutTradeNo(cmd.mchOrderNo());
                    req.setNotifyUrl(notifyUrl);
                    com.wechat.pay.java.service.payments.h5.model.Amount amt =
                            new com.wechat.pay.java.service.payments.h5.model.Amount();
                    amt.setTotal((int) cmd.amountCents());
                    req.setAmount(amt);
                    com.wechat.pay.java.service.payments.h5.model.SceneInfo scene =
                            new com.wechat.pay.java.service.payments.h5.model.SceneInfo();
                    scene.setPayerClientIp(cmd.clientIp() == null || cmd.clientIp().isBlank() ? "127.0.0.1" : cmd.clientIp());
                    com.wechat.pay.java.service.payments.h5.model.H5Info h5 =
                            new com.wechat.pay.java.service.payments.h5.model.H5Info();
                    h5.setType("Wap");
                    scene.setH5Info(h5);
                    req.setSceneInfo(scene);
                    String h5Url = h5Service.prepay(req).getH5Url();
                    log.info("[pay][wechat] h5 prepay ok mchOrderNo={}", cmd.mchOrderNo());
                    yield new PayCreateResult(payOrderId, "redirect", h5Url);
                }
                default -> throw new RuntimeException("微信不支持的 wayCode=" + way + "（仅 WX_NATIVE/WX_JSAPI/WX_H5）");
            };
        } catch (BusinessException be) {
            throw be;
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("微信下单失败 mchOrderNo=" + cmd.mchOrderNo() + "：" + e.getMessage(), e);
        }
    }

    @Override
    public PayQueryResult queryPayOrder(String mchOrderNo) {
        try {
            ensureConfigured();
            com.wechat.pay.java.service.payments.nativepay.model.QueryOrderByOutTradeNoRequest q =
                    new com.wechat.pay.java.service.payments.nativepay.model.QueryOrderByOutTradeNoRequest();
            q.setMchid(mchId);
            q.setOutTradeNo(mchOrderNo);
            Transaction t = nativeService.queryOrderByOutTradeNo(q);
            boolean paid = t.getTradeState() == Transaction.TradeStateEnum.SUCCESS;
            long cents = paid && t.getAmount() != null && t.getAmount().getTotal() != null
                    ? t.getAmount().getTotal() : 0L;
            return new PayQueryResult(true, paid, "wechat_" + mchOrderNo, cents, t.getTransactionId());
        } catch (Exception e) {
            log.debug("[pay][wechat] query 失败 mchOrderNo={}：{}", mchOrderNo, e.toString());
            return new PayQueryResult(false, false, "wechat_" + mchOrderNo, 0L, null);
        }
    }

    /**
     * 验签 + 解密微信 V3 异步回调。SDK 边界收口在本网关，让 {@code WechatNotifyController} 不直接碰 SDK →
     * 可单测。任一失败 → {@code valid=false}（拒绝入账）。
     */
    public NotifyResult parseNotify(String serial, String nonce, String signature, String timestamp,
                                    String signType, String body) {
        try {
            ensureConfigured();
            RequestParam param = new RequestParam.Builder()
                    .serialNumber(serial)
                    .nonce(nonce)
                    .signature(signature)
                    .timestamp(timestamp)
                    .signType(signType)
                    .body(body)
                    .build();
            NotificationParser parser = new NotificationParser((NotificationConfig) config);
            Transaction t = parser.parse(param, Transaction.class);
            boolean paid = t.getTradeState() == Transaction.TradeStateEnum.SUCCESS;
            long cents = t.getAmount() != null && t.getAmount().getTotal() != null ? t.getAmount().getTotal() : 0L;
            return new NotifyResult(true, t.getOutTradeNo(), paid, cents, t.getTransactionId());
        } catch (Exception e) {
            log.warn("[pay][wechat] 回调验签/解密失败：{}", e.toString());
            return new NotifyResult(false, null, false, 0L, null);
        }
    }

    private String require(Map<String, String> creds, String key) {
        String v = creds.get(key);
        if (v == null || v.isBlank()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENT_CHANNEL_NOT_CONFIGURED",
                    "微信支付渠道未配置完整（缺 " + key + "）。请在管理后台「支付配置」补全后再试。");
        }
        return v;
    }

    /** 回调解析结果（验签 + 解密后）。 */
    public record NotifyResult(boolean valid, String outTradeNo, boolean paid, long amountFen, String transactionId) {}
}
