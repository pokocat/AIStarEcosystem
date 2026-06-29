package com.aistareco.aep.service.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Jeepay 真实支付网关驱动（v2 §6.3/§6.4）。仅当 {@code aep.payment.driver=jeepay} 注入。
 *
 * 用 JDK {@link HttpClient} 直连 jeepay-payment 的统一下单 / 查单 REST 接口，MD5 验签隔离在
 * {@link JeepaySignUtil}。<b>不引第三方 SDK</b>，依赖面最小、签名格式有单测固定。
 *
 * §8.0 合规：
 *   - 启动 fail-fast：driver=jeepay 但缺 baseUrl/mchNo/appId/apiKey/notifyUrl → 拒绝启动（绝不带半配置跑）。
 *   - 调用失败（HTTP 非 2xx / code≠0）→ 抛 RuntimeException，由 PaymentService 转 502 PAYMENT_GATEWAY_ERROR，
 *     不入账、不建假单、绝不静默回退到 shadow/mock。
 *
 * <p><b>⚠️ 真机联调待办（§13#6）</b>：本驱动的 HTTP 字段映射 / 端点路径依 Jeepay 文档实现，
 * 但<b>未对真实 Jeepay 实例联调验证</b>。上线前必须：部署 jeepay-payment + manager 配商户应用 →
 * 注入 env → 跑一笔真实下单 + 回调验签。签名算法（{@link JeepaySignUtil}）已单测固定。
 */
@Component
@ConditionalOnProperty(name = "aep.payment.driver", havingValue = "jeepay")
public class JeepayPaymentGateway implements PaymentGateway {

    private static final Logger log = LoggerFactory.getLogger(JeepayPaymentGateway.class);

    private final PaymentProperties.Jeepay cfg;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();

    public JeepayPaymentGateway(PaymentProperties props, ObjectMapper mapper) {
        this.cfg = props.getJeepay();
        this.mapper = mapper;
    }

    /** §8.0 启动 fail-fast：缺关键配置即拒绝启动（不允许带半套配置上线后请求期才暴雷）。 */
    @PostConstruct
    void validateConfig() {
        requireSet("aep.payment.jeepay.base-url", cfg.getBaseUrl());
        requireSet("aep.payment.jeepay.mch-no", cfg.getMchNo());
        requireSet("aep.payment.jeepay.app-id", cfg.getAppId());
        requireSet("aep.payment.jeepay.api-key", cfg.getApiKey());
        requireSet("aep.payment.jeepay.notify-url", cfg.getNotifyUrl());
        if (!"MD5".equalsIgnoreCase(cfg.getSignType())) {
            throw new IllegalStateException("aep.payment.jeepay.sign-type 目前仅支持 MD5，收到：" + cfg.getSignType());
        }
        log.info("[pay][jeepay] driver 已启用 baseUrl={} mchNo={} appId={} （apiKey 已隐藏）",
                cfg.getBaseUrl(), cfg.getMchNo(), cfg.getAppId());
    }

    @Override
    public PayCreateResult createPayOrder(PayCreateCommand cmd) {
        Map<String, String> params = baseParams();
        params.put("mchOrderNo", cmd.mchOrderNo());
        params.put("wayCode", cmd.wayCode());
        params.put("amount", String.valueOf(cmd.amountCents()));
        params.put("currency", "cny");
        params.put("subject", cmd.subject());
        params.put("body", cmd.subject());
        params.put("notifyUrl", cfg.getNotifyUrl());
        if (cmd.clientIp() != null && !cmd.clientIp().isBlank()) {
            params.put("clientIp", cmd.clientIp());
        }
        // WX_LITE 必带 openid（放 channelExtra JSON 串）
        if (cmd.openid() != null && !cmd.openid().isBlank()) {
            params.put("channelExtra", "{\"openid\":\"" + cmd.openid() + "\"}");
        }
        JsonNode data = call("/api/pay/unifiedOrder", params);
        String payOrderId = text(data, "payOrderId");
        String payDataType = text(data, "payDataType");
        String payData = text(data, "payData");
        log.info("[pay][jeepay] unifiedOrder ok mchOrderNo={} payOrderId={} payDataType={}",
                cmd.mchOrderNo(), payOrderId, payDataType);
        return new PayCreateResult(payOrderId, payDataType, payData);
    }

    @Override
    public PayQueryResult queryPayOrder(String mchOrderNo) {
        Map<String, String> params = baseParams();
        params.put("mchOrderNo", mchOrderNo);
        JsonNode data = call("/api/pay/query", params);
        // Jeepay orderState: 2 = 支付成功
        int state = data.path("state").asInt(data.path("orderState").asInt(-1));
        boolean paid = state == 2;
        return new PayQueryResult(
                true, paid,
                text(data, "payOrderId"),
                paid ? data.path("amount").asLong(0L) : 0L,
                text(data, "channelOrderNo"));
    }

    @Override
    public String driverName() {
        return "jeepay";
    }

    // ── 内部 ────────────────────────────────────────────────────────────────

    private Map<String, String> baseParams() {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("mchNo", cfg.getMchNo());
        p.put("appId", cfg.getAppId());
        p.put("version", cfg.getVersion());
        p.put("signType", cfg.getSignType());
        p.put("reqTime", String.valueOf(System.currentTimeMillis()));
        return p;
    }

    /** 签名 + POST JSON + 校验 code==0，返回 data 节点。任何异常向上抛（§8.0 不静默）。 */
    private JsonNode call(String path, Map<String, String> params) {
        params.put("sign", JeepaySignUtil.sign(params, cfg.getApiKey()));
        try {
            String body = mapper.writeValueAsString(params);
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(cfg.getBaseUrl() + path))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() / 100 != 2) {
                throw new IllegalStateException("Jeepay HTTP " + resp.statusCode() + " for " + path);
            }
            JsonNode root = mapper.readTree(resp.body());
            int code = root.path("code").asInt(-1);
            if (code != 0) {
                throw new IllegalStateException("Jeepay code=" + code + " msg=" + root.path("msg").asText());
            }
            return root.path("data");
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Jeepay 调用失败 " + path + "：" + e.getMessage(), e);
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static void requireSet(String key, String val) {
        if (val == null || val.isBlank()) {
            throw new IllegalStateException("driver=jeepay 缺少必填配置 " + key
                    + "（§8.0：生产禁止带半套支付配置启动）。请经 env 注入后重启。");
        }
    }
}
