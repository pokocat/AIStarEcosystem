package com.aistareco.aep.service;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.ai.ModelCallCtx;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Deque;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 出图调用（{@code callImageModel}，首帧 / 三视图 / 画布共用）：固定画幅端点的学习与重发、
 * 上游 4xx 原话直出、请求体进日志且不带签名。上游 HTTP 由 mock 的 {@link UpstreamModelHttp} 按队列回放。
 */
class DramaRenderServiceImageTest {

    private static final ObjectMapper OM = new ObjectMapper();
    /** 2026-10-03 生产上 ernie-Image 原样回的 400 响应体。 */
    private static final String PRESET_400 = "{\"code\":\"invalid_argument\",\"error\":{\"code\":\"invalid_argument\","
            + "\"message\":\"size must match preset image_standard_square_1x (768x768)\",\"param\":null,"
            + "\"requestId\":\"req_8c1f0a\",\"retryable\":false,\"type\":\"invalid_request_error\"},"
            + "\"message\":\"size must match preset image_standard_square_1x (768x768)\",\"requestId\":\"req_8c1f0a\","
            + "\"retryable\":false,\"type\":\"invalid_request_error\"}";

    private final UpstreamModelHttp upstream = mock(UpstreamModelHttp.class);
    private final AiModelInvocationService invocation = mock(AiModelInvocationService.class);
    private final Deque<Object[]> replies = new ArrayDeque<>();
    private final List<HttpRequest> sent = new ArrayList<>();
    private final List<ModelCallCtx> ctxs = new ArrayList<>();
    private DramaRenderService svc;
    private MaterialVideoModelClient videoModels;

    private final AiModelEndpoint ernie = AiModelEndpoint.builder()
            .id("ep-ernie").name("image-jusuanhub").model("ernie-Image").baseUrl("https://api.example.com/v1").build();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        videoModels = new MaterialVideoModelClient(invocation, new MaterialVideoProperties(),
                mock(AiModelUsageService.class), upstream, mock(FileStorageService.class));
        svc = new DramaRenderService(invocation, mock(AiModelUsageService.class), upstream,
                mock(MaterialVideoJobService.class), mock(CreditService.class), mock(CdnUploader.class),
                mock(CdnUrlSigner.class), mock(PlatformConfigService.class), mock(PromptService.class),
                mock(DramaReferenceAssembler.class), mock(StorageQuotaService.class), OM, videoModels);
        when(upstream.sendJson(any(HttpRequest.class), any(ModelCallCtx.class))).thenAnswer(inv -> {
            sent.add(inv.getArgument(0));
            ctxs.add(inv.getArgument(1));
            Object[] r = replies.removeFirst();
            HttpResponse<String> resp = mock(HttpResponse.class);
            when(resp.statusCode()).thenReturn((Integer) r[0]);
            when(resp.body()).thenReturn((String) r[1]);
            return resp;
        });
    }

    private void reply(int status, String body) {
        replies.addLast(new Object[]{status, body});
    }

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};

    private static String ok() {
        return "{\"id\":\"img_1\",\"data\":[{\"b64_json\":\"" + Base64.getEncoder().encodeToString(PNG) + "\"}]}";
    }

    private static String sizeSent(HttpRequest req) throws Exception {
        return OM.readTree(bodyOf(req)).path("size").asText();
    }

    // ── A. 固定画幅 ───────────────────────────────────────────────────────────

    @Test
    void presetRejection_sameRatio_retriesOnceWithPresetSize() throws Exception {
        reply(400, PRESET_400);
        reply(200, ok());
        byte[] bytes = svc.generateImageBytes(ernie, "P", "1:1", List.of());
        assertArrayEquals(PNG, bytes);
        assertEquals(2, sent.size());
        assertEquals("1024x1024", sizeSent(sent.get(0)));
        assertEquals("768x768", sizeSent(sent.get(1)));
    }

    @Test
    void presetRejection_otherRatio_400SizeUnsupported_noSecondCall() {
        reply(400, PRESET_400);
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.generateImageBytes(ernie, "P", "9:16", List.of()));
        assertEquals("IMAGE_SIZE_UNSUPPORTED", e.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertEquals(1, sent.size());
        // 画布 worker 见到 status=4xx 会改用上游原话；这里要它用我们这句（说清能出什么比例）
        assertFalse(e.getInternalDetail().contains("status="), e.getInternalDetail());
        assertTrue(e.getInternalDetail().contains("preset=768x768"), e.getInternalDetail());
        assertTrue(e.getInternalDetail().contains("requested=720x1280"), e.getInternalDetail());
        assertNull(DramaCanvasRunWorker.upstreamRejection(e.getInternalDetail()));
    }

    /** 文案就是被测行为：用户得知道这个模型只能出 1:1，以及能怎么办。 */
    @Test
    void sizeUnsupportedMessage_namesPresetAndRatio() {
        reply(400, PRESET_400);
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.generateImageBytes(ernie, "P", "9:16", List.of()));
        assertTrue(e.getMessage().contains("768×768"), e.getMessage());
        assertTrue(e.getMessage().contains("1:1"), e.getMessage());
        assertTrue(e.getMessage().contains("image-jusuanhub"), e.getMessage());
    }

    @Test
    void rememberedPreset_mismatch_failsWithoutHttp_match_sendsPresetDirectly() throws Exception {
        reply(400, PRESET_400);
        assertThrows(BusinessException.class, () -> svc.generateImageBytes(ernie, "P", "9:16", List.of()));
        assertEquals(1, sent.size());

        // 记住之后：比例不对 → 不发请求
        BusinessException again = assertThrows(BusinessException.class,
                () -> svc.generateImageBytes(ernie, "P", "16:9", List.of()));
        assertEquals("IMAGE_SIZE_UNSUPPORTED", again.getCode());
        assertEquals(1, sent.size());

        // 比例对 → 第一次就按固定画幅发
        reply(200, ok());
        svc.generateImageBytes(ernie, "P", "1:1", List.of());
        assertEquals(2, sent.size());
        assertEquals("768x768", sizeSent(sent.get(1)));
    }

    @Test
    void rememberedPreset_isPerModel_changedModelOnSameEndpointIsNotBlocked() throws Exception {
        reply(400, PRESET_400);
        assertThrows(BusinessException.class, () -> svc.generateImageBytes(ernie, "P", "9:16", List.of()));
        AiModelEndpoint switched = AiModelEndpoint.builder()
                .id("ep-ernie").name("image-jusuanhub").model("other-model").baseUrl("https://api.example.com/v1").build();
        reply(200, ok());
        svc.generateImageBytes(switched, "P", "9:16", List.of());
        assertEquals("720x1280", sizeSent(sent.get(1)));
    }

    @Test
    void presetRejection_afterSendingPresetAlready_noLoop_callFailed() {
        reply(400, PRESET_400);
        reply(200, ok());
        svc.generateImageBytes(ernie, "P", "1:1", List.of()); // 学到 768x768
        reply(400, PRESET_400); // 按 768x768 发了还是被这样拒
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.generateImageBytes(ernie, "P", "1:1", List.of()));
        assertEquals("IMAGE_CALL_FAILED", e.getCode());
        assertEquals(3, sent.size());
    }

    @Test
    void imageSize_ratioLabelAndTolerance() {
        assertEquals("1:1", new DramaRenderService.ImageSize(768, 768).ratioLabel());
        assertEquals("9:16", new DramaRenderService.ImageSize(720, 1280).ratioLabel());
        assertTrue(new DramaRenderService.ImageSize(768, 1376).sameRatio(new DramaRenderService.ImageSize(720, 1280)));
        assertFalse(new DramaRenderService.ImageSize(768, 1024).sameRatio(new DramaRenderService.ImageSize(720, 1280)));
        assertEquals(new DramaRenderService.ImageSize(768, 768), DramaRenderService.sizePresetHint(PRESET_400));
        assertEquals(new DramaRenderService.ImageSize(1024, 576),
                DramaRenderService.sizePresetHint("Size must match preset foo_bar (1024 × 576)"));
        assertNull(DramaRenderService.sizePresetHint("{\"error\":{\"message\":\"bad prompt\"}}"));
        assertNull(DramaRenderService.ImageSize.parse("abc"));
    }

    // ── B. 上游拒绝的原话 ────────────────────────────────────────────────────────

    /** 文案就是被测行为（§8.0.1 ①）：4xx 把上游那句话交给用户，而不是「稍后再试」。 */
    @Test
    void upstream4xx_messageShowsUpstreamReason_codeAndDetailFormatKept() {
        String body = "{\"error\":{\"message\":\"prompt contains forbidden content\",\"type\":\"invalid_request_error\"},"
                + "\"padding\":\"" + "x".repeat(500) + "\"}";
        reply(400, body);
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.generateImageBytes(ernie, "P", "9:16", List.of()));
        assertEquals("IMAGE_CALL_FAILED", e.getCode());
        assertEquals(HttpStatus.BAD_GATEWAY, e.getStatus());
        assertTrue(e.getMessage().contains("prompt contains forbidden content"), e.getMessage());
        assertTrue(e.getInternalDetail().matches("(?s)endpoint=image-jusuanhub model=ernie-Image status=400 body=\\{.*"),
                e.getInternalDetail());
        // 以前 300 字截断让画布 worker 解析不出 JSON；现在整段都在
        String forWorker = DramaCanvasRunWorker.upstreamRejection(e.getInternalDetail());
        assertNotNull(forWorker);
        assertTrue(forWorker.contains("prompt contains forbidden content"), forWorker);
    }

    @Test
    void upstreamMessage_truncatedBody_regexFallback_andSecretsMasked() {
        String truncated = "{\"error\":{\"code\":\"bad\",\"message\":\"invalid api key sk-abcdef1234567890 for model\","
                + "\"param\":null,\"requestId\":\"req";
        assertEquals("invalid api key sk-*** for model", DramaRenderService.upstreamMessage(truncated));
        assertNull(DramaRenderService.upstreamMessage("<html><body>502 Bad Gateway</body></html>"));
        assertNull(DramaRenderService.upstreamMessage(""));
        String longMsg = DramaRenderService.upstreamMessage("{\"message\":\"" + "很长".repeat(200) + "\"}");
        assertTrue(longMsg.length() <= DramaRenderService.UPSTREAM_MESSAGE_LIMIT + 1, longMsg);
    }

    @Test
    void upstream4xx_withoutReadableMessage_genericWithStatus() {
        reply(403, "<html>forbidden</html>");
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.generateImageBytes(ernie, "P", "9:16", List.of()));
        assertEquals("IMAGE_CALL_FAILED", e.getCode());
        assertFalse(e.getMessage().contains("html"), e.getMessage());
        assertTrue(e.getMessage().contains("403"), e.getMessage());
    }

    @Test
    void upstream5xx_staysGeneric_detailKeepsBody() {
        reply(503, "{\"error\":{\"message\":\"backend overloaded node-17\"}}");
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.generateImageBytes(ernie, "P", "9:16", List.of()));
        assertEquals("IMAGE_CALL_FAILED", e.getCode());
        assertFalse(e.getMessage().contains("node-17"), e.getMessage());
        assertTrue(e.getInternalDetail().contains("status=503"), e.getInternalDetail());
        assertTrue(e.getInternalDetail().contains("node-17"), e.getInternalDetail());
    }

    @Test
    void internalDetail_keepsUpTo1000CharsOfBody() {
        String body = "{\"message\":\"" + "y".repeat(3000) + "\"}";
        BusinessException e = DramaRenderService.upstreamRejected("n", "m", 400, body);
        String kept = e.getInternalDetail().substring(e.getInternalDetail().indexOf("body=") + 5);
        assertEquals(DramaRenderService.INTERNAL_BODY_LIMIT + 1, kept.length()); // + 截断标记「…」
    }

    // ── C. 请求体进日志，不带签名 ─────────────────────────────────────────────────

    @Test
    void requestBodyLogged_refUrlsWithoutQueryString_butSentWithSignature() throws Exception {
        reply(200, ok());
        String signed = "https://cdn.example.com/drama/frames/a.png?auth_key=1700000000-0-0-abcdef123456";
        svc.generateImageBytes(ernie, "一间昏暗的房间", "9:16", List.of(signed, "https://cdn.example.com/b.png#x"));
        String logged = ctxs.get(0).requestBodyJson();
        assertNotNull(logged);
        JsonNode l = OM.readTree(logged);
        assertEquals("ernie-Image", l.path("model").asText());
        assertEquals("720x1280", l.path("size").asText());
        assertEquals("一间昏暗的房间", l.path("prompt").asText());
        assertEquals("https://cdn.example.com/drama/frames/a.png", l.path("extra_body").path("image").get(0).asText());
        assertEquals("https://cdn.example.com/b.png", l.path("extra_body").path("image").get(1).asText());
        assertFalse(logged.contains("auth_key"), logged);
        // 发出去的还是带签名的（模型要能抓得到）
        assertEquals(signed, OM.readTree(bodyOf(sent.get(0))).path("extra_body").path("image").get(0).asText());
    }

    // ── D. 出片模型下拉：视频带有效时长区间 ─────────────────────────────────────────

    @Test
    void renderModels_jusuanVideo_carriesMinDuration5_imageUnchanged() {
        AiModelEndpoint h3 = AiModelEndpoint.builder().id("ep-h3").name("聚算 H3")
                .baseUrl("https://api.jusuanhub.com").model("minimax-h3").build();
        AiAppEndpointCandidate videoCand = AiAppEndpointCandidate.builder().maxDurationSec(10).build();
        AiModelInvocationService.ResolvedEndpoint video = new AiModelInvocationService.ResolvedEndpoint(h3, videoCand, true);
        AiAppEndpointCandidate imageCand = AiAppEndpointCandidate.builder().maxRefImages(3).build();
        when(invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION)).thenReturn(List.of(video));
        when(invocation.listCandidates(AiModelPurpose.IMAGE_GENERATION))
                .thenReturn(List.of(new AiModelInvocationService.ResolvedEndpoint(ernie, imageCand, true)));
        when(invocation.resolveEndpoint(eq(AiModelPurpose.VIDEO_GENERATION), eq("ep-h3"))).thenReturn(Optional.of(video));

        var models = svc.listRenderModels();
        var cap = models.video().get(0).capability();
        assertEquals(5, cap.minDurationSec());
        assertEquals(10, cap.maxDurationSec()); // 协议 15 ∩ 候选 10
        assertEquals(List.of("16:9", "9:16"), cap.videoRatios());
        var imageCap = models.image().get(0).capability();
        assertNull(imageCap.minDurationSec());
        assertEquals(3, imageCap.maxRefImages());
    }

    @Test
    void renderModels_boundsFailure_doesNotBreakList() {
        AiModelEndpoint h3 = AiModelEndpoint.builder().id("ep-h3").name("聚算 H3")
                .baseUrl("https://api.jusuanhub.com").model("minimax-h3").build();
        AiModelInvocationService.ResolvedEndpoint video = new AiModelInvocationService.ResolvedEndpoint(h3,
                AiAppEndpointCandidate.builder().build(), true);
        when(invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION)).thenReturn(List.of(video));
        when(invocation.listCandidates(AiModelPurpose.IMAGE_GENERATION)).thenReturn(List.of());
        when(invocation.resolveEndpoint(eq(AiModelPurpose.VIDEO_GENERATION), eq("ep-h3")))
                .thenThrow(new IllegalStateException("db down"));
        var models = svc.listRenderModels();
        assertEquals(1, models.video().size());
        assertNull(models.video().get(0).capability().minDurationSec());
    }

    // ── 工具 ────────────────────────────────────────────────────────────────────

    private static String bodyOf(HttpRequest req) throws Exception {
        HttpRequest.BodyPublisher pub = req.bodyPublisher().orElseThrow();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CountDownLatch done = new CountDownLatch(1);
        pub.subscribe(new Flow.Subscriber<ByteBuffer>() {
            @Override public void onSubscribe(Flow.Subscription s) { s.request(Long.MAX_VALUE); }
            @Override public void onNext(ByteBuffer b) {
                byte[] a = new byte[b.remaining()];
                b.get(a);
                out.write(a, 0, a.length);
            }
            @Override public void onError(Throwable t) { done.countDown(); }
            @Override public void onComplete() { done.countDown(); }
        });
        assertTrue(done.await(5, TimeUnit.SECONDS));
        return out.toString(StandardCharsets.UTF_8);
    }
}
