package com.aistareco.aep.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 跨模块 JSON 契约：账号中心（独立仓库 {@code pokocat/aibuzz-id}）实际返回的响应壳，本仓必须认得。
 *
 * <p>为什么单独一个测试：P2 上线前 {@code IdentityCenterClient} 只认「顶层裸数组」，
 * 而 {@code OutboxController} / {@code ImportController} 返回的是
 * {@code {success:true,data:{events|results:[…]}}} —— 解析不出来时**静默返回空列表**，
 * 于是「轮询永远 0 条、导入永远说成功」，两边都不报错。
 * 下面的 JSON 字符串是从那两个 controller 的 record 定义与 javadoc 里逐字段抄下来的，
 * 任何一边改了形状，这个测试就该红。</p>
 */
class IdentityCenterEnvelopeContractTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static JsonNode json(String raw) {
        try {
            return MAPPER.readTree(raw);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // ── outbox：GET /api/products/{product}/outbox ────────────────────────────

    /**
     * {@code OutboxController.OutboxPage} + {@code ApiResponse.ok(...)} 的真实形状。
     * 事件字段：{@code {id, eventType, uid, productCode, payload, createdAt}}；
     * {@code payload} 出 wire 已经是对象（controller 里 {@code parsePayload} 解过一次）。
     */
    private static final String OUTBOX_RESPONSE = """
            {
              "success": true,
              "data": {
                "events": [
                  {
                    "id": 41,
                    "eventType": "USER_MERGED",
                    "uid": "u_a1b2c3",
                    "productCode": "aistar",
                    "payload": {"fromUid": "u_a1b2c3", "toUid": "u_d4e5f6", "product": "aistar"},
                    "createdAt": "2026-09-04T03:21:44.512Z"
                  },
                  {
                    "id": 42,
                    "eventType": "USER_CLOSED",
                    "uid": "u_z9y8x7",
                    "productCode": null,
                    "payload": {"uid": "u_z9y8x7", "closedAt": "2026-09-04T03:30:00Z"},
                    "createdAt": "2026-09-04T03:30:00.004Z"
                  },
                  {
                    "id": 43,
                    "eventType": "PHONE_CHANGED",
                    "uid": "u_p0p0p0",
                    "productCode": null,
                    "payload": null,
                    "createdAt": "2026-09-04T03:31:00.004Z"
                  }
                ],
                "nextAfter": 43
              }
            }
            """;

    @Test
    void parsesTheRealOutboxEnvelope() {
        List<IdentityCenterClient.OutboxEvent> events =
                IdentityCenterClient.parseOutbox(json(OUTBOX_RESPONSE));

        assertThat(events).hasSize(3);

        var merged = events.get(0);
        assertThat(merged.id()).isEqualTo(41L);
        assertThat(merged.eventType()).isEqualTo(IdentityOutboxHandler.EVENT_USER_MERGED);
        assertThat(merged.uid()).isEqualTo("u_a1b2c3");
        assertThat(merged.payload().path("fromUid").asText()).isEqualTo("u_a1b2c3");
        assertThat(merged.payload().path("toUid").asText()).isEqualTo("u_d4e5f6");

        var closed = events.get(1);
        assertThat(closed.eventType()).isEqualTo(IdentityOutboxHandler.EVENT_USER_CLOSED);
        assertThat(closed.payload().path("uid").asText()).isEqualTo("u_z9y8x7");

        // payload 允许为 null（controller 在 payload 不是合法 JSON 时会投递一条无细节的事件）
        assertThat(events.get(2).payload()).isNull();
    }

    @Test
    void emptyOutboxPageIsNotAnError() {
        assertThat(IdentityCenterClient.parseOutbox(
                json("{\"success\":true,\"data\":{\"events\":[],\"nextAfter\":17}}"))).isEmpty();
    }

    @Test
    void unrecognisedOutboxShapeThrowsInsteadOfReturningEmpty() {
        // 这几种以前都会被静默当成「0 条事件」
        assertThatThrownBy(() -> IdentityCenterClient.parseOutbox(json("{\"data\":{\"rows\":[]}}")))
                .isInstanceOf(IdentityCenterException.class)
                .hasMessageContaining("不符合契约");
        assertThatThrownBy(() -> IdentityCenterClient.parseOutbox(json("{\"ok\":true}")))
                .isInstanceOf(IdentityCenterException.class);
        assertThatThrownBy(() -> IdentityCenterClient.parseOutbox(null))
                .isInstanceOf(IdentityCenterException.class);
    }

    @Test
    void failedOutboxEnvelopeThrows() {
        assertThatThrownBy(() -> IdentityCenterClient.parseOutbox(json("""
                {"success":false,"error":{"code":"PRODUCT_CLIENT_MISMATCH","message":"客户端与产品不一致"}}
                """)))
                .isInstanceOf(IdentityCenterException.class)
                .hasMessageContaining("success=false");
    }

    @Test
    void outboxEventWithoutIdThrows() {
        // 没有 id 就无法推进游标，也无法去重 —— 不能只跳过这一条继续
        assertThatThrownBy(() -> IdentityCenterClient.parseOutbox(json("""
                {"success":true,"data":{"events":[{"eventType":"USER_CLOSED","uid":"u1"}],"nextAfter":0}}
                """)))
                .isInstanceOf(IdentityCenterException.class)
                .hasMessageContaining("缺少 id");
    }

    @Test
    void bareArrayStillParses_forSimpleStubs() {
        List<IdentityCenterClient.OutboxEvent> events = IdentityCenterClient.parseOutbox(json("""
                [{"id":9,"eventType":"USER_CLOSED","uid":"u1","payload":{"uid":"u1"}}]
                """));
        assertThat(events).hasSize(1);
        assertThat(events.get(0).id()).isEqualTo(9L);
    }

    // ── import：POST /api/products/{product}/import-users ─────────────────────

    /** {@code ImportController.ImportSummaryView}；{@code skipped} 只有被跳过时才出现。 */
    private static final String IMPORT_RESPONSE = """
            {
              "success": true,
              "data": {
                "results": [
                  {"localSubjectId": "1001", "uid": "u_new001", "created": true},
                  {"localSubjectId": "1002", "uid": "u_old002", "created": false},
                  {"localSubjectId": "1003", "created": false, "skipped": "ACCOUNT_CLOSED"}
                ],
                "created": 1,
                "linked": 1,
                "skipped": 1
              }
            }
            """;

    @Test
    void parsesTheRealImportEnvelope() {
        List<IdentityCenterClient.ImportResultItem> results =
                IdentityCenterClient.parseImport(json(IMPORT_RESPONSE));

        assertThat(results).hasSize(3);
        assertThat(results.get(0))
                .isEqualTo(new IdentityCenterClient.ImportResultItem("1001", "u_new001", true, null));
        assertThat(results.get(1))
                .isEqualTo(new IdentityCenterClient.ImportResultItem("1002", "u_old002", false, null));
        assertThat(results.get(2))
                .isEqualTo(new IdentityCenterClient.ImportResultItem("1003", null, false, "ACCOUNT_CLOSED"));
    }

    @Test
    void unrecognisedImportShapeThrows() {
        assertThatThrownBy(() -> IdentityCenterClient.parseImport(json("{\"data\":{\"items\":[]}}")))
                .isInstanceOf(IdentityCenterException.class)
                .hasMessageContaining("不符合契约");
        assertThatThrownBy(() -> IdentityCenterClient.parseImport(json("""
                {"success":true,"data":{"results":[{"uid":"u1","created":true}]}}
                """)))
                .isInstanceOf(IdentityCenterException.class)
                .hasMessageContaining("localSubjectId");
    }

    // ───────────────────────────────────────────── 应用接入全景（v0.195）

    /**
     * 账号中心 {@code GET /api/admin/clients} 的响应壳（那边 {@code ClientOverviewService} 的三个 record）。
     * 下面这段是从它的 README §19.2 示例逐字段抄的，任何一边改形状这里就该红。
     */
    private static final String CLIENTS_ENVELOPE = """
            {"success":true,"data":{
              "generatedAt":"2026-09-09T16:57:00Z",
              "activityAvailable":true,
              "productCount":1,
              "clientCount":2,
              "products":[{"productCode":"aistar","displayName":"AI Star","clients":[
                {"clientId":"web-music","displayName":"AI 音乐人","audience":"aistar-api",
                 "wechatAppId":null,"disabled":false,"publicClient":true,
                 "grants":["authorization_code","refresh_token"],
                 "scopes":["offline_access","openid"],
                 "redirectUris":["https://music.aibuzz.cn/auth/callback"],
                 "lastTokenAt":"2026-09-06T07:08:41Z","tokens7d":2},
                {"clientId":"aistar-server","displayName":"AI Star Eco 后端","audience":"id-api",
                 "wechatAppId":null,"disabled":false,"publicClient":false,
                 "grants":["client_credentials"],"scopes":["product.link"],
                 "redirectUris":[],"lastTokenAt":null,"tokens7d":null}
              ]}]}}
            """;

    @Test
    void clientOverviewEnvelopeIsUnderstood() {
        IdentityAdminClient.IdentityClientOverview view =
                IdentityAdminClient.parse(json(CLIENTS_ENVELOPE), "https://id.aibuzz.cn");

        assertThat(view.error()).isNull();
        assertThat(view.activityAvailable()).isTrue();
        assertThat(view.clientCount()).isEqualTo(2);
        assertThat(view.products()).hasSize(1);

        var clients = view.products().get(0).clients();
        assertThat(clients).hasSize(2);
        assertThat(clients.get(0).clientId()).isEqualTo("web-music");
        assertThat(clients.get(0).publicClient()).isTrue();
        assertThat(clients.get(0).tokens7d()).isEqualTo(2L);
        assertThat(clients.get(0).redirectUris()).containsExactly("https://music.aibuzz.cn/auth/callback");
        // 「从没换过令牌」是 null，不是 0 —— 页面据此显示「从未」而不是「近 7 天 0 次」。
        assertThat(clients.get(1).lastTokenAt()).isNull();
        assertThat(clients.get(1).tokens7d()).isNull();
    }

    /**
     * 活跃度不可用时两列必须是 null。
     *
     * <p>账号中心那边聚合失败是允许的（观测类旁路），但它一定会把
     * {@code activityAvailable=false} 带过来 —— 我方不能把 null 渲染成 0，
     * 那会让「统计没取到」看起来像「这个客户端从没被用过」。
     */
    @Test
    void activityUnavailableKeepsColumnsNull() {
        IdentityAdminClient.IdentityClientOverview view = IdentityAdminClient.parse(json("""
                {"success":true,"data":{"generatedAt":"2026-09-09T16:57:00Z","activityAvailable":false,
                 "productCount":1,"clientCount":1,
                 "products":[{"productCode":"aistar","displayName":"AI Star","clients":[
                   {"clientId":"web-music","displayName":null,"audience":null,"wechatAppId":null,
                    "disabled":false,"publicClient":true,"grants":[],"scopes":[],"redirectUris":[],
                    "lastTokenAt":null,"tokens7d":null}]}]}}
                """), "https://id.aibuzz.cn");

        assertThat(view.activityAvailable()).isFalse();
        assertThat(view.products().get(0).clients().get(0).tokens7d()).isNull();
    }

    /** 壳不认识 = 配置或版本对不上，必须抛，不能当成「一个客户端都没有」。 */
    @Test
    void unknownClientOverviewEnvelopeThrows() {
        assertThatThrownBy(() -> IdentityAdminClient.parse(json("[]"), "https://id.aibuzz.cn"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> IdentityAdminClient.parse(
                json("{\"success\":false,\"error\":{\"code\":\"ADMIN_SCOPE_MISSING\"}}"),
                "https://id.aibuzz.cn"))
                .isInstanceOf(IllegalStateException.class);
    }
}
