package com.aistareco.aep.service.ai;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelUsageService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * 共享原语 {@link UpstreamModelHttp} 行为测试（确定性、无外网、无 Spring 上下文）。
 *
 * 用 JDK 内置 com.sun.net.httpserver 起本地 stub，验证：
 * 2xx 返回 resp 且不落用量、非 2xx 返回 resp + best-effort 落失败用量、network error → UpstreamCallException、
 * recordFailureUsage=false 时不落、显式归属走 withAttribution、recordBadOutput 落库、IOException 重试耗尽。
 * {@link AiModelUsageService} 用 Mockito mock（用量是 best-effort 旁路，verify 落库形态即可）。
 */
class UpstreamModelHttpTest {

    private final List<StubServer> servers = new ArrayList<>();

    @AfterEach
    void stopServers() {
        for (StubServer s : servers) s.close();
        servers.clear();
    }

    private StubServer stub(int status, String body) throws IOException {
        StubServer s = new StubServer(status, body);
        servers.add(s);
        return s;
    }

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();

    private static HttpRequest post(String url, String body) {
        return HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
    }

    private static ModelCallCtx.Builder ctx(AiModelUsageService usage) {
        return ModelCallCtx.builder(AiModelPurpose.GENERAL)
                .endpoint("ep1", "stub-ep")
                .model("m")
                .requestId("req-1")
                .client(CLIENT);
    }

    @Test
    void success_returnsResponseWithoutRecordingUsage() throws Exception {
        AiModelUsageService usage = mock(AiModelUsageService.class);
        UpstreamModelHttp http = new UpstreamModelHttp(usage);
        StubServer server = stub(200, "{\"ok\":true}");

        HttpResponse<String> resp = http.sendJson(post(server.url(), "{}"), ctx(usage).build());

        assertEquals(200, resp.statusCode());
        assertTrue(resp.body().contains("ok"));
        // 成功路径不落用量（token / 计费单位由调用方各自记录）。
        verifyNoInteractions(usage);
    }

    @Test
    void non2xx_returnsResponseAndRecordsFailureUsage() throws Exception {
        AiModelUsageService usage = mock(AiModelUsageService.class);
        UpstreamModelHttp http = new UpstreamModelHttp(usage);
        StubServer server = stub(500, "{\"error\":\"boom\"}");

        HttpResponse<String> resp = http.sendJson(post(server.url(), "{}"), ctx(usage).build());

        // 不抛异常：返回 resp 供调用方按自己的错误码处理。
        assertEquals(500, resp.statusCode());
        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> respBody = ArgumentCaptor.forClass(String.class);
        verify(usage, times(1)).recordObserved(
                eq("ep1"), eq("stub-ep"), eq("m"), eq("GENERAL"),
                any(), any(), any(), eq(false),
                eq("req-1"), any(), any(),
                code.capture(), any(),
                any(), respBody.capture(),
                any());
        assertEquals("HTTP_500", code.getValue());
        assertTrue(respBody.getValue().contains("boom"), "失败应落上游原始响应体");
    }

    @Test
    void non2xx_withRecordFailureUsageFalse_skipsRecording() throws Exception {
        AiModelUsageService usage = mock(AiModelUsageService.class);
        UpstreamModelHttp http = new UpstreamModelHttp(usage);
        StubServer server = stub(503, "{\"error\":\"down\"}");

        HttpResponse<String> resp = http.sendJson(post(server.url(), "{}"),
                ctx(usage).recordFailureUsage(false).build());

        assertEquals(503, resp.statusCode());
        verifyNoInteractions(usage);
    }

    @Test
    void non2xx_withAttribution_usesAttributedRecorder() throws Exception {
        AiModelUsageService usage = mock(AiModelUsageService.class);
        UpstreamModelHttp http = new UpstreamModelHttp(usage);
        StubServer server = stub(429, "{\"error\":\"rate\"}");

        http.sendJson(post(server.url(), "{}"),
                ctx(usage).ownerUserId("u-1").appCode("drama").build());

        verify(usage, times(1)).recordObservedWithAttribution(
                eq("ep1"), eq("stub-ep"), eq("m"), eq("GENERAL"),
                any(), any(), any(), eq(false),
                eq("u-1"), any(), eq("drama"),
                eq("req-1"), any(), any(),
                eq("HTTP_429"), any(),
                any(), any(), any());
        // 显式归属时不应再走 servlet 归属 overload。
        verify(usage, never()).recordObserved(
                any(), any(), any(), any(), any(), any(), any(), eq(false),
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void networkError_throwsUpstreamCallExceptionAndRecordsFailure() {
        AiModelUsageService usage = mock(AiModelUsageService.class);
        UpstreamModelHttp http = new UpstreamModelHttp(usage);
        // 指向一个未监听端口 → 连接被拒（ConnectException，属 IOException，非超时）。
        HttpRequest req = post("http://127.0.0.1:1/v1/x", "{}");

        UpstreamCallException ex = assertThrows(UpstreamCallException.class,
                () -> http.sendJson(req, ctx(usage).build()));
        assertFalse(ex.isTimeout());
        verify(usage, times(1)).recordObserved(
                eq("ep1"), any(), any(), any(), any(), any(), any(), eq(false),
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void networkError_retriesAndRecordsFailureOnceAfterExhaustion() {
        AiModelUsageService usage = mock(AiModelUsageService.class);
        UpstreamModelHttp http = new UpstreamModelHttp(usage);
        HttpRequest req = post("http://127.0.0.1:1/v1/x", "{}");

        assertThrows(UpstreamCallException.class,
                () -> http.sendJson(req, ctx(usage).maxAttempts(2).retryBackoffMs(1L).build()));
        // 重试 2 次都失败 → 只在耗尽后落一条失败用量（每次尝试不重复记）。
        verify(usage, times(1)).recordObserved(
                any(), any(), any(), any(), any(), any(), any(), eq(false),
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void recordBadOutput_recordsFailureWithGivenCode() {
        AiModelUsageService usage = mock(AiModelUsageService.class);
        UpstreamModelHttp http = new UpstreamModelHttp(usage);

        http.recordBadOutput(ctx(usage).build(), "{\"weird\":1}", "AI_BAD_OUTPUT", 12L);

        verify(usage, times(1)).recordObserved(
                eq("ep1"), eq("stub-ep"), eq("m"), eq("GENERAL"),
                any(), any(), any(), eq(false),
                eq("req-1"), any(), eq(12L),
                eq("AI_BAD_OUTPUT"), any(),
                any(), any(),
                any());
    }

    /** JDK 内置 HTTP server：对任意路径返回预设 status + body。 */
    static final class StubServer implements AutoCloseable {
        private final HttpServer server;
        private final int port;

        StubServer(int status, String body) throws IOException {
            this.server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            this.port = server.getAddress().getPort();
            byte[] out = body.getBytes(StandardCharsets.UTF_8);
            server.createContext("/", exchange -> {
                exchange.getRequestBody().readAllBytes();
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(status, out.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(out);
                }
            });
            server.start();
        }

        String url() {
            return "http://127.0.0.1:" + port + "/v1/x";
        }

        @Override
        public void close() {
            server.stop(0);
        }
    }
}
