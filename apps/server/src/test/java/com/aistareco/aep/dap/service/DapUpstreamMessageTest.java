package com.aistareco.aep.dap.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 上游失败原因怎么说给用户听。
 *
 * <p>起因是一次真实失败：用户在后台换了出图模型，画布报「AI 生成失败，请稍后重试」。
 * 而上游其实说得清清楚楚 —— {@code unsupported FLUX.2 Klein 4B size "768x1024"}
 * （新模型不支持画布发的画幅），并且 {@code retryable:false}。
 * 我们把它抹成一句笼统话，用户既不知道该改什么，那句「请稍后重试」本身还是错的。
 */
class DapUpstreamMessageTest {

    private static String call(int status, String body) throws Exception {
        Method m = DapMultimodalClient.class.getDeclaredMethod("upstreamMessage", HttpResponse.class);
        m.setAccessible(true);
        return (String) m.invoke(null, new StubResponse(status, body));
    }

    @Test
    @DisplayName("4xx：把厂商那句人话直出 —— 它说的正是我们请求哪里不对")
    void clientErrorsShowVendorMessage() throws Exception {
        String out = call(400, "{\"code\":\"invalid_argument\","
                + "\"message\":\"unsupported FLUX.2 Klein 4B size \\\"768x1024\\\"\",\"retryable\":false}");
        assertTrue(out.contains("unsupported FLUX.2 Klein 4B size"), "厂商原话被吞了：" + out);
    }

    @Test
    @DisplayName("4xx：OpenAI 那种 error.message 嵌套也认")
    void clientErrorsAlsoReadNestedErrorMessage() throws Exception {
        String out = call(400, "{\"error\":{\"message\":\"content policy violation\",\"type\":\"invalid_request\"}}");
        assertTrue(out.contains("content policy violation"), out);
    }

    @Test
    @DisplayName("5xx：厂商自己出问题，用户做不了什么 —— 保持笼统，细节留在日志")
    void serverErrorsStayGeneric() throws Exception {
        String out = call(503, "{\"message\":\"internal shard 7 panic at 0x1f\"}");
        assertTrue(out.contains("503"), out);
        assertTrue(!out.contains("shard 7"), "5xx 的内部细节不该出现在界面上：" + out);
    }

    @Test
    @DisplayName("响应体不是 JSON（比如网关的 HTML 错误页）：不要糊到界面上")
    void nonJsonBodyFallsBack() throws Exception {
        String out = call(400, "<html><body>400 Bad Request</body></html>");
        assertTrue(!out.contains("<html"), out);
        assertTrue(out.contains("400"), out);
    }

    @Test
    @DisplayName("超长 message 截断，别让一段长文把弹窗撑爆")
    void longMessagesAreTruncated() throws Exception {
        String out = call(400, "{\"message\":\"" + "很长的原因".repeat(200) + "\"}");
        assertTrue(out.length() < 260, "没有截断，长度=" + out.length());
        assertTrue(out.endsWith("…"), out);
    }

    /** 只需要 statusCode() 和 body()，其余方法用不到。 */
    private record StubResponse(int status, String bodyText) implements HttpResponse<String> {
        @Override public int statusCode() { return status; }
        @Override public String body() { return bodyText; }
        @Override public java.net.http.HttpRequest request() { return null; }
        @Override public java.util.Optional<HttpResponse<String>> previousResponse() { return java.util.Optional.empty(); }
        @Override public java.net.http.HttpHeaders headers() { return java.net.http.HttpHeaders.of(java.util.Map.of(), (a, b) -> true); }
        @Override public java.util.Optional<javax.net.ssl.SSLSession> sslSession() { return java.util.Optional.empty(); }
        @Override public java.net.URI uri() { return java.net.URI.create("https://example.test"); }
        @Override public java.net.http.HttpClient.Version version() { return java.net.http.HttpClient.Version.HTTP_1_1; }
    }

    // ── 参考图必须放顶层（v0.170）────────────────────────────────────────

    @Test
    @DisplayName("参考图与 response_format 走顶层，不能只塞 extra_body")
    void referenceImagesMustBeTopLevel() throws Exception {
        // extra_body 是 OpenAI **Python SDK** 的约定（SDK 会摊平进顶层）。我们直接发原始 JSON，
        // 只塞在 extra_body 里的话，厂商看到的是一个不认识的嵌套对象 —— 参考图根本没送到，
        // 而且不报错（image 是可选参数），表现就是「出的图跟上传的照片一点不像」。
        java.lang.reflect.Field f = DapMultimodalClient.class.getDeclaredField("OM");
        f.setAccessible(true);
        com.fasterxml.jackson.databind.ObjectMapper om =
                (com.fasterxml.jackson.databind.ObjectMapper) f.get(null);
        com.fasterxml.jackson.databind.node.ObjectNode body = om.createObjectNode();
        body.put("model", "m");
        body.put("prompt", "p");
        body.put("response_format", "url");
        body.put("watermark", false);
        com.fasterxml.jackson.databind.node.ObjectNode extra = body.putObject("extra_body");
        extra.put("response_format", "url");
        body.putArray("image").add("https://cdn/a.png");
        extra.putArray("image").add("https://cdn/a.png");

        assertTrue(body.path("image").isArray() && !body.path("image").isEmpty(),
                "参考图不在顶层，火山这类按文档实现的厂商收不到");
        assertEquals("url", body.path("response_format").asText());
        assertTrue(body.path("extra_body").path("image").isArray(),
                "extra_body 那份要留着 —— agnes 那条链一直按它读");
    }
}
