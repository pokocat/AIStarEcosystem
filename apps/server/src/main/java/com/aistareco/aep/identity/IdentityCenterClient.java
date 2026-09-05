package com.aistareco.aep.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 账号中心机器互调客户端（{@code docs/unified-identity-plan.md} §4.4 / §12.3 / §12.4）。
 *
 * <p>凭据：{@code client_credentials}（Basic auth，{@code aep.identity.client-id} /
 * {@code client-secret}），令牌进程内缓存到过期前 60s。
 *
 * <p>失败策略：{@link #reportLink} / {@link #fetchOutbox} 的**网络与 HTTP 失败**是旁路
 * （建档回执、事件对齐），仅 WARN 不抛 —— §8.0 的「观测类 best-effort」例外，绝不阻塞用户登录。
 * {@link #importUsers} 是运维显式触发的动作，失败必须**抛给调用方**（否则运营会以为导完了）。
 *
 * <p>但**响应壳不符合契约**在两条链路上一律抛 {@link IdentityCenterException}：
 * 那不是「上游临时抖动」，而是配置 / 版本对不上，静默当成「0 条事件」「导入成功」是最糟的结果。
 */
@Component
public class IdentityCenterClient {

    private static final Logger log = LoggerFactory.getLogger(IdentityCenterClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** 建档回执状态。 */
    public static final String LINK_PROVISIONED = "PROVISIONED";
    public static final String LINK_ACTIVE = "ACTIVE";

    private final IdentityProperties props;
    private final RestClient http;

    private volatile String cachedToken;
    private volatile Instant cachedTokenExpiry = Instant.EPOCH;

    public IdentityCenterClient(IdentityProperties props) {
        this.props = props;
        this.http = RestClient.create();
    }

    public boolean isEnabled() {
        return props.isMachineCallEnabled();
    }

    // ---------------------------------------------------------------- links

    /** 回报「uid 在本产品的本地档案」。best-effort：失败只 WARN。 */
    public void reportLink(String uid, String localSubjectId, String status) {
        if (!isEnabled() || uid == null || uid.isBlank()) return;
        try {
            http.put()
                    .uri(props.baseUrl() + "/api/products/" + props.getProductCode() + "/links/" + uid)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("localSubjectId", localSubjectId, "status", status))
                    .retrieve()
                    .toBodilessEntity();
            log.debug("[identity] link reported uid={} localSubjectId={} status={}", uid, localSubjectId, status);
        } catch (RuntimeException e) {
            log.warn("[identity] link 回报失败（忽略，不影响登录） uid={} status={} err={}",
                    uid, status, e.toString());
        }
    }

    // --------------------------------------------------------------- outbox

    /** 一条账号中心事件。{@code payload} 已归一为 JSON 对象（上游可能给对象或字符串）。 */
    public record OutboxEvent(long id, String eventType, String uid, JsonNode payload) {}

    /**
     * 拉取 {@code after} 之后的事件。
     *
     * <p>网络 / HTTP 失败仍是 best-effort（返回空列表 + WARN，下轮重试，游标不前进）；
     * 但**响应壳不符合契约**会抛 {@link IdentityCenterException} —— 那是配置或版本对不上，
     * 静默返回空列表只会让链路「安静地从未工作过」。</p>
     */
    public List<OutboxEvent> fetchOutbox(long after, int limit) {
        if (!isEnabled()) return List.of();
        JsonNode body;
        try {
            body = http.get()
                    .uri(props.baseUrl() + "/api/products/" + props.getProductCode()
                            + "/outbox?after=" + after + "&limit=" + limit)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken())
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RuntimeException e) {
            log.warn("[identity] outbox 拉取失败（本轮跳过，游标不前进） after={} err={}", after, e.toString());
            return List.of();
        }
        return parseOutbox(body);
    }

    /**
     * 解析 outbox 响应。
     *
     * <p><b>契约</b>（独立仓库 {@code pokocat/aibuzz-id} 的 {@code OutboxController}）：
     * {@code {"success":true,"data":{"events":[{id,eventType,uid,productCode,payload,createdAt}…],
     * "nextAfter":N}}}。裸数组只作为测试 / 极简打桩的兼容分支保留。</p>
     *
     * @throws IdentityCenterException 壳不认识、{@code success=false}、或某条事件缺 id / eventType
     */
    static List<OutboxEvent> parseOutbox(JsonNode body) {
        JsonNode array = arrayOf(body, "events", "outbox");
        List<OutboxEvent> out = new ArrayList<>();
        for (JsonNode row : array) {
            long id = row.path("id").asLong(0L);
            String type = row.path("eventType").asText(row.path("event_type").asText(""));
            String uid = blankToNull(row.path("uid").asText(null));
            JsonNode payload = row.has("payload") ? row.path("payload") : row.path("payloadJson");
            if (payload != null && payload.isTextual()) {
                try {
                    payload = MAPPER.readTree(payload.asText());
                } catch (Exception ignored) {
                    payload = null;
                }
            }
            if (payload != null && payload.isNull()) payload = null;
            if (id <= 0 || type == null || type.isBlank()) {
                // 没有 id 就无法推进游标、也无法去重 —— 这条流已经不可信，整批拒绝。
                throw new IdentityCenterException(
                        "outbox 事件缺少 id 或 eventType：" + abbreviate(row));
            }
            out.add(new OutboxEvent(id, type, uid, payload));
        }
        return out;
    }

    /**
     * 取出标准壳 {@code {success,data:{<key>:[…]}}} 里的数组。
     *
     * @param key   {@code data} 下的数组字段名（outbox → {@code events}；import → {@code results}）
     * @param label 出错信息里的可读名字
     */
    private static JsonNode arrayOf(JsonNode body, String key, String label) {
        if (body == null) {
            throw new IdentityCenterException(label + " 响应为空（账号中心没有返回 JSON）");
        }
        if (body.has("success") && !body.path("success").asBoolean(false)) {
            throw new IdentityCenterException(label + " 响应 success=false：" + abbreviate(body));
        }
        JsonNode data = body.path("data");
        if (data.isObject() && data.path(key).isArray()) return data.path(key);
        // 兼容分支：极简打桩 / 单元测试直接给裸数组。
        if (body.isArray()) return body;
        throw new IdentityCenterException(
                label + " 响应壳不符合契约（期望 {success,data:{" + key + ":[…]}}）：" + abbreviate(body));
    }

    private static String abbreviate(JsonNode node) {
        String text = String.valueOf(node);
        return text.length() <= 300 ? text : text.substring(0, 300) + "…";
    }

    // --------------------------------------------------------------- import

    /** 一条导入请求项（§12.3）。 */
    public record ImportRequestItem(String localSubjectId, String phone) {}

    /**
     * 一条导入结果项。{@code skipped} 非空表示该条未映射（如 {@code ACCOUNT_CLOSED}），
     * 此时 {@code uid} 可能为 null。
     */
    public record ImportResultItem(String localSubjectId, String uid, boolean created, String skipped) {}

    /**
     * 把「有手机号但没有 uid」的本地账号送去账号中心找 / 建 uid（≤500 条一批）。
     * 失败**抛出** —— 运维触发的动作不允许静默成功。
     */
    public List<ImportResultItem> importUsers(List<ImportRequestItem> batch) {
        if (!isEnabled()) {
            throw new IllegalStateException("账号中心未配置（aep.identity.issuer / client-secret），无法导入");
        }
        if (batch == null || batch.isEmpty()) return List.of();
        List<Map<String, Object>> payload = new ArrayList<>(batch.size());
        for (ImportRequestItem item : batch) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("localSubjectId", item.localSubjectId());
            row.put("phone", item.phone());
            payload.add(row);
        }
        JsonNode body = http.post()
                .uri(props.baseUrl() + "/api/products/" + props.getProductCode() + "/import-users")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken())
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(JsonNode.class);
        return parseImport(body);
    }

    /**
     * 解析 import-users 响应。
     *
     * <p><b>契约</b>（独立仓库 {@code pokocat/aibuzz-id} 的 {@code ImportController}）：
     * {@code {"success":true,"data":{"results":[{localSubjectId,uid,created,skipped?}…],
     * "created":N,"linked":N,"skipped":N}}}。{@code skipped} 只有被跳过时才出现。</p>
     *
     * @throws IdentityCenterException 壳不认识、{@code success=false}、或某条结果缺 localSubjectId
     */
    static List<ImportResultItem> parseImport(JsonNode body) {
        JsonNode array = arrayOf(body, "results", "import-users");
        List<ImportResultItem> out = new ArrayList<>();
        for (JsonNode row : array) {
            String localSubjectId = blankToNull(row.path("localSubjectId").asText(null));
            if (localSubjectId == null) {
                // 认不出是哪一条本地账号 → 回写无从谈起，整批当失败（运维会看到报错而不是「导完了」）。
                throw new IdentityCenterException(
                        "import-users 结果缺少 localSubjectId：" + abbreviate(row));
            }
            out.add(new ImportResultItem(
                    localSubjectId,
                    blankToNull(row.path("uid").asText(null)),
                    row.path("created").asBoolean(false),
                    blankToNull(row.path("skipped").asText(null))));
        }
        return out;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    // ---------------------------------------------------------------- token

    /** client_credentials 令牌，缓存到过期前 60s。 */
    String accessToken() {
        String token = cachedToken;
        if (token != null && Instant.now().isBefore(cachedTokenExpiry)) return token;
        synchronized (this) {
            if (cachedToken != null && Instant.now().isBefore(cachedTokenExpiry)) return cachedToken;
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("grant_type", "client_credentials");
            form.add("scope", "product.link"); // 账号中心 aistar-server 客户端注册的唯一 scope（§4.4）
            String basic = Base64.getEncoder().encodeToString(
                    (props.getClientId() + ":" + props.getClientSecret()).getBytes(StandardCharsets.UTF_8));
            JsonNode body = http.post()
                    .uri(props.baseUrl() + "/oauth2/token")
                    .header(HttpHeaders.AUTHORIZATION, "Basic " + basic)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
            String fresh = body == null ? null : body.path("access_token").asText(null);
            if (fresh == null || fresh.isBlank()) {
                throw new IllegalStateException("账号中心 client_credentials 未返回 access_token");
            }
            long expiresIn = body.path("expires_in").asLong(300L);
            cachedToken = fresh;
            cachedTokenExpiry = Instant.now().plusSeconds(Math.max(1L, expiresIn - 60L));
            return fresh;
        }
    }

    /** 测试 / 运维用：丢弃缓存的机器令牌。 */
    public void resetToken() {
        cachedToken = null;
        cachedTokenExpiry = Instant.EPOCH;
    }
}
