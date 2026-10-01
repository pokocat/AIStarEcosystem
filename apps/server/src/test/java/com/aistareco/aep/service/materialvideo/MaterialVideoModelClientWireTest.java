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
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
    record Recorded(String method, String path, String query, String contentType, String authorization, byte[] body) {
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
                    ex.getRequestHeaders().getFirst("Content-Type"), ex.getRequestHeaders().getFirst("Authorization"), body);
            requests.add(r);
            int status;
            String resp;
            if (r.path().endsWith("/assets/input")) {
                status = uploadStatus;
                resp = status < 300
                        ? "{\"asset\":{\"assetId\":\"asset_" + assetSeq.incrementAndGet() + "\",\"status\":\"available\"}}"
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
        when(invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION)).thenReturn(Optional.of(ep));
    }

    private void useJusuan() {
        useEndpoint("MiniMax H3", base("/jusuanhub/v1"), "minimax-h3");
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

    @Test
    @DisplayName("老路径（画布首帧）：上传一张图 → i2v，请求体与改动前逐字段一致")
    void legacyCanvasFirstFrameStillWorks() throws Exception {
        useJusuan();
        stored("ipstudio_gen/u1/a.png", png());

        client.submit("让她眨眼", 8, "9:16", "u1", "celebrity", null, VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png"));

        assertEquals(1, uploads().size());
        assertEquals("image", part(uploads().get(0)).name());
        assertEquals("{\"model\":\"minimax-h3\",\"prompt\":\"让她眨眼\",\"resolutionTier\":\"768p\","
                + "\"orientation\":\"portrait\",\"seconds\":8,\"generationMode\":\"i2v\",\"input_image_asset_id\":\"asset_1\"}",
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
    @DisplayName("创建 4xx 但回的是网关 HTML：不外泄；5xx：只给状态码")
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
        assertTrue(unavailable.getMessage().contains("503"), unavailable.getMessage());
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
    @DisplayName("isJusuanMedia 与提交时判协议是同一个规则")
    void isJusuanMediaMatchesSubmitProtocol() {
        assertTrue(client.isJusuanMedia(AiModelEndpoint.builder().name("H3").baseUrl("https://api.jusuanhub.com/v1")
                .model("minimax-h3").build()));
        assertFalse(client.isJusuanMedia(AiModelEndpoint.builder().name("Seedance").baseUrl("https://ark.example/api/v3")
                .model("doubao-seedance-1").build()));
        assertFalse(client.isJusuanMedia(null));
    }
}
