package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiAppEndpointCandidateRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Real HTTP streaming against a local OpenAI-compatible server: the first delta reaches the caller while the vendor is
 * still holding the stream open (true streaming, not a post-hoc split), tool_call deltas are assembled, usage comes
 * from the final chunk, and capability flags gate both stream and tools.
 */
class DialogueStreamingInvocationTest {
    private static final ObjectMapper OM = new ObjectMapper();
    private HttpServer server;

    @AfterEach void stop() { if (server != null) server.stop(0); }

    private AiModelInvocationService service() {
        return new AiModelInvocationService(mock(AiModelEndpointRepository.class), mock(AiAppBindingRepository.class),
                mock(AiAppEndpointCandidateRepository.class), mock(AiModelUsageService.class), mock(AiModelGuardService.class),
                new UpstreamModelHttp(mock(AiModelUsageService.class)), mock(AiModelAccessPolicyService.class));
    }

    private AiModelEndpoint endpoint(Boolean streaming, Boolean tools) {
        return AiModelEndpoint.builder().id("ep-local").name("local").providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/v1").model("local-chat")
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("local-key")).chatSupportsStreaming(streaming).chatSupportsTools(tools).enabled(true).build();
    }

    @Test void deltasArriveBeforeTheVendorFinishesAndUsageComesFromTheLastChunk() throws Exception {
        CountDownLatch firstSeen = new CountDownLatch(1);
        AtomicReference<String> body = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, 0);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(("data: {\"choices\":[{\"delta\":{\"content\":\"我先\"}}]}\n\n").getBytes(StandardCharsets.UTF_8));
                out.flush();
                // The vendor keeps the stream open until the caller has shown the first delta.
                boolean shown = firstSeen.await(10, TimeUnit.SECONDS);
                out.write(("data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"内部推理\"}}]}\n\n").getBytes(StandardCharsets.UTF_8));
                out.write(("data: {\"choices\":[{\"delta\":{\"content\":" + (shown ? "\"看一下画布。\"" : "\"late\"") + "}}]}\n\n").getBytes(StandardCharsets.UTF_8));
                out.write(("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_9\",\"function\":{\"name\":\"read_\",\"arguments\":\"{\\\"node\"}}]}}]}\n\n").getBytes(StandardCharsets.UTF_8));
                out.write(("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"canvas\",\"arguments\":\"Ids\\\":[]}\"}}]},\"finish_reason\":\"tool_calls\"}]}\n\n").getBytes(StandardCharsets.UTF_8));
                out.write(("data: {\"choices\":[],\"usage\":{\"prompt_tokens\":120,\"completion_tokens\":30}}\n\n").getBytes(StandardCharsets.UTF_8));
                out.write("data: [DONE]\n\n".getBytes(StandardCharsets.UTF_8));
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });
        server.start();
        List<String> deltas = Collections.synchronizedList(new ArrayList<>());
        var tools = List.<Map<String, Object>>of(Map.of("type", "function", "function", Map.of("name", "read_canvas", "parameters", Map.of("type", "object"))));
        var result = service().invokeChatTurnOnEndpoint(endpoint(true, true), AiModelPurpose.DAP_PERSONA,
                List.of(Map.of("role", "user", "content", "你好")), Map.of("max_tokens", 512), tools, delta -> { deltas.add(delta); firstSeen.countDown(); });
        assertEquals(List.of("我先", "看一下画布。"), deltas, "real vendor deltas in order; reasoning is never forwarded");
        assertTrue(result.streamed());
        assertEquals("我先看一下画布。", result.content());
        assertEquals(120L, result.promptTokens());
        assertEquals(30L, result.completionTokens());
        assertEquals(1, result.toolCalls().size());
        assertEquals("read_canvas", result.toolCalls().get(0).name());
        assertEquals("{\"nodeIds\":[]}", result.toolCalls().get(0).arguments());
        var sent = OM.readTree(body.get());
        assertTrue(sent.path("stream").asBoolean());
        assertTrue(sent.path("stream_options").path("include_usage").asBoolean());
        assertEquals("read_canvas", sent.path("tools").get(0).path("function").path("name").asText());
    }

    @Test void endpointWithoutDeclaredStreamingIsCalledOnceNonStreaming() throws Exception {
        AtomicReference<String> body = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] reply = "{\"choices\":[{\"message\":{\"content\":\"完整回复\",\"tool_calls\":[{\"id\":\"c1\",\"function\":{\"name\":\"stop\",\"arguments\":\"{}\"}}]},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":5}}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, reply.length);
            try (OutputStream out = exchange.getResponseBody()) { out.write(reply); }
        });
        server.start();
        List<String> deltas = new ArrayList<>();
        var result = service().invokeChatTurnOnEndpoint(endpoint(null, true), AiModelPurpose.DAP_PERSONA,
                List.of(Map.of("role", "user", "content", "你好")), Map.of(), List.of(Map.of("type", "function", "function", Map.of("name", "stop"))), deltas::add);
        assertTrue(deltas.isEmpty(), "no fake deltas from a non-streaming endpoint");
        assertFalse(result.streamed());
        assertEquals("完整回复", result.content());
        assertEquals("stop", result.toolCalls().get(0).name());
        assertFalse(OM.readTree(body.get()).has("stream"));
    }

    @Test void toolsRequireAnExplicitCapability() {
        server = null;
        var unknown = AiModelEndpoint.builder().id("ep").name("x").providerType(AiModelProviderType.OPENAI_COMPATIBLE).baseUrl("http://127.0.0.1:9")
                .model("m").enabled(true).build();
        var e = assertThrows(BusinessException.class, () -> service().invokeChatTurnOnEndpoint(unknown, AiModelPurpose.DAP_PERSONA,
                List.of(Map.of("role", "user", "content", "x")), Map.of(), List.of(Map.of("type", "function")), null));
        assertEquals("AI_TOOLS_NOT_SUPPORTED", e.getCode());
    }

    @Test void vendorErrorStatusIsReportedNotSwallowed() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            byte[] reply = "{\"error\":{\"message\":\"stream_options not supported\"}}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(400, reply.length);
            try (OutputStream out = exchange.getResponseBody()) { out.write(reply); }
        });
        server.start();
        var e = assertThrows(BusinessException.class, () -> service().invokeChatTurnOnEndpoint(endpoint(true, null), AiModelPurpose.DAP_PERSONA,
                List.of(Map.of("role", "user", "content", "x")), Map.of(), null, delta -> { }));
        assertEquals("AI_CALL_FAILED", e.getCode());
        assertTrue(e.getInternalDetail().contains("status=400"));
        assertTrue(e.getInternalDetail().contains("stream_options not supported"));
    }

    @Test void streamThatEndsWithoutAFinishSignalIsAFailureNotAReply() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, 0);
            try (OutputStream out = exchange.getResponseBody()) { out.write("data: {\"choices\":[{\"delta\":{\"content\":\"半截\"}}]}\n\n".getBytes(StandardCharsets.UTF_8)); }
        });
        server.start();
        var e = assertThrows(BusinessException.class, () -> service().invokeChatTurnOnEndpoint(endpoint(true, null), AiModelPurpose.DAP_PERSONA,
                List.of(Map.of("role", "user", "content", "x")), Map.of(), null, delta -> { }));
        assertEquals("AI_STREAM_INCOMPLETE", e.getCode());
    }
}
