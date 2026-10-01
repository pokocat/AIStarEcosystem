package com.aistareco.aep.service.materialvideo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.http.HttpHeaders;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 智能优化遇到 409 / 429 时听厂商的重试建议：聚算文档写的是「Retry-After 或正文中的轮询建议」，
 * 两种都会出现。只认头的话，厂商把建议放在正文里时我们会按自己的退避乱猜。
 */
class MaterialVideoModelClientRetryHintTest {

    @SuppressWarnings("unchecked")
    private static HttpResponse<String> resp(Map<String, List<String>> headers, String body) {
        HttpResponse<String> r = mock(HttpResponse.class);
        when(r.headers()).thenReturn(HttpHeaders.of(headers, (a, b) -> true));
        when(r.body()).thenReturn(body);
        return r;
    }

    @Test
    @DisplayName("先认 Retry-After 头（秒）")
    void headerWins() {
        assertEquals(3000L, MaterialVideoModelClient.retryAfterMs(
                resp(Map.of("Retry-After", List.of("3")), "{\"retryAfterSeconds\":9}")));
    }

    @Test
    @DisplayName("没有头就看正文：顶层、error 下、error.details 下的 retryAfterSeconds")
    void bodyHint() {
        assertEquals(1000L, MaterialVideoModelClient.retryAfterMs(resp(Map.of(),
                "{\"code\":\"optimization_in_progress\",\"retryAfterSeconds\":1}")));
        assertEquals(2500L, MaterialVideoModelClient.retryAfterMs(resp(Map.of(),
                "{\"error\":{\"code\":\"rate_limited\",\"retryAfterSeconds\":2.5}}")));
        assertEquals(4000L, MaterialVideoModelClient.retryAfterMs(resp(Map.of(),
                "{\"error\":{\"details\":{\"retryAfterSeconds\":4}}}")));
    }

    @Test
    @DisplayName("日期形态的头、没有建议、正文不是 JSON → null（退回指数退避）")
    void noHint() {
        assertNull(MaterialVideoModelClient.retryAfterMs(
                resp(Map.of("Retry-After", List.of("Wed, 30 Sep 2026 10:00:00 GMT")), "{}")));
        assertNull(MaterialVideoModelClient.retryAfterMs(resp(Map.of(), "{\"code\":\"busy\"}")));
        assertNull(MaterialVideoModelClient.retryAfterMs(resp(Map.of(), "<html>busy</html>")));
        assertNull(MaterialVideoModelClient.retryAfterMs(resp(Map.of(), null)));
    }
}
