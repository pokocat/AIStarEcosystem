package com.aistareco.aep.identity;

import com.fasterxml.jackson.databind.JsonNode;
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
import java.util.List;

/**
 * 账号中心「应用接入全景」的读取（{@code aibuzz-id} README §19.2）。
 *
 * <p>回答的问题是：<b>统一登录到底接了哪些系统、哪些还活着</b>。这在我们自己的库里查不到 ——
 * 客户端注册表是账号中心的，产品侧只知道自己那一个 client_id。
 *
 * <p>与 {@link IdentityCenterClient} 分成两个组件、各自缓存各自的令牌，是因为它们用的是
 * <b>两个不同的客户端</b>：那个是 {@code aistar-server}（scope {@code product.link}），
 * 这个是 {@code admin-server}（scope {@code clients.read}）。账号中心按客户端发 scope，
 * 拿产品那把去读全景只会 403 —— 共用一个令牌缓存迟早把两者搞混。
 *
 * <p><b>失败不静默</b>（§8.0）：读不到就在返回值里把 {@code error} 填上、其余字段留空，
 * 由页面显示「读取失败」。绝不返回一个空列表 —— 那会被看成「一个系统都没接」，
 * 恰好是最糟的误导。
 */
@Component
public class IdentityAdminClient {

    private static final Logger log = LoggerFactory.getLogger(IdentityAdminClient.class);

    /** 账号中心给运营后台后端注册的读 scope。 */
    private static final String SCOPE_CLIENTS_READ = "clients.read";

    private final IdentityProperties props;
    private final RestClient http;

    private volatile String cachedToken;
    private volatile Instant cachedTokenExpiry = Instant.EPOCH;

    public IdentityAdminClient(IdentityProperties props) {
        this.props = props;
        this.http = RestClient.create();
    }

    // ------------------------------------------------------------------ wire

    /** 一个接入端（web app / 小程序 / 产品后端）。字段与账号中心 `ClientOverviewService.ClientView` 1:1。 */
    public record IdentityClientRow(String clientId,
                                    String displayName,
                                    String audience,
                                    String wechatAppId,
                                    boolean disabled,
                                    boolean publicClient,
                                    List<String> grants,
                                    List<String> scopes,
                                    List<String> redirectUris,
                                    /** 最近一次换出令牌；null = 从没换过，或活跃度不可用（看 activityAvailable）。 */
                                    String lastTokenAt,
                                    /** 近 7 天授权数；null = 活跃度不可用，<b>不是</b> 0。 */
                                    Long tokens7d) {}

    /** 一个产品下的全部接入端。 */
    public record IdentityProductRow(String productCode, String displayName, List<IdentityClientRow> clients) {}

    /**
     * 全景快照。
     *
     * <p>{@code error} 非空时其余字段一律空 —— 「读失败」与「一个都没接」必须分开渲染。
     * {@code activityAvailable=false} 表示账号中心那边的活跃度聚合没取到，
     * 此时每行的 {@code lastTokenAt} / {@code tokens7d} 都是 null，页面该显示「暂不可用」
     * 而不是「从没用过」。
     */
    public record IdentityClientOverview(String error,
                                         boolean configured,
                                         String issuer,
                                         String checkedAt,
                                         String generatedAt,
                                         boolean activityAvailable,
                                         int productCount,
                                         int clientCount,
                                         List<IdentityProductRow> products) {

        static IdentityClientOverview failed(String error, boolean configured, String issuer) {
            return new IdentityClientOverview(error, configured, issuer, Instant.now().toString(),
                    null, false, 0, 0, List.of());
        }
    }

    // ----------------------------------------------------------------- fetch

    public IdentityClientOverview fetchOverview() {
        String issuer = props.baseUrl();
        if (!props.isAdminCallEnabled()) {
            // 不是错误，是「这台环境没配」。页面照这个分支提示去哪儿配，而不是显示一张空表。
            return IdentityClientOverview.failed(
                    "未配置账号中心的后台凭据（aep.identity.admin-client-secret / AEP_ID_ADMIN_CLIENT_SECRET）",
                    false, issuer);
        }
        JsonNode body;
        try {
            body = http.get()
                    .uri(issuer + "/api/admin/clients")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken())
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RuntimeException e) {
            log.warn("[identity-admin] 读应用全景失败 issuer={} err={}", issuer, e.toString());
            return IdentityClientOverview.failed("读取账号中心失败：" + e.getMessage(), true, issuer);
        }
        try {
            return parse(body, issuer);
        } catch (RuntimeException e) {
            // 壳不认识 = 配置或版本对不上，不是「暂时抖动」。原样说出来，别当成空结果。
            log.warn("[identity-admin] 应用全景响应壳不符合契约 err={}", e.toString());
            return IdentityClientOverview.failed("账号中心响应格式不符合契约：" + e.getMessage(), true, issuer);
        }
    }

    /** 契约：{@code {"success":true,"data":{generatedAt,activityAvailable,productCount,clientCount,products:[…]}}}。 */
    static IdentityClientOverview parse(JsonNode body, String issuer) {
        if (body == null || !body.path("success").asBoolean(false) || !body.path("data").isObject()) {
            throw new IllegalStateException("缺少 success=true 的 data 对象");
        }
        JsonNode data = body.path("data");
        List<IdentityProductRow> products = new ArrayList<>();
        for (JsonNode p : data.path("products")) {
            List<IdentityClientRow> clients = new ArrayList<>();
            for (JsonNode c : p.path("clients")) {
                clients.add(new IdentityClientRow(
                        text(c, "clientId"),
                        text(c, "displayName"),
                        text(c, "audience"),
                        text(c, "wechatAppId"),
                        c.path("disabled").asBoolean(false),
                        c.path("publicClient").asBoolean(false),
                        strings(c.path("grants")),
                        strings(c.path("scopes")),
                        strings(c.path("redirectUris")),
                        text(c, "lastTokenAt"),
                        c.path("tokens7d").isNumber() ? c.path("tokens7d").asLong() : null));
            }
            products.add(new IdentityProductRow(text(p, "productCode"), text(p, "displayName"), clients));
        }
        return new IdentityClientOverview(
                null, true, issuer, Instant.now().toString(),
                text(data, "generatedAt"),
                data.path("activityAvailable").asBoolean(false),
                data.path("productCount").asInt(products.size()),
                data.path("clientCount").asInt(0),
                products);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNull() || value.isMissingNode() || value.asText().isBlank() ? null : value.asText();
    }

    private static List<String> strings(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(v -> out.add(v.asText()));
        return out;
    }

    // ----------------------------------------------------------------- token

    /** {@code client_credentials} 令牌，进程内缓存到过期前 60 秒。 */
    private String accessToken() {
        String token = cachedToken;
        if (token != null && Instant.now().isBefore(cachedTokenExpiry)) return token;
        synchronized (this) {
            if (cachedToken != null && Instant.now().isBefore(cachedTokenExpiry)) return cachedToken;
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("grant_type", "client_credentials");
            form.add("scope", SCOPE_CLIENTS_READ);
            String basic = Base64.getEncoder().encodeToString(
                    (props.getAdminClientId() + ":" + props.getAdminClientSecret())
                            .getBytes(StandardCharsets.UTF_8));
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
}
