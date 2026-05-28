package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelProvider;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiModelProviderRepository;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * AiModelInvocationService 调用链集成测试（确定性、无外网、无 Spring 上下文）。
 *
 * 用 JDK 内置 com.sun.net.httpserver 起本地 OpenAI 兼容 stub，验证 service 真实发出的
 * HTTP 请求形态（Authorization=Bearer <解密后的 apiKey> + model / messages / temperature /
 * max_tokens body）、响应解析、provider 选取（purpose 过滤 + priority 顺序）、5xx fallback、
 * 4xx 直抛、非 OpenAI 类型 501。
 *
 * repo 用 Mockito stub —— AiModelProviderRepository 是 JpaRepository，方法太多不便手撸 fake；
 * 这两个方法（findByEnabledTrueOrderByPriorityAsc / findById）是 service 仅有的两个 DB 依赖。
 */
class AiModelInvocationServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();

    /** 一个标准的 OpenAI /chat/completions 成功响应。 */
    private static final String CHAT_OK = """
            {
              "id": "chatcmpl-stub-1",
              "object": "chat.completion",
              "choices": [
                {"index": 0, "message": {"role": "assistant", "content": "你好，我是测试回答。"}, "finish_reason": "stop"}
              ],
              "usage": {"prompt_tokens": 10, "completion_tokens": 32, "total_tokens": 42}
            }
            """;

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

    private static AiModelProvider provider(String id, String baseUrl, int priority,
                                            AiModelProviderType type, List<String> purposes,
                                            String defaultModel, String plaintextKey) {
        return AiModelProvider.builder()
                .id(id)
                .name("stub-" + id)
                .providerType(type)
                .baseUrl(baseUrl)
                .apiKeyEncrypted(AepCryptoUtil.encrypt(plaintextKey))
                .defaultModel(defaultModel)
                .purposes(purposes)
                .priority(priority)
                .enabled(true)
                .build();
    }

    @Test
    void invokeChatBuildsRequestAndParsesResponse() throws Exception {
        StubServer server = stub(200, CHAT_OK);
        AiModelProvider p = provider("p1", server.baseUrl(), 10,
                AiModelProviderType.OPENAI_COMPATIBLE, List.of("SCRIPT_DRAFT"),
                "default-model", "sk-secret-123");

        AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
        when(repo.findByEnabledTrueOrderByPriorityAsc()).thenReturn(List.of(p));

        AiModelInvocationService.AiModelResponse resp = new AiModelInvocationService(repo).invokeChat(
                AiModelPurpose.SCRIPT_DRAFT,
                List.of(Map.of("role", "system", "content", "你是助手"),
                        Map.of("role", "user", "content", "讲个笑话")),
                Map.of("model", "override-model", "temperature", 0.7, "max_tokens", 256));

        // ── 响应解析 ──
        assertEquals("你好，我是测试回答。", resp.content());
        assertEquals("stop", resp.finishReason());
        assertEquals(42L, resp.tokensUsed().longValue());
        assertEquals("stub-p1", resp.providerUsed());
        assertEquals("override-model", resp.modelUsed());

        // ── 真实发出的请求形态 ──
        assertEquals(1, server.requests.size());
        StubServer.Recorded r = server.requests.get(0);
        assertEquals("POST", r.method());
        assertEquals("/v1/chat/completions", r.path());
        assertEquals("Bearer sk-secret-123", r.authorization(), "Bearer 头应为解密后的 apiKey");
        Map<?, ?> sent = OM.readValue(r.body(), Map.class);
        assertEquals("override-model", sent.get("model"));
        assertEquals(0.7, ((Number) sent.get("temperature")).doubleValue(), 1e-9);
        assertEquals(256, ((Number) sent.get("max_tokens")).intValue());
        assertTrue(sent.get("messages") instanceof List<?>);
        assertEquals(2, ((List<?>) sent.get("messages")).size());
    }

    @Test
    void invokeChatUsesProviderDefaultModelWhenOptionsOmitModel() throws Exception {
        StubServer server = stub(200, CHAT_OK);
        AiModelProvider p = provider("p1", server.baseUrl(), 10,
                AiModelProviderType.OPENAI, List.of("GENERAL"),
                "doubao-1-5-pro-32k", "sk-x");
        AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
        when(repo.findByEnabledTrueOrderByPriorityAsc()).thenReturn(List.of(p));

        AiModelInvocationService.AiModelResponse resp = new AiModelInvocationService(repo).invokeChat(
                AiModelPurpose.GENERAL,
                List.of(Map.of("role", "user", "content", "hi")),
                null);

        assertEquals("doubao-1-5-pro-32k", resp.modelUsed());
        Map<?, ?> sent = OM.readValue(server.requests.get(0).body(), Map.class);
        assertEquals("doubao-1-5-pro-32k", sent.get("model"));
        assertFalse(sent.containsKey("temperature"), "options 为 null 时不应带 temperature");
        assertFalse(sent.containsKey("max_tokens"), "options 为 null 时不应带 max_tokens");
    }

    @Test
    void purposeFilterExcludesNonMatchingProviders() {
        // provider 只挂 GENERAL；请求 SCRIPT_DRAFT → 无候选 → 503 NO_PROVIDER（不发 HTTP）。
        AiModelProvider p = provider("p1", "http://127.0.0.1:1/v1", 10,
                AiModelProviderType.OPENAI, List.of("GENERAL"), "m", "sk-x");
        AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
        when(repo.findByEnabledTrueOrderByPriorityAsc()).thenReturn(List.of(p));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                new AiModelInvocationService(repo).invokeChat(
                        AiModelPurpose.SCRIPT_DRAFT,
                        List.of(Map.of("role", "user", "content", "hi")), null));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        assertEquals("NO_PROVIDER", ex.getCode());
    }

    @Test
    void fallsBackToNextProviderOn5xx() throws Exception {
        StubServer bad = stub(500, "{\"error\":\"boom\"}");
        StubServer good = stub(200, CHAT_OK);
        AiModelProvider p1 = provider("p1", bad.baseUrl(), 10,
                AiModelProviderType.OPENAI, List.of("GENERAL"), "m1", "sk-1");
        AiModelProvider p2 = provider("p2", good.baseUrl(), 20,
                AiModelProviderType.OPENAI, List.of("GENERAL"), "m2", "sk-2");
        AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
        // repo 方法名语义即「按 priority 升序」；service 不再二次排序，照原顺序消费。
        when(repo.findByEnabledTrueOrderByPriorityAsc()).thenReturn(List.of(p1, p2));

        AiModelInvocationService.AiModelResponse resp = new AiModelInvocationService(repo).invokeChat(
                AiModelPurpose.GENERAL,
                List.of(Map.of("role", "user", "content", "hi")), null);

        assertEquals("你好，我是测试回答。", resp.content());
        assertEquals("stub-p2", resp.providerUsed(), "5xx 应回退到下一个 provider");
        assertEquals(1, bad.requests.size(), "首个 provider 被尝试");
        assertEquals(1, good.requests.size(), "回退 provider 被尝试");
    }

    @Test
    void doesNotFallBackOn4xx() throws Exception {
        StubServer bad = stub(400, "{\"error\":\"bad request\"}");
        StubServer never = stub(200, CHAT_OK);
        AiModelProvider p1 = provider("p1", bad.baseUrl(), 10,
                AiModelProviderType.OPENAI, List.of("GENERAL"), "m1", "sk-1");
        AiModelProvider p2 = provider("p2", never.baseUrl(), 20,
                AiModelProviderType.OPENAI, List.of("GENERAL"), "m2", "sk-2");
        AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
        when(repo.findByEnabledTrueOrderByPriorityAsc()).thenReturn(List.of(p1, p2));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                new AiModelInvocationService(repo).invokeChat(
                        AiModelPurpose.GENERAL,
                        List.of(Map.of("role", "user", "content", "hi")), null));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("AI_PROVIDER_HTTP_400", ex.getCode());
        assertEquals(1, bad.requests.size());
        assertEquals(0, never.requests.size(), "4xx 必须直接抛出，不得回退");
    }

    @Test
    void anthropicAndAzureThrow501() {
        // 仅 ANTHROPIC / AZURE_OPENAI 走独立 wire，未实现 → doChat 抛 501（不发 HTTP）。
        for (AiModelProviderType type : List.of(AiModelProviderType.ANTHROPIC, AiModelProviderType.AZURE_OPENAI)) {
            AiModelProvider p = provider("p1", "http://127.0.0.1:1/v1", 10,
                    type, List.of("GENERAL"), "vendor-model", "sk-x");
            AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
            when(repo.findByEnabledTrueOrderByPriorityAsc()).thenReturn(List.of(p));

            BusinessException ex = assertThrows(BusinessException.class, () ->
                    new AiModelInvocationService(repo).invokeChat(
                            AiModelPurpose.GENERAL,
                            List.of(Map.of("role", "user", "content", "hi")), null),
                    "providerType=" + type.wire() + " 应抛 501");
            assertEquals(HttpStatus.NOT_IMPLEMENTED, ex.getStatus());
            assertEquals("PROVIDER_NOT_SUPPORTED", ex.getCode());
        }
    }

    @Test
    void compatibleVendorTypesUseOpenAiPath() throws Exception {
        // 国产厂商（均提供 OpenAI 兼容端点）不再被 501 拦下，统一走 /chat/completions。
        // 与真实验证一致：Volcengine Ark providerType=VOLCENGINE 也能正常发起。
        List<AiModelProviderType> compatible = List.of(
                AiModelProviderType.VOLCENGINE, AiModelProviderType.ALIYUN,
                AiModelProviderType.MOONSHOT, AiModelProviderType.DEEPSEEK,
                AiModelProviderType.BAIDU, AiModelProviderType.TENCENT,
                AiModelProviderType.CUSTOM);
        for (AiModelProviderType type : compatible) {
            StubServer server = stub(200, CHAT_OK);
            AiModelProvider p = provider("p-" + type.wire(), server.baseUrl(), 10,
                    type, List.of("GENERAL"), "vendor-model", "sk-" + type.wire());
            AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
            when(repo.findByEnabledTrueOrderByPriorityAsc()).thenReturn(List.of(p));

            AiModelInvocationService.AiModelResponse resp = new AiModelInvocationService(repo).invokeChat(
                    AiModelPurpose.GENERAL,
                    List.of(Map.of("role", "user", "content", "hi")), null);

            assertEquals("你好，我是测试回答。", resp.content(),
                    "providerType=" + type.wire() + " 应走 OpenAI 兼容分支并解析响应");
            assertEquals("/v1/chat/completions", server.requests.get(0).path());
            assertEquals("Bearer sk-" + type.wire(), server.requests.get(0).authorization());
        }
    }

    @Test
    void testConnectionReturnsOkOn200Models() throws Exception {
        String modelsBody = "{\"object\":\"list\",\"data\":[{\"id\":\"gpt-4o\"}]}";
        StubServer server = stub(200, modelsBody);
        AiModelProvider p = provider("pX", server.baseUrl(), 10,
                AiModelProviderType.OPENAI, List.of("GENERAL"), "gpt-4o", "sk-conn");
        AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
        when(repo.findById("pX")).thenReturn(Optional.of(p));

        Map<String, Object> result = new AiModelInvocationService(repo).testConnection("pX");

        assertEquals(true, result.get("ok"));
        assertEquals(200, result.get("statusCode"));
        assertTrue(String.valueOf(result.get("snippet")).contains("gpt-4o"));

        StubServer.Recorded r = server.requests.get(0);
        assertEquals("GET", r.method());
        assertEquals("/v1/models", r.path());
        assertEquals("Bearer sk-conn", r.authorization());
    }

    @Test
    void testConnectionRejectsUnsupportedType() {
        // AZURE_OPENAI 走独立 wire → 不做连通测试，直接返回 ok=false（不发 HTTP）。
        AiModelProvider p = provider("pY", "http://127.0.0.1:1/v1", 10,
                AiModelProviderType.AZURE_OPENAI, List.of("GENERAL"), "gpt-4o", "sk-x");
        AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
        when(repo.findById("pY")).thenReturn(Optional.of(p));

        Map<String, Object> result = new AiModelInvocationService(repo).testConnection("pY");
        assertEquals(false, result.get("ok"));
        assertEquals("AZURE_OPENAI", result.get("providerType"));
    }

    @Test
    void testConnectionThrowsWhenProviderMissing() {
        AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
        when(repo.findById("nope")).thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class, () ->
                new AiModelInvocationService(repo).testConnection("nope"));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("PROVIDER_NOT_FOUND", ex.getCode());
    }

    /** JDK 内置 HTTP server：记录收到的请求，对任意路径返回预设 status + body。 */
    static final class StubServer implements AutoCloseable {
        record Recorded(String method, String path, String authorization, String body) {}

        private final HttpServer server;
        private final int port;
        final List<Recorded> requests = new CopyOnWriteArrayList<>();

        StubServer(int status, String body) throws IOException {
            this.server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            this.port = server.getAddress().getPort();
            byte[] out = body.getBytes(StandardCharsets.UTF_8);
            server.createContext("/", exchange -> {
                byte[] reqBody = exchange.getRequestBody().readAllBytes();
                requests.add(new Recorded(
                        exchange.getRequestMethod(),
                        exchange.getRequestURI().getPath(),
                        exchange.getRequestHeaders().getFirst("Authorization"),
                        new String(reqBody, StandardCharsets.UTF_8)));
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(status, out.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(out);
                }
            });
            server.start();
        }

        String baseUrl() {
            return "http://127.0.0.1:" + port + "/v1";
        }

        @Override
        public void close() {
            server.stop(0);
        }
    }
}
