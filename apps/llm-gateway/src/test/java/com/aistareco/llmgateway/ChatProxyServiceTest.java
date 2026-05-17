package com.aistareco.llmgateway;

import com.aistareco.llmgateway.config.GatewayProperties;
import com.aistareco.llmgateway.config.WebClientConfig;
import com.aistareco.llmgateway.service.ChatProxyService;
import com.aistareco.llmgateway.service.UsageReporter;
import com.aistareco.llmgateway.upstream.Upstream;
import com.aistareco.llmgateway.upstream.UpstreamRegistry;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 验证：网关把 Authorization 替换为 upstream 的 apiKey，body 透传，stream/非流式分流。
 * 用 OkHttp MockWebServer 模拟火山 / 千问的 OpenAI 兼容端点。
 */
class ChatProxyServiceTest {

    private MockWebServer mockUpstream;
    private ChatProxyService proxy;

    @BeforeEach
    void setUp() throws Exception {
        mockUpstream = new MockWebServer();
        mockUpstream.start();

        Upstream up = new Upstream(
                "mock-volc",
                "VOLCENGINE",
                mockUpstream.url("/").toString().replaceAll("/$", ""),
                "test-ark-key",
                List.of("doubao-"),
                true
        );
        UpstreamRegistry registry = new UpstreamRegistry(null) {
            @Override public Optional<Upstream> findForModel(String model) {
                return up.matches(model) ? Optional.of(up) : Optional.empty();
            }
        };
        WebClient.Builder builder = new WebClientConfig().upstreamWebClientBuilder();
        GatewayProperties props = new GatewayProperties();
        UsageReporter reporter = new UsageReporter(props, builder);
        proxy = new ChatProxyService(registry, builder, reporter);
    }

    @AfterEach
    void tearDown() throws Exception {
        mockUpstream.shutdown();
    }

    @Test
    void nonStream_replacesAuth_andProxiesBody() throws Exception {
        mockUpstream.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody("{\"id\":\"cmpl-x\",\"choices\":[{\"message\":{\"content\":\"hi\"}}]}"));

        Map<String, Object> body = Map.of(
                "model", "doubao-1-5-pro-32k",
                "messages", List.of(Map.of("role", "user", "content", "你好"))
        );

        ResponseEntity<String> resp = proxy.forwardNonStream(body, null, "test-1").block();

        assertThat(resp).isNotNull();
        assertThat(resp.getStatusCode().value()).isEqualTo(200);
        assertThat(resp.getBody()).contains("\"content\":\"hi\"");

        RecordedRequest req = mockUpstream.takeRequest();
        assertThat(req.getPath()).isEqualTo("/chat/completions");
        assertThat(req.getHeader("Authorization")).isEqualTo("Bearer test-ark-key");
        assertThat(req.getBody().readUtf8()).contains("\"model\":\"doubao-1-5-pro-32k\"");
    }

    @Test
    void stream_emitsChunks() throws Exception {
        mockUpstream.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/event-stream")
                .setBody("data: {\"choices\":[{\"delta\":{\"content\":\"a\"}}]}\n\n"
                        + "data: {\"choices\":[{\"delta\":{\"content\":\"b\"}}]}\n\n"
                        + "data: [DONE]\n\n"));

        Map<String, Object> body = Map.of(
                "model", "doubao-1-5-pro-32k",
                "stream", true,
                "messages", List.of(Map.of("role", "user", "content", "hi"))
        );

        Flux<String> chunks = proxy.forwardStream(body, null, "test-2");

        StepVerifier.create(chunks)
                .expectNextMatches(s -> s.contains("\"content\":\"a\""))
                .expectNextMatches(s -> s.contains("\"content\":\"b\""))
                .expectNextMatches(s -> s.contains("[DONE]"))
                .verifyComplete();
    }

    @Test
    void unknownModel_throws() {
        Map<String, Object> body = Map.of(
                "model", "unknown-model",
                "messages", List.of(Map.of("role", "user", "content", "hi"))
        );
        try {
            proxy.forwardNonStream(body, null, "test-3").block();
        } catch (IllegalArgumentException e) {
            assertThat(e.getMessage()).contains("unknown-model");
            return;
        }
        throw new AssertionError("expected IllegalArgumentException");
    }
}
