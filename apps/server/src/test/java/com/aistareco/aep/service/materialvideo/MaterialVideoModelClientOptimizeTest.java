package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 智能优化的真实请求（docs/video-studio-plan.md §9，照 Portal「智能优化后生成」示例逐字段）：
 * 本机 HttpServer 冒充聚算，记下每一个请求；重发要同一正文同一键，素材只传一次；4xx 直出厂商原话。
 * 等待与时钟换成假的，测试里不真等。
 */
class MaterialVideoModelClientOptimizeTest {

    private static final String KEY = "vso_0123456789abcdef01234567";
    private final ObjectMapper om = new ObjectMapper();

    record Recorded(String path, String query, String idempotencyKey, String contentType, byte[] body) {
        String text() {
            return new String(body, StandardCharsets.UTF_8);
        }
    }

    /** 优化接口的一个预设回应。 */
    record Reply(int status, String body, String retryAfter) {}

    private HttpServer server;
    private final List<Recorded> requests = new CopyOnWriteArrayList<>();
    private final Deque<Reply> replies = new ArrayDeque<>();
    private final AtomicInteger assetSeq = new AtomicInteger();
    private AiModelInvocationService invocation;
    private FileStorageService storage;
    private MaterialVideoModelClient client;
    private final List<Long> sleeps = new ArrayList<>();
    private final AtomicLong fakeNanos = new AtomicLong();

    @TempDir
    Path tmp;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            byte[] body = ex.getRequestBody().readAllBytes();
            Recorded r = new Recorded(ex.getRequestURI().getPath(), ex.getRequestURI().getRawQuery(),
                    ex.getRequestHeaders().getFirst("Idempotency-Key"), ex.getRequestHeaders().getFirst("Content-Type"), body);
            requests.add(r);
            int status;
            String resp;
            if (r.path().endsWith("/assets/input")) {
                status = 201;
                resp = "{\"asset\":{\"assetId\":\"asset_" + assetSeq.incrementAndGet() + "\",\"status\":\"available\"}}";
            } else {
                Reply reply;
                synchronized (replies) {
                    reply = replies.isEmpty() ? new Reply(201, ok(), null) : replies.poll();
                }
                status = reply.status();
                resp = reply.body();
                if (reply.retryAfter() != null) ex.getResponseHeaders().set("Retry-After", reply.retryAfter());
            }
            byte[] out = resp.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().set("Content-Type", resp.startsWith("<") ? "text/html" : "application/json");
            ex.sendResponseHeaders(status, out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        server.start();

        invocation = mock(AiModelInvocationService.class);
        storage = mock(FileStorageService.class);
        client = new MaterialVideoModelClient(invocation, new MaterialVideoProperties(), mock(AiModelUsageService.class),
                new UpstreamModelHttp(mock(AiModelUsageService.class)), storage);
        // 不真等：每次「等待」把假时钟往前拨，预算用完的路径也能毫秒级测完
        client.setOptimizeRetryHooksForTest(ms -> {
            sleeps.add(ms);
            fakeNanos.addAndGet(ms * 1_000_000L);
        }, fakeNanos::get, Duration.ofMinutes(12));
        useEndpoint("MiniMax H3", "http://127.0.0.1:" + server.getAddress().getPort() + "/jusuanhub/v1", "minimax-h3");
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    private void useEndpoint(String name, String baseUrl, String model) {
        AiModelEndpoint ep = AiModelEndpoint.builder().id("ep-h3").name(name).baseUrl(baseUrl).model(model)
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test")).enabled(true).build();
        when(invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION)).thenReturn(Optional.of(ep));
    }

    private static String ok() {
        return "{\"optimization\":{\"optimizationId\":\"opt_v1\",\"originalPrompt\":\"一只猫\","
                + "\"optimizedPrompt\":\"一只橘猫在洒满阳光的窗台上打盹，镜头缓慢推近\",\"outcome\":\"optimized\","
                + "\"noticeCodes\":[],\"expiresAt\":\"2026-10-01T00:00:00Z\"}}";
    }

    private byte[] stored(String key, byte[] bytes) throws IOException {
        Path p = tmp.resolve(key.replace('/', '_'));
        Files.write(p, bytes);
        when(storage.openForRead(key)).thenReturn(p);
        return bytes;
    }

    private static byte[] png() {
        byte[] b = new byte[300];
        int[] h = {0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        for (int i = 0; i < h.length; i++) b[i] = (byte) h[i];
        return b;
    }

    private static byte[] mp3() {
        byte[] b = new byte[300];
        b[0] = 'I';
        b[1] = 'D';
        b[2] = '3';
        b[3] = 4;
        return b;
    }

    private List<Recorded> optimizeCalls() {
        return requests.stream().filter(r -> r.path().endsWith("/media/prompt-optimizations")).toList();
    }

    private List<Recorded> uploads() {
        return requests.stream().filter(r -> r.path().endsWith("/assets/input")).toList();
    }

    private MaterialVideoModelClient.OptimizeResult optimize(String prompt, int seconds, String aspect, VideoGenSpec spec) {
        return client.optimizePrompt(KEY, prompt, seconds, aspect, "u1", null, spec);
    }

    // ── 请求体：照 Portal 示例 ─────────────────────────────────────────────

    @Test
    @DisplayName("文生视频：referenceInputs 给空数组；Idempotency-Key 头 == body.clientRequestId；路径 /media/prompt-optimizations")
    void textToVideoBody() {
        MaterialVideoModelClient.OptimizeResult result = optimize("一只猫", 5, "1:1",
                new VideoGenSpec("t2v", "768p", 42L, null, null, List.of()));

        assertEquals("一只橘猫在洒满阳光的窗台上打盹，镜头缓慢推近", result.optimizedPrompt());
        assertEquals("opt_v1", result.vendorOptimizationId());
        Recorded call = optimizeCalls().get(0);
        assertEquals("/jusuanhub/v1/media/prompt-optimizations", call.path());
        assertEquals(KEY, call.idempotencyKey());
        assertTrue(call.contentType().startsWith("application/json"));
        assertEquals("{\"clientRequestId\":\"" + KEY + "\",\"model\":\"minimax-h3\",\"generationMode\":\"t2v\","
                + "\"originalPrompt\":\"一只猫\",\"mediaSpec\":{\"resolutionTier\":\"768p\",\"orientation\":\"square\","
                + "\"aspectRatio\":\"1:1\",\"seconds\":5,\"outputSizeCode\":\"h3-768-1x1\"},\"referenceInputs\":[]}",
                call.text());
        assertTrue(uploads().isEmpty());
    }

    @Test
    @DisplayName("首帧 / 首尾帧：role = first_frame / last_frame，只有 role + assetId（不带 mediaType）")
    void frameRoles() throws Exception {
        stored("video-studio-image/u1/a.png", png());
        stored("video-studio-image/u1/b.png", png());

        optimize("从白天到夜晚", 10, "16:9", new VideoGenSpec("first_last_frame_video", "544p", null,
                "video-studio-image/u1/a.png", "video-studio-image/u1/b.png", List.of()));

        JsonNode body = om.readTree(optimizeCalls().get(0).body());
        assertEquals("[{\"role\":\"first_frame\",\"assetId\":\"asset_1\"},{\"role\":\"last_frame\",\"assetId\":\"asset_2\"}]",
                body.path("referenceInputs").toString());
        assertEquals("h3-544-16x9", body.path("mediaSpec").path("outputSizeCode").asText());
        assertFalse(body.has("audioReferencePolicy"));
        assertEquals(2, uploads().size());
        assertEquals("model=minimax-h3", uploads().get(0).query());
    }

    @Test
    @DisplayName("全能参考带音频：role 按类型、顺序同提交；有音频才加 audioReferencePolicy，放在最后")
    void referenceWithAudioAddsPolicy() throws Exception {
        stored("video-studio-image/u1/a.png", png());
        stored("video-studio-audio/u1/c.mp3", mp3());

        optimize("图1跳舞配音频1", 6, "9:16", new VideoGenSpec("universal_reference_video", "768p", null, null, null,
                List.of(new VideoGenSpec.Reference("image", "video-studio-image/u1/a.png"),
                        new VideoGenSpec.Reference("audio", "video-studio-audio/u1/c.mp3"))));

        String text = optimizeCalls().get(0).text();
        assertTrue(text.endsWith(",\"referenceInputs\":[{\"role\":\"reference_image\",\"assetId\":\"asset_1\"},"
                + "{\"role\":\"reference_audio\",\"assetId\":\"asset_2\"}],\"audioReferencePolicy\":\"preserve_without_understanding\"}"),
                text);
    }

    // ── 重发：同一正文同一键 ─────────────────────────────────────────────

    @Test
    @DisplayName("409（还在处理）→ 同一正文同一键重发；素材只上传一次；按 5 秒起退避")
    void retriesOn409WithSameKeyAndBody() throws Exception {
        stored("video-studio-image/u1/a.png", png());
        replies.add(new Reply(409, "{\"error\":{\"code\":\"optimization_in_progress\",\"message\":\"in progress\"}}", null));
        replies.add(new Reply(409, "{\"error\":{\"code\":\"optimization_in_progress\"}}", null));

        MaterialVideoModelClient.OptimizeResult result = optimize("动起来", 5, "9:16",
                new VideoGenSpec("i2v", "768p", null, "video-studio-image/u1/a.png", null, List.of()));

        assertEquals("opt_v1", result.vendorOptimizationId());
        List<Recorded> calls = optimizeCalls();
        assertEquals(3, calls.size());
        for (Recorded c : calls) {
            assertEquals(KEY, c.idempotencyKey());
            assertArrayEquals(calls.get(0).body(), c.body());
        }
        assertEquals(1, uploads().size());
        assertEquals(List.of(5_000L, 10_000L), sleeps);
    }

    @Test
    @DisplayName("429 / 5xx 也重发；有 Retry-After 就听它的")
    void retriesOn5xxHonoringRetryAfter() {
        replies.add(new Reply(503, "{\"message\":\"busy\"}", "2"));
        replies.add(new Reply(429, "{\"message\":\"slow down\"}", null));

        optimize("一只猫", 5, "9:16", new VideoGenSpec("t2v", "768p", null, null, null, List.of()));

        assertEquals(3, optimizeCalls().size());
        assertEquals(List.of(2_000L, 10_000L), sleeps);
    }

    @Test
    @DisplayName("一直 409 直到 12 分钟预算用完 → VIDEO_STUDIO_OPTIMIZATION_TIMEOUT")
    void budgetExhaustedTimesOut() {
        for (int i = 0; i < 100; i++) replies.add(new Reply(409, "{\"error\":{\"code\":\"optimization_in_progress\"}}", null));

        BusinessException e = assertThrows(BusinessException.class, () -> optimize("一只猫", 5, "9:16",
                new VideoGenSpec("t2v", "768p", null, null, null, List.of())));
        assertEquals("VIDEO_STUDIO_OPTIMIZATION_TIMEOUT", e.getCode());
        long waited = sleeps.stream().mapToLong(Long::longValue).sum();
        assertTrue(waited <= Duration.ofMinutes(12).toMillis(), "等待不能超过预算：" + waited);
        assertTrue(sleeps.stream().allMatch(ms -> ms <= 60_000L), "单次退避封顶 60 秒：" + sleeps);
    }

    // ── 被拒 / 没结果 / 协议不对 ─────────────────────────────────────────

    @Test
    @DisplayName("其它 4xx → VIDEO_STUDIO_OPTIMIZATION_REJECTED，文案带厂商原话；只发一次")
    void rejectionSurfacesVendorWords() {
        replies.add(new Reply(422, "{\"error\":{\"code\":\"invalid_prompt\",\"message\":\"prompt contains a banned term\"}}", null));

        BusinessException e = assertThrows(BusinessException.class, () -> optimize("一只猫", 5, "9:16",
                new VideoGenSpec("t2v", "768p", null, null, null, List.of())));
        assertEquals("VIDEO_STUDIO_OPTIMIZATION_REJECTED", e.getCode());
        assertTrue(e.getMessage().contains("prompt contains a banned term"), e.getMessage());
        assertEquals(1, optimizeCalls().size());
        assertTrue(sleeps.isEmpty());
    }

    @Test
    @DisplayName("4xx 回的是网关 HTML：不外泄")
    void rejectionDoesNotLeakHtml() {
        replies.add(new Reply(404, "<html><body>nginx</body></html>", null));
        BusinessException e = assertThrows(BusinessException.class, () -> optimize("一只猫", 5, "9:16",
                new VideoGenSpec("t2v", "768p", null, null, null, List.of())));
        assertEquals("VIDEO_STUDIO_OPTIMIZATION_REJECTED", e.getCode());
        assertFalse(e.getMessage().contains("nginx"), e.getMessage());
    }

    @Test
    @DisplayName("201 但没有 optimizedPrompt → VIDEO_STUDIO_OPTIMIZATION_FAILED（不当成功、不重发）")
    void successWithoutPromptFails() {
        replies.add(new Reply(201, "{\"optimization\":{\"optimizationId\":\"opt_x\",\"outcome\":\"unchanged\"}}", null));
        BusinessException e = assertThrows(BusinessException.class, () -> optimize("一只猫", 5, "9:16",
                new VideoGenSpec("t2v", "768p", null, null, null, List.of())));
        assertEquals("VIDEO_STUDIO_OPTIMIZATION_FAILED", e.getCode());
        assertEquals(1, optimizeCalls().size());
    }

    @Test
    @DisplayName("端点不是聚算媒体协议 → VIDEO_MODE_UNSUPPORTED，一个请求都不发")
    void nonJusuanEndpointIsRejected() {
        useEndpoint("Seedance", "http://127.0.0.1:" + server.getAddress().getPort() + "/seedance/api/v3", "doubao-seedance-1");
        BusinessException e = assertThrows(BusinessException.class, () -> optimize("一只猫", 5, "9:16",
                new VideoGenSpec("t2v", "768p", null, null, null, List.of())));
        assertEquals("VIDEO_MODE_UNSUPPORTED", e.getCode());
        assertTrue(requests.isEmpty());
    }

    @Test
    @DisplayName("优化返回的解析：认 optimization.optimizedPrompt，也认放在顶层的；不是 JSON → null")
    void parsesBothShapes() {
        assertEquals("x", MaterialVideoModelClient.parseOptimizationResponse(
                "{\"optimization\":{\"optimizedPrompt\":\"x\",\"optimizationId\":\"o1\"}}").optimizedPrompt());
        assertEquals("o2", MaterialVideoModelClient.parseOptimizationResponse(
                "{\"optimizedPrompt\":\"y\",\"optimizationId\":\"o2\"}").vendorOptimizationId());
        assertEquals(null, MaterialVideoModelClient.parseOptimizationResponse("<html/>"));
        assertEquals(null, MaterialVideoModelClient.parseOptimizationResponse("{\"optimization\":{\"optimizedPrompt\":\" \"}}"));
        assertEquals(Map.of("role", "first_frame", "assetId", "a1"),
                MaterialVideoModelClient.buildOptimizationBody(KEY, "m", "p", 5, "9:16",
                        new VideoGenSpec("i2v", "768p", null, "k", null, List.of()),
                        MaterialVideoModelClient.UpstreamInputs.firstFrameAsset("a1"))
                        .get("referenceInputs") instanceof List<?> l ? l.get(0) : null);
    }
}
