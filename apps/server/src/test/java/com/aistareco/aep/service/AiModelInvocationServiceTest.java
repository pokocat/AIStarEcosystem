package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelDiscoveryResultDto;
import com.aistareco.aep.dto.AiModelEntryDto;
import com.aistareco.aep.model.AiAppBinding;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * AiModelInvocationService 调用链集成测试（确定性、无外网、无 Spring 上下文）。
 *
 * 用 JDK 内置 com.sun.net.httpserver 起本地 OpenAI 兼容 stub，验证 service 真实发出的
 * HTTP 请求形态（Authorization=Bearer &lt;解密后的上游 apiKey&gt; + model / messages / temperature /
 * max_tokens body）、响应解析、端点解析（purpose → ai_app_binding → 单端点，**无优先级 / 无兜底**）、
 * 4xx/5xx 直抛、非 OpenAI 类型 501。
 *
 * repo 用 Mockito stub —— 两个 JpaRepository 方法太多不便手撸 fake；
 * service 仅依赖 bindingRepo.findById / endpointRepo.findById（+ listModels 不依赖 repo）。
 * AiModelUsageService 用 mock（用量流水是 best-effort 副作用，与解析/路由断言无关）。
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

    private static AiModelEndpoint endpoint(String id, String baseUrl,
                                            AiModelProviderType type, String model,
                                            String plaintextKey, boolean enabled) {
        return AiModelEndpoint.builder()
                .id(id)
                .name("stub-" + id)
                .providerType(type)
                .baseUrl(baseUrl)
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt(plaintextKey))
                .model(model)
                .enabled(enabled)
                .build();
    }

    /** 装配 service：purpose → binding(endpointId) → endpoint。 */
    private static AiModelInvocationService boundSvc(AiModelPurpose purpose, AiModelEndpoint ep) {
        AiModelEndpointRepository endpointRepo = mock(AiModelEndpointRepository.class);
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        AiAppBinding binding = new AiAppBinding();
        binding.setPurpose(purpose);
        binding.setEndpointId(ep.getId());
        when(bindingRepo.findById(purpose)).thenReturn(Optional.of(binding));
        when(endpointRepo.findById(ep.getId())).thenReturn(Optional.of(ep));
        return new AiModelInvocationService(endpointRepo, bindingRepo, mock(AiModelUsageService.class));
    }

    @Test
    void invokeChatBuildsRequestAndParsesResponse() throws Exception {
        StubServer server = stub(200, CHAT_OK);
        AiModelEndpoint ep = endpoint("ep1", server.baseUrl(),
                AiModelProviderType.OPENAI_COMPATIBLE, "default-model", "sk-secret-123", true);
        AiModelInvocationService svc = boundSvc(AiModelPurpose.SCRIPT_DRAFT, ep);

        AiModelInvocationService.AiModelResponse resp = svc.invokeChat(
                AiModelPurpose.SCRIPT_DRAFT,
                List.of(Map.of("role", "system", "content", "你是助手"),
                        Map.of("role", "user", "content", "讲个笑话")),
                Map.of("model", "override-model", "temperature", 0.7, "max_tokens", 256));

        // ── 响应解析 ──
        assertEquals("你好，我是测试回答。", resp.content());
        assertEquals("stop", resp.finishReason());
        assertEquals(42L, resp.tokensUsed().longValue());
        assertEquals("stub-ep1", resp.endpointUsed());
        assertEquals("override-model", resp.modelUsed());

        // ── 真实发出的请求形态 ──
        assertEquals(1, server.requests.size());
        StubServer.Recorded r = server.requests.get(0);
        assertEquals("POST", r.method());
        assertEquals("/v1/chat/completions", r.path());
        assertEquals("Bearer sk-secret-123", r.authorization(), "Bearer 头应为解密后的上游 apiKey");
        Map<?, ?> sent = OM.readValue(r.body(), Map.class);
        assertEquals("override-model", sent.get("model"));
        assertEquals(0.7, ((Number) sent.get("temperature")).doubleValue(), 1e-9);
        assertEquals(256, ((Number) sent.get("max_tokens")).intValue());
        assertTrue(sent.get("messages") instanceof List<?>);
        assertEquals(2, ((List<?>) sent.get("messages")).size());
    }

    @Test
    void invokeChatUsesEndpointModelWhenOptionsOmitModel() throws Exception {
        StubServer server = stub(200, CHAT_OK);
        AiModelEndpoint ep = endpoint("ep1", server.baseUrl(),
                AiModelProviderType.OPENAI, "doubao-1-5-pro-32k", "sk-x", true);
        AiModelInvocationService svc = boundSvc(AiModelPurpose.GENERAL, ep);

        AiModelInvocationService.AiModelResponse resp = svc.invokeChat(
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
    void unboundPurposeThrowsAiNotConfigured() {
        // 用途无绑定 → 503 AI_NOT_CONFIGURED（不发 HTTP）。
        AiModelEndpointRepository endpointRepo = mock(AiModelEndpointRepository.class);
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        when(bindingRepo.findById(AiModelPurpose.SCRIPT_DRAFT)).thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class, () ->
                new AiModelInvocationService(endpointRepo, bindingRepo, mock(AiModelUsageService.class)).invokeChat(
                        AiModelPurpose.SCRIPT_DRAFT,
                        List.of(Map.of("role", "user", "content", "hi")), null));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        assertEquals("AI_NOT_CONFIGURED", ex.getCode());
    }

    @Test
    void disabledEndpointThrowsAiNotConfigured() {
        // 绑定指向一个被停用的端点 → 解析为空 → 503 AI_NOT_CONFIGURED。
        AiModelEndpoint ep = endpoint("ep1", "http://127.0.0.1:1/v1",
                AiModelProviderType.OPENAI, "m", "sk-x", false);
        AiModelInvocationService svc = boundSvc(AiModelPurpose.GENERAL, ep);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                svc.invokeChat(AiModelPurpose.GENERAL,
                        List.of(Map.of("role", "user", "content", "hi")), null));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        assertEquals("AI_NOT_CONFIGURED", ex.getCode());
    }

    @Test
    void fiveXxThrowsWithoutFallback() throws Exception {
        // v0.41：单端点，无兜底。5xx 直接抛 AI_PROVIDER_HTTP_500。
        StubServer bad = stub(500, "{\"error\":\"boom\"}");
        AiModelEndpoint ep = endpoint("ep1", bad.baseUrl(),
                AiModelProviderType.OPENAI, "m1", "sk-1", true);
        AiModelInvocationService svc = boundSvc(AiModelPurpose.GENERAL, ep);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                svc.invokeChat(AiModelPurpose.GENERAL,
                        List.of(Map.of("role", "user", "content", "hi")), null));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, ex.getStatus());
        assertEquals("AI_PROVIDER_HTTP_500", ex.getCode());
        assertEquals(1, bad.requests.size(), "单端点被尝试一次，不回退");
    }

    @Test
    void throwsDirectlyOn4xx() throws Exception {
        StubServer bad = stub(400, "{\"error\":\"bad request\"}");
        AiModelEndpoint ep = endpoint("ep1", bad.baseUrl(),
                AiModelProviderType.OPENAI, "m1", "sk-1", true);
        AiModelInvocationService svc = boundSvc(AiModelPurpose.GENERAL, ep);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                svc.invokeChat(AiModelPurpose.GENERAL,
                        List.of(Map.of("role", "user", "content", "hi")), null));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("AI_PROVIDER_HTTP_400", ex.getCode());
        assertEquals(1, bad.requests.size());
    }

    @Test
    void anthropicAndAzureThrow501() {
        // 仅 ANTHROPIC / AZURE_OPENAI 走独立 wire，未实现 → doChat 抛 501（不发 HTTP）。
        for (AiModelProviderType type : List.of(AiModelProviderType.ANTHROPIC, AiModelProviderType.AZURE_OPENAI)) {
            AiModelEndpoint ep = endpoint("ep1", "http://127.0.0.1:1/v1",
                    type, "vendor-model", "sk-x", true);
            AiModelInvocationService svc = boundSvc(AiModelPurpose.GENERAL, ep);

            BusinessException ex = assertThrows(BusinessException.class, () ->
                    svc.invokeChat(AiModelPurpose.GENERAL,
                            List.of(Map.of("role", "user", "content", "hi")), null),
                    "providerType=" + type.wire() + " 应抛 501");
            assertEquals(HttpStatus.NOT_IMPLEMENTED, ex.getStatus());
            assertEquals("PROVIDER_NOT_SUPPORTED", ex.getCode());
        }
    }

    @Test
    void compatibleVendorTypesUseOpenAiPath() throws Exception {
        // 国产厂商（均提供 OpenAI 兼容端点）不再被 501 拦下，统一走 /chat/completions。
        List<AiModelProviderType> compatible = List.of(
                AiModelProviderType.VOLCENGINE, AiModelProviderType.ALIYUN,
                AiModelProviderType.MOONSHOT, AiModelProviderType.DEEPSEEK,
                AiModelProviderType.BAIDU, AiModelProviderType.TENCENT,
                AiModelProviderType.CUSTOM);
        for (AiModelProviderType type : compatible) {
            StubServer server = stub(200, CHAT_OK);
            AiModelEndpoint ep = endpoint("ep-" + type.wire(), server.baseUrl(),
                    type, "vendor-model", "sk-" + type.wire(), true);
            AiModelInvocationService svc = boundSvc(AiModelPurpose.GENERAL, ep);

            AiModelInvocationService.AiModelResponse resp = svc.invokeChat(
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
        AiModelEndpoint ep = endpoint("pX", server.baseUrl(),
                AiModelProviderType.OPENAI, "gpt-4o", "sk-conn", true);
        AiModelEndpointRepository endpointRepo = mock(AiModelEndpointRepository.class);
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        when(endpointRepo.findById("pX")).thenReturn(Optional.of(ep));

        Map<String, Object> result = new AiModelInvocationService(endpointRepo, bindingRepo, mock(AiModelUsageService.class)).testConnection("pX");

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
        AiModelEndpoint ep = endpoint("pY", "http://127.0.0.1:1/v1",
                AiModelProviderType.AZURE_OPENAI, "gpt-4o", "sk-x", true);
        AiModelEndpointRepository endpointRepo = mock(AiModelEndpointRepository.class);
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        when(endpointRepo.findById("pY")).thenReturn(Optional.of(ep));

        Map<String, Object> result = new AiModelInvocationService(endpointRepo, bindingRepo, mock(AiModelUsageService.class)).testConnection("pY");
        assertEquals(false, result.get("ok"));
        assertEquals("AZURE_OPENAI", result.get("providerType"));
    }

    @Test
    void testConnectionThrowsWhenEndpointMissing() {
        AiModelEndpointRepository endpointRepo = mock(AiModelEndpointRepository.class);
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        when(endpointRepo.findById("nope")).thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class, () ->
                new AiModelInvocationService(endpointRepo, bindingRepo, mock(AiModelUsageService.class)).testConnection("nope"));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("ENDPOINT_NOT_FOUND", ex.getCode());
    }

    @Test
    void listModelsParsesAndFiltersRetiredEntries() throws Exception {
        String body = """
                {"object":"list","data":[
                  {"id":"doubao-1-5-lite-32k-250115","name":"doubao-1.5-lite","status":"None"},
                  {"id":"old-model","status":"Shutdown"},
                  {"id":"retiring-model","status":"Retiring"},
                  {"id":"plain-model"}
                ]}
                """;
        StubServer server = stub(200, body);
        AiModelInvocationService svc = bareSvc();

        AiModelDiscoveryResultDto result = svc.listModels(
                AiModelProviderType.VOLCENGINE, server.baseUrl(), "sk-models");

        assertTrue(result.ok());
        assertEquals(200, result.statusCode());
        List<String> ids = result.models().stream().map(AiModelEntryDto::id).toList();
        assertEquals(List.of("doubao-1-5-lite-32k-250115", "plain-model"), ids, "Shutdown/Retiring 应被过滤");
        assertEquals("doubao-1.5-lite", result.models().get(0).label());
        assertEquals("plain-model", result.models().get(1).label(), "无 name 时 label 回退为 id");

        StubServer.Recorded r = server.requests.get(0);
        assertEquals("GET", r.method());
        assertEquals("/v1/models", r.path());
        assertEquals("Bearer sk-models", r.authorization());
    }

    @Test
    void listModelsReturnsFailOnNon2xx() throws Exception {
        StubServer server = stub(401, "{\"error\":\"unauthorized\"}");
        AiModelDiscoveryResultDto result = bareSvc().listModels(
                AiModelProviderType.OPENAI, server.baseUrl(), "sk-bad");

        assertFalse(result.ok());
        assertEquals(401, result.statusCode());
        assertTrue(result.models().isEmpty());
        assertNotNull(result.error());
    }

    @Test
    void listModelsRejectsNonOpenAiType() {
        AiModelDiscoveryResultDto result = bareSvc().listModels(
                AiModelProviderType.ANTHROPIC, "http://127.0.0.1:1/v1", "sk-x");
        assertFalse(result.ok());
        assertNotNull(result.error());
    }

    private static AiModelInvocationService bareSvc() {
        return new AiModelInvocationService(
                mock(AiModelEndpointRepository.class), mock(AiAppBindingRepository.class),
                mock(AiModelUsageService.class));
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
