package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AiVideoRequestSpec;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioMediaLimit;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import com.aistareco.aep.videostudio.service.VideoStudioService;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 逐字段核对**真正发出去的**请求（docs/video-studio-plan.md §7「逐字段比对」的单测版）：
 * 本机起一个 HttpServer 冒充厂商，记下每一个请求的路径、查询串、multipart 字段与 JSON 体。
 * 素材上传按字节判类型（JPEG 顶着 .png 也要声明 image/jpeg，§8.0.1 ⑤），上游原话直出（§8.0.1 ①）。
 */
class MaterialVideoModelClientWireTest {

    private final ObjectMapper om = new ObjectMapper();

    /** 请求记录。 */
    record Recorded(String method, String path, String query, String contentType, String authorization,
                    String xApiKey, String xOperationId, byte[] body) {
        String text() {
            return new String(body, StandardCharsets.UTF_8);
        }
    }

    private HttpServer server;
    private final List<Recorded> requests = new CopyOnWriteArrayList<>();
    private final AtomicInteger assetSeq = new AtomicInteger();
    private volatile int createStatus = 202;
    private volatile String createBody = "{\"jobId\":\"job_1\",\"jobUrl\":\"https://example/jobs/job_1\"}";
    private volatile int uploadStatus = 201;
    private volatile String uploadErrorBody = "";
    private String uploadExpiresAt;

    private AiModelInvocationService invocation;
    private FileStorageService storage;
    private MaterialVideoModelClient client;

    @TempDir
    Path tmp;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            byte[] body = ex.getRequestBody().readAllBytes();
            Recorded r = new Recorded(ex.getRequestMethod(), ex.getRequestURI().getPath(), ex.getRequestURI().getRawQuery(),
                    ex.getRequestHeaders().getFirst("Content-Type"), ex.getRequestHeaders().getFirst("Authorization"),
                    ex.getRequestHeaders().getFirst("x-api-key"),
                    ex.getRequestHeaders().getFirst("X-Operation-Id"), body);
            requests.add(r);
            int status;
            String resp;
            if (r.path().endsWith("/assets/input")) {
                status = uploadStatus;
                resp = status < 300
                        ? "{\"asset\":{\"assetId\":\"asset_" + assetSeq.incrementAndGet() + "\",\"status\":\"available\""
                            + (uploadExpiresAt == null ? "" : ",\"expiresAt\":\"" + uploadExpiresAt + "\"") + "}}"
                        : uploadErrorBody;
            } else {
                status = createStatus;
                resp = createBody;
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
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    private String base(String prefix) {
        return "http://127.0.0.1:" + server.getAddress().getPort() + prefix;
    }

    /** 默认端点（endpointId 为空时 pickEndpoint 走这条）。 */
    private void useEndpoint(String name, String baseUrl, String model) {
        AiModelEndpoint ep = AiModelEndpoint.builder()
                .id("ep-test").name(name).baseUrl(baseUrl).model(model)
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test"))
                .enabled(true).build();
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "celebrity"))
                .thenReturn(Optional.of(ep));
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "ipstudio"))
                .thenReturn(Optional.of(ep));
        when(invocation.storedEndpoint(ep.getId())).thenReturn(Optional.of(ep));
    }

    private void useJusuan() {
        useEndpoint("MiniMax H3", base("/jusuanhub/v1"), "minimax-h3");
    }

    @Test
    void preuploadedCharacterVoiceIsReusedBySeparateVideoTasks() throws Exception {
        useJusuan();
        uploadExpiresAt = java.time.Instant.now().plusSeconds(3600).toString();
        var repo = mock(MaterialVideoInputAssetRepository.class);
        var rows = new java.util.HashMap<String, Object[]>();
        when(repo.receipt(any())).thenAnswer(i -> rows.containsKey(i.getArgument(0)) ? java.util.Collections.singletonList(rows.get(i.getArgument(0))) : List.of());
        org.mockito.Mockito.doAnswer(i -> { rows.put(i.getArgument(0), new Object[]{ i.getArgument(2), i.getArgument(3) }); return null; })
                .when(repo).remember(any(), any(), any(), any());
        org.springframework.test.util.ReflectionTestUtils.setField(client, "inputAssets", new MaterialVideoInputAssets(repo));
        stored("owner/voice.mp3", mp3()); stored("owner/photo.png", png());
        client.prepareAudioReference(null, "owner/voice.mp3", "ipstudio");
        var spec = new VideoGenSpec("universal_reference_video", "768p", null, null, null,
                List.of(new VideoGenSpec.Reference("image", "owner/photo.png"), new VideoGenSpec.Reference("audio", "owner/voice.mp3")));
        client.submit("人物说第一句", 5, "9:16", null, "ipstudio", null, spec);
        client.submit("人物说第二句", 5, "9:16", null, "ipstudio", null, spec);
        assertEquals(1, uploads().stream().filter(r -> r.text().contains("name=\"audio\"")).count());
        for (var request : requests) if (request.path().endsWith("/media/generations"))
            assertEquals("asset_1", om.readTree(request.text()).path("referenceInputs").get(1).path("assetId").asText());
        assertEquals(2, requests.stream().filter(r -> r.path().endsWith("/media/generations")).count());
    }

    @Test
    void configuredVideoWithoutModelCannotFallBackToDefaultModel() {
        var endpoint = AiModelEndpoint.builder().id("missing-model")
                .baseUrl(base("/vendor"))
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test"))
                .videoRequestSpecJson("{}").build();
        assertFalse(client.isEndpointReady(endpoint));
        BusinessException error = assertThrows(BusinessException.class,
                () -> client.isJusuanMedia(endpoint));
        assertEquals("VIDEO_REQUEST_SPEC_INVALID", error.getCode());
        assertTrue(requests.isEmpty());
    }

    /** 往「存储」里放一个文件：key → 本机路径。 */
    private byte[] stored(String key, byte[] bytes) throws IOException {
        Path p = tmp.resolve(key.replace('/', '_'));
        Files.write(p, bytes);
        when(storage.openForRead(key)).thenReturn(p);
        return bytes;
    }

    private static byte[] withHead(int size, int... head) {
        byte[] b = new byte[size];
        for (int i = 0; i < head.length; i++) b[i] = (byte) head[i];
        return b;
    }

    private static byte[] jpeg() {
        return withHead(300, 0xFF, 0xD8, 0xFF, 0xE0);
    }

    private static byte[] png() {
        return withHead(300, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A);
    }

    private static byte[] mp4() {
        return withHead(300, 0, 0, 0, 0x20, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm');
    }

    private static byte[] mp3() {
        return withHead(300, 'I', 'D', '3', 4, 0);
    }

    private List<Recorded> uploads() {
        return requests.stream().filter(r -> r.path().endsWith("/assets/input")).toList();
    }

    private Recorded create() {
        List<Recorded> creates = requests.stream().filter(r -> !r.path().endsWith("/assets/input")).toList();
        assertEquals(1, creates.size(), "应当恰好一次创建请求");
        return creates.get(0);
    }

    private JsonNode createJson() throws IOException {
        return om.readTree(create().body());
    }

    /** multipart 里唯一那个文件字段：name / filename / Content-Type / 内容。 */
    record Part(String name, String filename, String contentType, byte[] content) {}

    private static Part part(Recorded r) {
        String boundary = r.contentType().substring(r.contentType().indexOf("boundary=") + "boundary=".length());
        byte[] body = r.body();
        String text = new String(body, StandardCharsets.ISO_8859_1);
        int headerEnd = text.indexOf("\r\n\r\n");
        String header = text.substring(0, headerEnd);
        int contentStart = headerEnd + 4;
        int contentEnd = text.indexOf("\r\n--" + boundary + "--", contentStart);
        Matcher name = Pattern.compile("name=\"([^\"]+)\"").matcher(header);
        Matcher file = Pattern.compile("filename=\"([^\"]+)\"").matcher(header);
        Matcher type = Pattern.compile("Content-Type: (\\S+)").matcher(header);
        assertTrue(name.find() && file.find() && type.find(), header);
        return new Part(name.group(1), file.group(1), type.group(1), Arrays.copyOfRange(body, contentStart, contentEnd));
    }

    // ── 聚算：视频生成区的原生模式 ───────────────────────────────────────────

    @Test
    @DisplayName("首尾帧：两张图先上传（字段 image、类型按字节判），再带两个 assetId 创建；请求体照 Portal")
    void firstLastFrameUploadsBothFramesThenCreates() throws Exception {
        useJusuan();
        byte[] first = stored("video-studio-image/u1/first.png", jpeg());   // JPEG 顶着 .png
        byte[] last = stored("video-studio-image/u1/last.png", png());

        var result = client.submit("从白天到夜晚", 10, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("first_last_frame_video", "768p", 42L,
                        "video-studio-image/u1/first.png", "video-studio-image/u1/last.png", List.of()));

        assertEquals("job_1", result.taskId());
        assertEquals("jusuan-media", result.protocol());
        List<Recorded> ups = uploads();
        assertEquals(2, ups.size());
        for (Recorded up : ups) {
            assertEquals("/jusuanhub/v1/assets/input", up.path());
            assertEquals("model=minimax-h3", up.query());
            assertEquals("Bearer sk-test", up.authorization());
            assertTrue(up.contentType().startsWith("multipart/form-data; boundary="), up.contentType());
        }
        Part p1 = part(ups.get(0));
        assertEquals("image", p1.name());
        assertEquals("image/jpeg", p1.contentType());
        assertTrue(p1.filename().endsWith(".jpg"), p1.filename());
        assertArrayEquals(first, p1.content());
        Part p2 = part(ups.get(1));
        assertEquals("image/png", p2.contentType());
        assertArrayEquals(last, p2.content());

        Recorded c = create();
        assertEquals("/jusuanhub/v1/media/generations", c.path());
        assertEquals("{\"model\":\"minimax-h3\",\"generationMode\":\"first_last_frame_video\",\"prompt\":\"从白天到夜晚\","
                + "\"resolutionTier\":\"768p\",\"orientation\":\"landscape\",\"aspectRatio\":\"16:9\","
                + "\"outputSizeCode\":\"h3-768-16x9\",\"seconds\":10,\"seed\":42,"
                + "\"input_image_asset_id\":\"asset_1\",\"end_image_asset_id\":\"asset_2\"}", c.text());
    }

    @Test
    @DisplayName("全能参考：图 / 视频 / 音频各走自己的字段名与字节类型，referenceInputs 顺序与提交一致")
    void universalReferenceUploadsEachMediaType() throws Exception {
        useJusuan();
        stored("video-studio-image/u1/a.png", png());
        byte[] video = stored("video-studio-video/u1/b.mp4", mp4());
        byte[] audio = stored("video-studio-audio/u1/c.mp3", mp3());

        client.submit("图1的人在视频1的场景里跳舞，配上音频1", 6, "9:16", "u1", "celebrity", "",
                new VideoGenSpec("universal_reference_video", "544p", null, null, null, List.of(
                        new VideoGenSpec.Reference("image", "video-studio-image/u1/a.png"),
                        new VideoGenSpec.Reference("video", "video-studio-video/u1/b.mp4"),
                        new VideoGenSpec.Reference("audio", "video-studio-audio/u1/c.mp3"))));

        List<Part> parts = uploads().stream().map(MaterialVideoModelClientWireTest::part).toList();
        assertEquals(List.of("image", "video", "audio"), parts.stream().map(Part::name).toList());
        assertEquals(List.of("image/png", "video/mp4", "audio/mpeg"), parts.stream().map(Part::contentType).toList());
        assertArrayEquals(video, parts.get(1).content());
        assertArrayEquals(audio, parts.get(2).content());

        JsonNode body = createJson();
        assertEquals("universal_reference_video", body.path("generationMode").asText());
        assertEquals("h3-544-9x16", body.path("outputSizeCode").asText());
        assertFalse(body.has("seed"));
        assertEquals("[{\"role\":\"reference_image\",\"mediaType\":\"image\",\"assetId\":\"asset_1\"},"
                + "{\"role\":\"reference_video\",\"mediaType\":\"video\",\"assetId\":\"asset_2\"},"
                + "{\"role\":\"reference_audio\",\"mediaType\":\"audio\",\"assetId\":\"asset_3\"}]",
                om.writeValueAsString(body.path("referenceInputs")));
    }

    @Test
    @DisplayName("文生视频：一个素材都不传，请求体只有规格字段")
    void textToVideoCreatesWithoutUploads() throws Exception {
        useJusuan();
        client.submit("一只猫在窗台上打盹", 5, "1:1", "u1", "celebrity", null,
                new VideoGenSpec("t2v", "768p", null, null, null, List.of()));

        assertTrue(uploads().isEmpty());
        assertEquals("{\"model\":\"minimax-h3\",\"generationMode\":\"t2v\",\"prompt\":\"一只猫在窗台上打盹\","
                + "\"resolutionTier\":\"768p\",\"orientation\":\"square\",\"aspectRatio\":\"1:1\","
                + "\"outputSizeCode\":\"h3-768-1x1\",\"seconds\":5}", create().text());
    }

    // 2026-10-20 线上：H3 受理后先把提示词改写成英文再出片，原文里的整句中文对白只剩两个字。
    // 下面两条用同样的结构（台词里有一句、表情说明里又引用了开头那个词）构造，不用用户原文。
    @Test
    @DisplayName("按原文生成：请求体真的带上 optimizePrompt=false；不选就不发这个字段（厂商默认改写）")
    void originalPromptSwitchIsSentOnlyWhenChosen() throws Exception {
        useJusuan();
        client.submit("老周：等等？你说这片地要拆了，我怎么一点风声都没听到。", 8, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("t2v", "768p", null, null, null, List.of()).withOptimizePrompt(false));
        JsonNode body = createJson();
        assertTrue(body.has("optimizePrompt"));
        assertFalse(body.path("optimizePrompt").asBoolean(true));
        assertEquals("老周：等等？你说这片地要拆了，我怎么一点风声都没听到。", body.path("prompt").asText());

        requests.clear();
        client.submit("一只猫在窗台上打盹", 5, "1:1", "u1", "celebrity", null,
                new VideoGenSpec("t2v", "768p", null, null, null, List.of()));
        assertFalse(createJson().has("optimizePrompt"));
    }

    @Test
    @DisplayName("查询响应里的 promptOptimization：读出厂商实际用的描述与来源，没有这个对象就是 null")
    void pollCarriesTheVendorsRewrittenPrompt() throws Exception {
        useJusuan();
        var accepted = client.submit("老周：等等？你说这片地要拆了。表情：“等等”时愣住。", 8, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("t2v", "768p", null, null, null, List.of()));
        createBody = "{\"jobId\":\"job_1\",\"status\":\"queued\",\"phase\":\"prompt_optimization\","
                + "\"promptOptimization\":{\"attempt\":1,\"enabled\":true,\"status\":\"processing\",\"preparationStatus\":\"processing\","
                + "\"originalPrompt\":\"老周：等等？你说这片地要拆了。\"}}";
        var preparing = client.poll(accepted);
        assertEquals("processing", preparing.status());
        assertEquals("processing", preparing.promptRewrite().status());
        assertNull(preparing.promptRewrite().prompt());

        createBody = "{\"jobId\":\"job_1\",\"status\":\"running\",\"promptOptimization\":{\"attempt\":1,\"enabled\":true,"
                + "\"status\":\"succeeded\",\"preparationStatus\":\"succeeded\",\"promptSource\":\"optimized\","
                + "\"optimizationId\":\"popt_1\",\"optimizationVersion\":\"v8\","
                + "\"effectivePrompt\":\"Lao Zhou freezes and says (S1) <d>[Chinese]等等</d>.\","
                + "\"optimizedPrompt\":\"Lao Zhou freezes and says (S1) <d>[Chinese]等等</d>.\"}}";
        var rewritten = client.poll(accepted).promptRewrite();
        assertEquals("succeeded", rewritten.status());
        assertEquals("optimized", rewritten.source());
        assertEquals("Lao Zhou freezes and says (S1) <d>[Chinese]等等</d>.", rewritten.prompt());
        assertEquals("popt_1", rewritten.optimizationId());
        assertEquals("v8", rewritten.version());

        createBody = "{\"jobId\":\"job_1\",\"status\":\"running\"}";
        assertNull(client.poll(accepted).promptRewrite());
    }

    @Test
    @DisplayName("老路径（画布首帧）：上传一张图 → i2v；竖屏带上 aspectRatio + outputSizeCode")
    void legacyCanvasFirstFrameStillWorks() throws Exception {
        useJusuan();
        stored("ipstudio_gen/u1/a.png", png());

        client.submit("让她眨眼", 8, "9:16", "u1", "celebrity", null, VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png"));

        assertEquals(1, uploads().size());
        assertEquals("image", part(uploads().get(0)).name());
        assertEquals("{\"model\":\"minimax-h3\",\"prompt\":\"让她眨眼\",\"resolutionTier\":\"768p\","
                + "\"orientation\":\"portrait\",\"aspectRatio\":\"9:16\",\"outputSizeCode\":\"h3-768-9x16\","
                + "\"seconds\":8,\"generationMode\":\"i2v\",\"input_image_asset_id\":\"asset_1\"}",
                create().text());
    }

    @Test
    @DisplayName("素材格式按字节判：音频位上放了一张图 → VIDEO_REF_FORMAT_UNSUPPORTED，什么都不发")
    void wrongBytesAreRejectedBeforeUpload() throws Exception {
        useJusuan();
        stored("video-studio-audio/u1/fake.mp3", png());

        BusinessException e = assertThrows(BusinessException.class, () -> client.submit("配乐", 5, "9:16", "u1",
                "celebrity", null, new VideoGenSpec("universal_reference_video", "768p", null, null, null, List.of(
                        new VideoGenSpec.Reference("audio", "video-studio-audio/u1/fake.mp3")))));
        assertEquals("VIDEO_REF_FORMAT_UNSUPPORTED", e.getCode());
        assertTrue(requests.isEmpty());
    }

    @Test
    @DisplayName("素材超过这个位置的上限（帧图 16MB）→ VIDEO_REF_TOO_LARGE，什么都不发")
    void oversizeFrameIsRejectedBeforeUpload() throws Exception {
        useJusuan();
        byte[] big = new byte[(int) JusuanH3Contract.FRAME_IMAGE_MAX_BYTES + 1];
        big[0] = (byte) 0xFF;
        big[1] = (byte) 0xD8;
        big[2] = (byte) 0xFF;
        stored("video-studio-image/u1/big.jpg", big);

        BusinessException e = assertThrows(BusinessException.class, () -> client.submit("动起来", 5, "9:16", "u1",
                "celebrity", null, new VideoGenSpec("i2v", "768p", null, "video-studio-image/u1/big.jpg", null, List.of())));
        assertEquals("VIDEO_REF_TOO_LARGE", e.getCode());
        assertTrue(requests.isEmpty());
    }

    // ── 上游拒绝 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("创建 4xx：任务失败原因带上厂商原话（错误码仍是 VIDEO_SUBMIT_FAILED）")
    void createRejectionSurfacesVendorMessage() {
        useJusuan();
        createStatus = 400;
        createBody = "{\"error\":{\"code\":\"INVALID_ARGUMENT\",\"message\":\"orientation square is not supported\"}}";

        BusinessException e = assertThrows(BusinessException.class, () -> client.submit("一只猫", 5, "1:1", "u1",
                "celebrity", null, new VideoGenSpec("t2v", "768p", null, null, null, List.of())));
        assertEquals("VIDEO_SUBMIT_FAILED", e.getCode());
        assertTrue(e.getMessage().contains("orientation square is not supported"), e.getMessage());
    }

    @Test
    @DisplayName("创建 4xx 但回的是网关 HTML：不外泄；未明确拒绝的 5xx 保留未知受理与具体原因")
    void createRejectionDoesNotLeakHtml() {
        useJusuan();
        createStatus = 404;
        createBody = "<html><body>nginx 404 page</body></html>";
        BusinessException html = assertThrows(BusinessException.class, () -> client.submit("一只猫", 5, "9:16", "u1",
                "celebrity", null, VideoGenSpec.EMPTY));
        assertEquals("VIDEO_SUBMIT_FAILED", html.getCode());
        assertFalse(html.getMessage().contains("nginx"), html.getMessage());

        requests.clear();
        createStatus = 503;
        createBody = "{\"message\":\"overloaded\"}";
        BusinessException unavailable = assertThrows(BusinessException.class, () -> client.submit("一只猫", 5, "9:16", "u1",
                "celebrity", null, VideoGenSpec.EMPTY));
        assertEquals("VIDEO_SUBMISSION_UNKNOWN",unavailable.getCode());
        assertTrue(unavailable.getMessage().contains("503"), unavailable.getMessage());
        assertTrue(unavailable.getMessage().contains("overloaded"));
    }

    @Test
    @DisplayName("有明确错误码的供应商队列拒绝保持确定失败，不当作平台排队或未知受理")
    void createProviderQueueFullHasMappedCode() {
        useJusuan();
        createStatus = 503;
        createBody = "{\"code\":\"video_queue_full\",\"message\":\"video queue is full\"}";
        BusinessException full = assertThrows(BusinessException.class, () -> client.submit("一只猫", 5, "9:16", "u1",
                "celebrity", null, VideoGenSpec.EMPTY));
        assertEquals("VIDEO_PROVIDER_QUEUE_FULL", full.getCode());
        assertTrue(full.getMessage().contains("模型提供方"));
        assertTrue(full.getMessage().contains("video queue is full"));
    }

    @Test
    @DisplayName("素材上传 4xx：VIDEO_REF_UPLOAD_FAILED + 厂商原话，报错里的名字与任务卡编号一致")
    void uploadRejectionSurfacesVendorMessage() throws Exception {
        useJusuan();
        stored("video-studio-image/u1/a.png", png());
        stored("video-studio-image/u1/b.png", png());
        uploadStatus = 400;
        uploadErrorBody = "{\"error\":{\"message\":\"image resolution too small\"}}";

        BusinessException e = assertThrows(BusinessException.class, () -> client.submit("跳舞", 5, "9:16", "u1",
                "celebrity", null, new VideoGenSpec("universal_reference_video", "768p", null, null, null, List.of(
                        new VideoGenSpec.Reference("image", "video-studio-image/u1/a.png"),
                        new VideoGenSpec.Reference("image", "video-studio-image/u1/b.png")))));
        assertEquals("VIDEO_REF_UPLOAD_FAILED", e.getCode());
        assertTrue(e.getMessage().contains("image resolution too small"), e.getMessage());
        assertTrue(e.getMessage().startsWith("图1"), e.getMessage());
    }

    // ── seedance / agnes / 通用协议：画布首帧不再被丢掉 ─────────────────────────

    @ParameterizedTest
    @ValueSource(strings = {"seedance-2.0", "seedance-2.5"})
    void configuredSeedanceGatewayOmitsUnrequestedLastFrameOutput(String model) throws Exception {
        useConfiguredSeedance(model, Map.of());
        when(storage.upstreamFetchUrl("ipstudio_gen/u1/a.png")).thenReturn("https://cdn.test/a.png");

        client.submit("蓝色陶瓷杯", 5, "9:16", "u1", "celebrity", null,
                VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png"));

        JsonNode body = om.readTree(create().body());
        assertFalse(body.has("return_last_frame"), "unsupported optional fields must be absent, not false");
        assertEquals(model, body.path("model").asText());
        assertEquals(5, body.path("duration").asInt());
        assertEquals("9:16", body.path("ratio").asText());
        assertEquals("first_frame", body.path("content").get(1).path("role").asText());
        assertEquals("https://cdn.test/a.png", body.path("content").get(1).path("image_url").path("url").asText());
    }

    @Test
    void configuredNativeSeedanceKeepsExplicitLastFrameOutput() throws Exception {
        useConfiguredSeedance("doubao-seedance-2-0-fast-260128", Map.of("return_last_frame", true));
        client.submit("蓝色陶瓷杯", 5, "9:16", "u1", "celebrity", null, VideoGenSpec.EMPTY);
        assertTrue(om.readTree(create().body()).path("return_last_frame").asBoolean());
    }

    @ParameterizedTest
    @ValueSource(strings = {"seedance-2.0", "seedance-2.5"})
    void directorReferencesRemainIntactWithoutOptionalLastFrameOutput(String model) throws Exception {
        useConfiguredSeedance(model, Map.of());
        var references = new java.util.ArrayList<VideoGenSpec.Reference>();
        for (int i = 1; i <= 9; i++) {
            String key = "ipstudio_gen/u1/ref" + i + ".png";
            references.add(new VideoGenSpec.Reference("image", key));
            when(storage.upstreamFetchUrl(key)).thenReturn("https://cdn.test/ref" + i + ".png");
        }
        client.submit("商品宣传片", 9, "9:16", "u1", "celebrity", null,
                new VideoGenSpec("universal_reference_video", "768p", null, null, null, references));
        var body = om.readTree(create().body());
        assertFalse(body.has("return_last_frame"));
        assertEquals(10, body.path("content").size());
        for (int i = 1; i <= 9; i++) {
            assertEquals("reference_image", body.path("content").get(i).path("role").asText());
            assertEquals("https://cdn.test/ref" + i + ".png",
                    body.path("content").get(i).path("image_url").path("url").asText());
        }
    }

    @Test
    void referencePersonRejectionIsDefinitiveAndReadable() {
        useConfiguredSeedance("doubao-seedance-2-0-fast-260128", Map.of("return_last_frame", true));
        createStatus = 400;
        createBody = "{\"error\":{\"code\":\"InputImageSensitiveContentDetected.PrivacyInformation\","
                + "\"message\":\"The input image 'content[1]' may contain real person. Request id: private-trace\"}}";

        var error = assertThrows(BusinessException.class, () -> client.submit("蓝色陶瓷杯", 5, "9:16", "u1",
                "celebrity", null, VideoGenSpec.EMPTY));
        assertEquals("VIDEO_REFERENCE_PERSON_RESTRICTED", error.getCode());
        assertTrue(error.getMessage().contains("更换参考图片"));
        assertFalse(error.getMessage().contains("private-trace"));
        assertEquals(1, requests.size(), "a privacy rejection must not resubmit or drop reference images");
    }

    private void useConfiguredSeedance(String model, Map<String, Object> fields) {
        var spec = new AiVideoRequestSpec("seedance", VideoStudioService.contract(5, 15),
                "/api/v3/contents/generations/tasks", "/api/v3/contents/generations/tasks/{id}", fields);
        var endpoint = AiModelEndpoint.builder().id("ep-test").name("Seedance")
                .baseUrl(base("/seedance")).model(model).videoRequestSpecJson(spec.json())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test")).enabled(true).build();
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "celebrity"))
                .thenReturn(Optional.of(endpoint));
    }

    @Test
    @DisplayName("seedance：首帧 key 换成厂商能抓的 URL 放进 content[first_frame]，不走聚算那套上传")
    void seedanceGetsFirstFrameUrlFromKey() throws Exception {
        useEndpoint("Seedance", base("/seedance/api/v3"), "doubao-seedance-1-0-pro");
        when(storage.upstreamFetchUrl("ipstudio_gen/u1/a.png")).thenReturn("https://cdn.test/ipstudio_gen/u1/a.png");

        client.submit("让她眨眼", 5, "9:16", "u1", "celebrity", null, VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png"));

        assertTrue(uploads().isEmpty());
        Recorded c = create();
        assertEquals("/seedance/api/v3/contents/generations/tasks", c.path());
        JsonNode content = om.readTree(c.body()).path("content");
        assertEquals("first_frame", content.get(1).path("role").asText());
        assertEquals("https://cdn.test/ipstudio_gen/u1/a.png", content.get(1).path("image_url").path("url").asText());
        assertTrue(om.readTree(c.body()).path("return_last_frame").asBoolean());
    }

    @Test
    @DisplayName("Seedance 可通过端点附加字段关闭末帧返回，提交时不再与默认字段冲突")
    void configuredSeedanceCanDisableLastFrameReturn() throws Exception {
        var fields = new java.util.LinkedHashMap<String, Object>();
        fields.put("return_last_frame", false);
        fields.put("options", Map.of("watermark", false, "tags", List.of("cinematic")));
        fields.put("callback", null);
        var spec = new AiVideoRequestSpec("seedance", VideoStudioService.contract(5, 15),
                "/api/v3/contents/generations/tasks", "/api/v3/contents/generations/tasks/{id}",
                fields);
        var endpoint = AiModelEndpoint.builder().id("ep-test").name("Seedance")
                .baseUrl(base("/seedance")).model("doubao-seedance-2-0")
                .videoRequestSpecJson(spec.json())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test"))
                .enabled(true).build();
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "celebrity"))
                .thenReturn(Optional.of(endpoint));

        client.submit("一只猫", 5, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("t2v", "768p", null, null, null, List.of()));

        var body = om.readTree(create().body());
        assertFalse(body.path("return_last_frame").asBoolean());
        assertFalse(body.path("options").path("watermark").asBoolean());
        assertEquals("cinematic", body.path("options").path("tags").get(0).asText());
        assertTrue(body.path("callback").isNull());
    }

    @Test
    void configuredResponsePathsReadNestedTaskStatusAndOutput() {
        var response = new AiVideoRequestSpec.ResponseSpec("/payload/task/id", "/payload/state",
                "/payload/result/url", "/payload/error/message", List.of("ok"), List.of("rejected"));
        var spec = new AiVideoRequestSpec("seedance", VideoStudioService.contract(5, 15),
                "/tasks?model={model}", "/jobs/{id}?model={model}&detail=true", java.util.Map.of(), null, response);
        var endpoint = AiModelEndpoint.builder().id("ep-test").name("视频网关")
                .baseUrl(base("/gateway")).model("vendor/model 2")
                .videoRequestSpecJson(spec.json())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test"))
                .enabled(true).build();
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "celebrity"))
                .thenReturn(Optional.of(endpoint));
        when(invocation.storedEndpoint("ep-test")).thenReturn(Optional.of(endpoint));
        createBody = "{\"payload\":{\"task\":{\"id\":\"task-42\"}}}";
        var accepted = client.submit("一只猫", 5, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("t2v", "768p", null, null, null, List.of()));
        assertEquals("task-42", accepted.taskId());
        assertEquals("model=vendor%2Fmodel%202", create().query());
        endpoint.setVideoRequestSpecJson(new AiVideoRequestSpec("seedance", VideoStudioService.contract(5, 15),
                "/changed", "/changed/{id}", java.util.Map.of(), null,
                new AiVideoRequestSpec.ResponseSpec("/other/id", "/other/status", null, null, null, null)).json());
        endpoint.setModel("changed-model");

        createBody = "{\"payload\":{\"state\":\"ok\",\"result\":{\"url\":\"https://cdn.test/video.mp4\"}}}";
        var completed = client.poll(accepted);
        assertEquals("succeeded", completed.status());
        assertEquals("https://cdn.test/video.mp4", completed.videoUrl());
        assertTrue(requests.stream().anyMatch(r -> r.path().equals("/gateway/jobs/task-42")
                && "model=vendor%2Fmodel%202&detail=true".equals(r.query())));

        createBody = "{\"payload\":{\"state\":\"rejected\",\"error\":{\"message\":\"quota used\"}}}";
        var failed = client.poll(accepted);
        assertEquals("failed", failed.status());
        assertEquals("生成服务暂时不可用，请稍后再试或联系平台处理。", failed.failReason());
    }

    @Test
    void configuredJsonTemplateWithoutModelUsesOnlyItsSavedWireFields() throws Exception {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var spec = new AiVideoRequestSpec("json-template", contract, "/create", "/status/{id}", Map.of(),
                null, new AiVideoRequestSpec.ResponseSpec("/task", "/status", "/video", null, null, null),
                Map.of("t2v", Map.of("prompt", "${prompt}", "seconds", "${seconds}")));
        var endpoint = AiModelEndpoint.builder().id("ep-no-model").name("无模型编号的网关")
                .baseUrl(base("/vendor")).videoRequestSpecJson(spec.json())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test")).enabled(true).build();
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "celebrity"))
                .thenReturn(Optional.of(endpoint));
        createBody = "{\"task\":\"task-7\"}";

        assertTrue(client.isEndpointReady(endpoint));
        var accepted = client.submit("海边日落", 6, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("t2v", "720p", null, null, null, List.of()));
        assertEquals("task-7", accepted.taskId());
        assertEquals("ep-no-model", accepted.modelUsed());
        assertEquals("海边日落", createJson().path("prompt").asText());
        assertFalse(createJson().has("model"));
    }

    @Test
    void configuredJsonModesCanCombineFramesAndReferencesOrUseOnlyATailFrame() throws Exception {
        var frame = new VideoStudioMediaLimit("image", 1, 10485760, List.of("PNG"), null, null);
        var references = VideoStudioService.contract(5, 15).modes().get(3).references();
        var contract = new VideoStudioContract(List.of(
                new VideoStudioModeSpec("first_with_refs", true, false, frame, references),
                new VideoStudioModeSpec("last_only", false, true, frame, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var spec = new AiVideoRequestSpec("json-template", contract, "/create", "/status/{id}", Map.of(),
                null, new AiVideoRequestSpec.ResponseSpec("/task", null, null, null, null, null),
                Map.of(
                        "first_with_refs", Map.of("prompt", "${prompt}", "first", "${firstFrameUrl}",
                                "refs", "${references}"),
                        "last_only", Map.of("prompt", "${prompt}", "last", "${lastFrameUrl}")));
        var endpoint = AiModelEndpoint.builder().id("ep-combined").name("组合素材网关")
                .baseUrl(base("/vendor")).videoRequestSpecJson(spec.json())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test")).enabled(true).build();
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "celebrity"))
                .thenReturn(Optional.of(endpoint));
        when(storage.upstreamFetchUrl("owner/first.png")).thenReturn("https://cdn.test/first.png");
        when(storage.upstreamFetchUrl("owner/ref.png")).thenReturn("https://cdn.test/ref.png");
        when(storage.upstreamFetchUrl("owner/last.png")).thenReturn("https://cdn.test/last.png");
        createBody = "{\"task\":\"task-modes\"}";

        client.submit("镜头移动", 5, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("first_with_refs", "720p", null, "owner/first.png", null,
                        List.of(new VideoGenSpec.Reference("image", "owner/ref.png"))));
        assertEquals("https://cdn.test/first.png", createJson().path("first").asText());
        assertEquals("https://cdn.test/ref.png", createJson().path("refs").get(0).path("url").asText());

        requests.clear();
        client.submit("结尾定格", 5, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("last_only", "720p", null, null, "owner/last.png", List.of()));
        assertFalse(createJson().has("first"));
        assertEquals("https://cdn.test/last.png", createJson().path("last").asText());
    }

    @Test
    void configuredJsonTemplateSendsNestedImageAndReadsMappedResponse() throws Exception {
        var frame = new VideoStudioMediaLimit("image", 1, 10485760, List.of("PNG"), null, null);
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("i2v", true, false, frame, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var settings = new java.util.LinkedHashMap<String, Object>(Map.of(
                "duration", "${seconds}", "width", "${width}", "height", "${height}",
                "seed", "${seed}", "request_id", "${requestId}"));
        settings.put("nullable_field", null);
        settings.put("empty_options", Map.of());
        settings.put("unused_last_frame", "${lastFrameUrl}");
        var request = Map.<String, Object>of("model_name", "${model}",
                "input", Map.of("text", "${prompt}", "image", Map.of("url", "${firstFrameUrl}")),
                "settings", settings);
        var spec = new AiVideoRequestSpec("json-template", contract, "/create", "/status/{id}",
                Map.of("callback", false), null,
                new AiVideoRequestSpec.ResponseSpec("/data/task", "/data/state", "/data/video",
                        null, List.of("ready"), List.of("rejected")), Map.of("i2v", request),
                new AiVideoRequestSpec.AuthHeader("x-api-key", ""), null, null, null,
                "X-Operation-Id");
        var endpoint = AiModelEndpoint.builder().id("ep-template").name("自定义视频网关")
                .baseUrl(base("/vendor")).model("supplier-model").videoRequestSpecJson(spec.json())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test")).enabled(true).build();
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "celebrity"))
                .thenReturn(Optional.of(endpoint));
        when(invocation.storedEndpoint("ep-template")).thenReturn(Optional.of(endpoint));
        when(storage.upstreamFetchUrl("owner/first.png")).thenReturn("https://cdn.test/first.png");
        createBody = "{\"data\":{\"task\":\"task-7\"}}";

        var accepted = client.submit("镜头向左移动", 6, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("i2v", "720p", 42L, "owner/first.png", null, List.of()));
        assertEquals("task-7", accepted.taskId());
        assertEquals("/vendor/create", create().path());
        assertEquals("sk-test", create().xApiKey());
        assertTrue(create().xOperationId().startsWith("vid-"));
        assertNull(create().authorization());
        var body = createJson();
        assertEquals("supplier-model", body.path("model_name").asText());
        assertEquals("镜头向左移动", body.path("input").path("text").asText());
        assertEquals("https://cdn.test/first.png", body.path("input").path("image").path("url").asText());
        assertEquals(6, body.path("settings").path("duration").asInt());
        assertEquals(1280, body.path("settings").path("width").asInt());
        assertEquals(42, body.path("settings").path("seed").asInt());
        assertEquals(create().xOperationId(), body.path("settings").path("request_id").asText());
        assertTrue(body.path("settings").path("nullable_field").isNull());
        assertTrue(body.path("settings").path("empty_options").isObject());
        assertEquals(0, body.path("settings").path("empty_options").size());
        assertFalse(body.path("settings").has("unused_last_frame"));
        assertFalse(body.path("callback").asBoolean(true));
        assertTrue(uploads().isEmpty());

        createBody = "{\"data\":{\"state\":\"ready\",\"video\":\"https://cdn.test/result.mp4\"}}";
        var completed = client.poll(accepted);
        assertEquals("succeeded", completed.status());
        assertEquals("https://cdn.test/result.mp4", completed.videoUrl());
        assertTrue(requests.stream().anyMatch(r -> r.path().equals("/vendor/status/task-7")));
        assertTrue(requests.stream().anyMatch(r -> r.path().equals("/vendor/status/task-7")
                && "sk-test".equals(r.xApiKey())));
    }

    @Test
    void configuredPostPollingUsesAcceptedTaskAndModelInJsonBody() throws Exception {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var spec = new AiVideoRequestSpec("json-template", contract, "/create", "/status", Map.of(),
                null, new AiVideoRequestSpec.ResponseSpec("/task", "/status", "/video", null,
                        List.of("done"), null),
                Map.of("t2v", Map.of("prompt", "${prompt}")), null, null, null, null,
                null, "POST", Map.of("task_id", "${id}", "model_name", "${model}"));
        var endpoint = AiModelEndpoint.builder().id("ep-post-poll").name("POST 查询网关")
                .baseUrl(base("/vendor")).model("vendor/model 2").videoRequestSpecJson(spec.json())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test")).enabled(true).build();
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "celebrity"))
                .thenReturn(Optional.of(endpoint));
        when(invocation.storedEndpoint(endpoint.getId())).thenReturn(Optional.of(endpoint));
        createBody = "{\"task\":\"task-9\"}";

        var accepted = client.submit("一只猫", 5, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("t2v", "720p", null, null, null, List.of()));
        endpoint.setModel("changed-model");
        createBody = "{\"status\":\"done\",\"video\":\"https://cdn.test/done.mp4\"}";
        var result = client.poll(accepted);

        assertEquals("succeeded", result.status());
        var poll = requests.stream().filter(r -> r.path().equals("/vendor/status")).findFirst().orElseThrow();
        assertEquals("POST", poll.method());
        assertEquals("application/json", poll.contentType());
        assertEquals("task-9", om.readTree(poll.body()).path("task_id").asText());
        assertEquals("vendor/model 2", om.readTree(poll.body()).path("model_name").asText());
    }

    @Test
    void configuredCustomModeIsSentWithoutACompiledModeList() throws Exception {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec(
                "motion_control_v2", false, false, null, null, "动作控制")),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var spec = new AiVideoRequestSpec("json-template", contract, "/create", "/status/{id}",
                Map.of(), null, new AiVideoRequestSpec.ResponseSpec("/task", null, null, null, null, null),
                Map.of("motion_control_v2", Map.of("prompt", "${prompt}", "mode", "${generationMode}",
                        "duration", "${seconds}")));
        var endpoint = AiModelEndpoint.builder().id("ep-custom-mode").name("动作视频网关")
                .baseUrl(base("/vendor")).model("supplier-model").videoRequestSpecJson(spec.json())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test")).enabled(true).build();
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "celebrity"))
                .thenReturn(Optional.of(endpoint));
        createBody = "{\"task\":\"task-motion\"}";

        var accepted = client.submit("跑起来", 6, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("motion_control_v2", "720p", null, null, null, List.of()));
        assertEquals("task-motion", accepted.taskId());
        assertEquals("motion_control_v2", createJson().path("mode").asText());
        assertEquals(6, createJson().path("duration").asInt());
    }

    @Test
    void configuredReferenceItemTemplateControlsEachSupplierReferenceObject() throws Exception {
        var contract = VideoStudioService.contract(5, 15);
        var spec = new AiVideoRequestSpec("json-template", contract, "/create", "/status/{id}",
                Map.of(), null, new AiVideoRequestSpec.ResponseSpec("/task", null, null, null, null, null),
                Map.of(
                        "t2v", Map.of("prompt", "${prompt}"),
                        "i2v", Map.of("prompt", "${prompt}", "image", "${firstFrameUrl}"),
                        "first_last_frame_video", Map.of("prompt", "${prompt}", "image", "${firstFrameUrl}",
                                "end_image", "${lastFrameUrl}"),
                        "universal_reference_video", Map.of("content", List.of(
                                Map.of("type", "text", "text", "${prompt}"), "${...references}"))),
                null, null, null, Map.of(
                        "image", Map.of("type", "image_url", "image_url", Map.of("url", "${url}")),
                        "video", Map.of("type", "video_url", "video_url", Map.of("url", "${url}"))));
        var endpoint = AiModelEndpoint.builder().id("ep-refs").name("参考素材网关")
                .baseUrl(base("/vendor")).model("supplier-model").videoRequestSpecJson(spec.json())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test")).enabled(true).build();
        when(invocation.resolveDefaultEndpoint(AiModelPurpose.VIDEO_GENERATION, "celebrity"))
                .thenReturn(Optional.of(endpoint));
        when(storage.upstreamFetchUrl("owner/ref.png")).thenReturn("https://cdn.test/ref.png");
        when(storage.upstreamFetchUrl("owner/ref.mp4")).thenReturn("https://cdn.test/ref.mp4");
        createBody = "{\"task\":\"task-refs\"}";

        var accepted = client.submit("镜头移动", 5, "16:9", "u1", "celebrity", null,
                new VideoGenSpec("universal_reference_video", "768p", null, null, null,
                        List.of(new VideoGenSpec.Reference("image", "owner/ref.png"),
                                new VideoGenSpec.Reference("video", "owner/ref.mp4"))));
        assertEquals("task-refs", accepted.taskId());
        var content = createJson().path("content");
        assertEquals(3, content.size());
        assertEquals("镜头移动", content.get(0).path("text").asText());
        assertEquals("https://cdn.test/ref.png", content.get(1).path("image_url").path("url").asText());
        assertEquals("image_url", content.get(1).path("type").asText());
        assertEquals("https://cdn.test/ref.mp4", content.get(2).path("video_url").path("url").asText());
        assertEquals("video_url", content.get(2).path("type").asText());
    }

    @Test
    @DisplayName("通用协议：首帧 URL 进 image")
    void genericGetsFirstFrameUrlFromKey() throws Exception {
        useEndpoint("通用视频", base("/generic/v1"), "some-video");
        when(storage.upstreamFetchUrl("ipstudio_gen/u1/a.png")).thenReturn("https://cdn.test/a.png?sig=1");

        client.submit("让她眨眼", 5, "9:16", "u1", "celebrity", null, VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png"));

        Recorded c = create();
        assertEquals("/generic/v1/videos/generations", c.path());
        assertEquals("https://cdn.test/a.png?sig=1", om.readTree(c.body()).path("image").asText());
    }

    @Test
    @DisplayName("首帧只有本机路径（无 CDN 的 dev）：报错，不假装把图传过去了")
    void relativeFirstFrameUrlFailsLoudly() {
        useEndpoint("通用视频", base("/generic/v1"), "some-video");
        when(storage.upstreamFetchUrl(any())).thenReturn("/static/files/ipstudio_gen/u1/a.png");

        BusinessException e = assertThrows(BusinessException.class, () -> client.submit("让她眨眼", 5, "9:16", "u1",
                "celebrity", null, VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png")));
        assertEquals("VIDEO_REF_UNREADABLE", e.getCode());
        assertTrue(requests.isEmpty());
    }

    @Test
    @DisplayName("非聚算协议收到原生规格 → VIDEO_MODE_UNSUPPORTED，一个请求都不发")
    void nonJusuanNativeSpecIsRejectedBeforeAnyRequest() {
        useEndpoint("Agnes", base("/agnes/v1"), "agnes-video");

        BusinessException e = assertThrows(BusinessException.class, () -> client.submit("跳舞", 5, "9:16", "u1",
                "celebrity", null, new VideoGenSpec("t2v", "768p", null, null, null, List.of())));
        assertEquals("VIDEO_MODE_UNSUPPORTED", e.getCode());
        assertTrue(requests.isEmpty());
    }

    @Test
    @DisplayName("Agnes 本机 CDN 首帧改为真实 data URI，不向厂商传 localhost 或退回文生视频")
    void agnesLocalFirstFrameCarriesOwnedBytes() throws Exception {
        useEndpoint("Agnes", base("/agnes/v1"), "agnes-video-v2.0");
        java.nio.file.Path image = java.nio.file.Files.createTempFile("agnes-ref-", ".png");
        try {
            byte[] bytes = java.util.Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==");
            java.nio.file.Files.write(image, bytes);
            when(storage.upstreamFetchUrl(any())).thenReturn("http://localhost:18080/cdn/ref.png");
            when(storage.publicUrl(any())).thenReturn("http://localhost:18080/cdn/ref.png");
            when(storage.openForRead(any())).thenReturn(image);
            client.submit("挥手", 5, "9:16", "u1", "ipstudio", null,
                    VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/ref.png"));
            JsonNode body = om.readTree(requests.get(0).body());
            assertEquals("data:image/png;base64," + java.util.Base64.getEncoder().encodeToString(bytes), body.path("image").asText());
            assertEquals("720x1280", body.path("size").asText());
            assertEquals("5", body.path("seconds").asText());
            String audit = MaterialVideoModelClient.auditBody(requests.get(0).text());
            assertFalse(audit.contains(java.util.Base64.getEncoder().encodeToString(bytes)));
            assertEquals("720x1280", om.readTree(audit).path("size").asText());
        } finally { java.nio.file.Files.deleteIfExists(image); }
    }

    @Test
    @DisplayName("isJusuanMedia 与提交时判协议是同一个规则")
    void isJusuanMediaMatchesSubmitProtocol() {
        assertTrue(client.isJusuanMedia(AiModelEndpoint.builder().name("H3").baseUrl("https://api.jusuanhub.com/v1")
                .model("minimax-h3").build()));
        assertFalse(client.isJusuanMedia(AiModelEndpoint.builder().name("Seedance").baseUrl("https://ark.example/api/v3")
                .model("doubao-seedance-1").build()));
        assertFalse(client.isJusuanMedia(null));
    }
}
