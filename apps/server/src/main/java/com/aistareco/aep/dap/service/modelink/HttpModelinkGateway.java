package com.aistareco.aep.dap.service.modelink;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * modelink 真实 HTTP 实现（Bearer 鉴权，base 例 {@code https://api.qnaigc.com}）。
 *
 * <p>接入点不走 env —— 与 dap 其余大模型能力一致，由后台「AI 模型与 Key + AI 应用绑定」
 * 把用途 {@link AiModelPurpose#DAP_REAL_AVATAR} 绑定到七牛端点，运行时每次调用解析
 * baseUrl / apiKey / model（解密与判空模式照抄 {@code DapMultimodalClient.resolveTarget}）。
 *
 * <p>错误映射（§8.0：绝不静默降级）：
 * <ul>
 *   <li>未配置端点 → {@link #isConfigured()} = false，由 {@link ModelinkService} 抛 503；</li>
 *   <li>429 → 429 {@code DAP_MODELINK_QUOTA}（配额/限流）；</li>
 *   <li>其它非 2xx / 网络失败 / 响应不是 JSON → 502 {@code DAP_MODELINK_CALL_FAILED}。</li>
 * </ul>
 */
@Component
public class HttpModelinkGateway implements ModelinkGateway {

    private static final Logger log = LoggerFactory.getLogger(HttpModelinkGateway.class);
    private static final ObjectMapper OM = new ObjectMapper();

    private final AiModelInvocationService aiModels;
    private final DapProperties props;
    private final HttpClient http;

    public HttpModelinkGateway(AiModelInvocationService aiModels, DapProperties props) {
        this.aiModels = aiModels;
        this.props = props;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /** 一次调用的落地目标；apiKey 明文仅内存。 */
    record Target(String baseUrl, String apiKey, String model, String endpointName) {}

    Target resolveTarget() {
        AiModelEndpoint e = aiModels.resolveEndpoint(AiModelPurpose.DAP_REAL_AVATAR).orElse(null);
        if (e == null) return null;
        try {
            String key = AepCryptoUtil.decrypt(e.getUpstreamApiKeyEncrypted());
            if (key == null || key.isBlank()) {
                log.warn("[dap-modelink] endpoint key blank endpoint={} → unconfigured", e.getName());
                return null;
            }
            String model = e.getModel() != null && !e.getModel().isBlank() ? e.getModel() : null;
            if (model == null) {
                log.warn("[dap-modelink] endpoint model blank endpoint={} → unconfigured", e.getName());
                return null;
            }
            return new Target(rstrip(e.getBaseUrl()), key, model, e.getName());
        } catch (Exception ex) {
            log.warn("[dap-modelink] endpoint decrypt failed endpoint={} err={} → unconfigured",
                    e.getName(), ex.getMessage());
            return null;
        }
    }

    public boolean isConfigured() {
        return resolveTarget() != null;
    }

    /** 已绑定端点的模型 id（未配置返回 null）。 */
    public String boundModel() {
        Target t = resolveTarget();
        return t == null ? null : t.model();
    }

    // ── 分组 ───────────────────────────────────────────────────

    @Override
    public GroupState createGroup(String kind, String name, String model, String callbackUrl) {
        Target t = require();
        ObjectNode body = OM.createObjectNode();
        body.put("name", clamp(name, 64));
        body.put("type", kind);
        body.put("model", model != null && !model.isBlank() ? model : t.model());
        if (callbackUrl != null && !callbackUrl.isBlank()) {
            if (!callbackUrl.startsWith("https://")) {
                // 官方要求 liveness_face 的 callback_url 为 https；dev 本机联调会是 http，
                // 这里只告警不阻断（真实上游会自行拒绝，错误照实回报）。
                log.warn("[dap-modelink] callback_url 非 https（liveness 分组上游可能拒绝）: {}", callbackUrl);
            }
            body.put("callback_url", callbackUrl);
        }
        JsonNode resp = send("POST", "/v1/asset-groups", body, t);
        return groupStateOf(resp, text(resp, "qgroupid"));
    }

    @Override
    public GroupState getGroup(String qgroupid) {
        Target t = require();
        JsonNode resp = send("GET", "/v1/asset-groups/" + enc(qgroupid), null, t);
        return groupStateOf(resp, qgroupid);
    }

    @Override
    public void visualValidate(String qgroupid, String resultCode, String bytedToken) {
        Target t = require();
        ObjectNode body = OM.createObjectNode();
        body.put("result_code", resultCode);
        if (bytedToken != null && !bytedToken.isBlank()) body.put("byted_token", bytedToken);
        send("POST", "/v1/asset-groups/" + enc(qgroupid) + "/visual-validate-result", body, t);
    }

    // ── 素材 ───────────────────────────────────────────────────

    @Override
    public AssetState createAsset(String type, String name, String model, String url, String qgroupid) {
        Target t = require();
        ObjectNode body = OM.createObjectNode();
        body.put("type", type);
        body.put("name", clamp(name, 64));
        body.put("model", model != null && !model.isBlank() ? model : t.model());
        body.put("url", url);
        if (qgroupid != null && !qgroupid.isBlank()) body.put("group_id", qgroupid);
        JsonNode resp = send("POST", "/v1/assets", body, t);
        return assetStateOf(resp, text(resp, "qassetid"));
    }

    @Override
    public AssetState getAsset(String qassetid) {
        Target t = require();
        JsonNode resp = send("GET", "/v1/assets/" + enc(qassetid), null, t);
        return assetStateOf(resp, qassetid);
    }

    // ── HTTP ──────────────────────────────────────────────────

    private JsonNode send(String method, String path, ObjectNode body, Target t) {
        String url = joinUrl(t.baseUrl(), path);
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(Math.max(5, props.getModelink().getHttpTimeoutSeconds())))
                .header("Authorization", "Bearer " + t.apiKey())
                .header("Accept", "application/json");
        try {
            if ("GET".equals(method)) {
                b.GET();
            } else {
                b.header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(
                                body == null ? "{}" : OM.writeValueAsString(body)));
            }
            HttpResponse<String> resp = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            int sc = resp.statusCode();
            if (sc == 429) {
                log.warn("[dap-modelink] quota/limit {} {} → 429 body={}", method, path, clamp(resp.body(), 400));
                throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "DAP_MODELINK_QUOTA",
                        "素材合规服务已达配额上限，请稍后重试或在七牛控制台提升配额");
            }
            if (sc >= 400) {
                String msg = upstreamMessage(resp.body());
                log.warn("[dap-modelink] http-error {} {} status={} body={}", method, path, sc, clamp(resp.body(), 600));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "DAP_MODELINK_CALL_FAILED",
                        "素材合规服务调用失败" + (msg == null ? "" : "：" + msg),
                        "modelink " + method + " " + path + " status=" + sc + " body=" + clamp(resp.body(), 600));
            }
            String raw = resp.body();
            if (raw == null || raw.isBlank()) return OM.createObjectNode();
            return OM.readTree(raw);
        } catch (BusinessException e) {
            throw e;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("[dap-modelink] call failed {} {}: {}", method, path, e.toString());
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "DAP_MODELINK_CALL_FAILED",
                    "素材合规服务调用失败，请稍后重试",
                    "modelink " + method + " " + path + " err=" + e);
        }
    }

    private Target require() {
        Target t = resolveTarget();
        if (t == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "DAP_MODELINK_NOT_CONFIGURED",
                    "未配置素材合规服务：请在管理后台「AI 应用绑定」把用途「数字资产 · 真人素材与授权」绑定七牛 modelink 端点");
        }
        return t;
    }

    // ── 响应解析 ───────────────────────────────────────────────

    private static GroupState groupStateOf(JsonNode resp, String fallbackId) {
        JsonNode n = unwrap(resp);
        return new GroupState(
                firstNonBlank(text(n, "qgroupid"), fallbackId),
                lower(firstNonBlank(text(n, "status"), "pending")),
                text(n, "h5_link"),
                text(n, "byted_token"),
                firstNonBlank(text(n, "fail_reason"), text(n, "failReason")));
    }

    private static AssetState assetStateOf(JsonNode resp, String fallbackId) {
        JsonNode n = unwrap(resp);
        return new AssetState(
                firstNonBlank(text(n, "qassetid"), fallbackId),
                lower(firstNonBlank(text(n, "status"), "pending")),
                firstNonBlank(text(n, "fail_reason"), text(n, "failReason")));
    }

    /** 兼容 {data:{...}} 包壳与裸对象两种形态。 */
    private static JsonNode unwrap(JsonNode resp) {
        if (resp == null) return OM.createObjectNode();
        JsonNode data = resp.get("data");
        return data != null && data.isObject() ? data : resp;
    }

    private static String upstreamMessage(String body) {
        if (body == null || body.isBlank()) return null;
        try {
            JsonNode n = OM.readTree(body);
            String m = text(n.path("error"), "message");
            return m != null ? clamp(m, 200) : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static String text(JsonNode n, String field) {
        if (n == null) return null;
        JsonNode v = n.get(field);
        if (v == null || v.isNull()) return null;
        String s = v.asText();
        return s == null || s.isBlank() ? null : s;
    }

    private static String firstNonBlank(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return null;
    }

    private static String lower(String s) {
        return s == null ? null : s.toLowerCase();
    }

    private static String enc(String seg) {
        return seg == null ? "" : seg.replaceAll("[^A-Za-z0-9._~-]", "");
    }

    /** base（可带可不带 /v1）+ path（以 /v1/ 开头）→ 不重复 /v1 的完整 URL。 */
    static String joinUrl(String base, String path) {
        String b = rstrip(base);
        if (b.endsWith("/v1") && path.startsWith("/v1/")) return b + path.substring(3);
        return b + path;
    }

    private static String rstrip(String s) {
        if (s == null) return "";
        String out = s.trim();
        while (out.endsWith("/")) out = out.substring(0, out.length() - 1);
        return out;
    }

    private static String clamp(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
