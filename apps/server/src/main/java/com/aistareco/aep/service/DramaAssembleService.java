package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * 短剧成片合成（v0.66）：把某一集已出片的分镜视频按镜号顺序拼成完整片。
 *
 * 取代原「成片配方」阶段 —— 分镜产物已真实生成，最后一步只需拼接交付。
 * 流程：episodeDocs[ep].storyboard（兼容老 storyboard 字段）→ 取有 videoUrl 的镜头按序
 * → 逐个下载到临时区 → ffmpeg concat（先流复制，失败回退重编码）→ CdnUploader 落 CDN
 * → 返回 {url, cdnKey, durationSec, shotCount}（payload 落库由前端 saveData 合并，
 * 与其余阶段「生成→前端合并→PUT」一致）。
 *
 * 复用 mixcut 的 {@link FfmpegRunner}（自带二进制探测 + 超时 + 非零退出抛错）。
 *
 * 例行 QA 安全修复（2026-07-22）：download() 之前对用户可控的绝对 URL 零校验 —— videoUrl
 * 来自 DramaProject.payloadJson，用户可经 PUT /me/drama/projects/{id} 直接写入任意字符串
 * （saveProject 不做嵌套字段校验），会把服务端变成任意内网/云 metadata 端点的请求发起器
 * （SSRF）。改为与 PublishJobService.toAbsoluteUrl()（同类修复，2026-07-11）同一套 origin
 * 白名单口径：自身 origin + 已配置的 CDN 公网/OSS origin；相对路径天然同源，直接拼自身
 * origin，无需再校验。
 */
@Service
public class DramaAssembleService {

    private static final Logger log = LoggerFactory.getLogger(DramaAssembleService.class);
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final DramaProjectRepository repo;
    private final FfmpegRunner ffmpeg;
    private final CdnUploader cdnUploader;
    private final CdnUrlSigner signer;
    private final com.aistareco.aep.service.storage.StorageQuotaService storage;
    private final ObjectMapper om;
    private final int serverPort;
    private final List<String> trustedDownloadOrigins;

    public DramaAssembleService(DramaProjectRepository repo,
                                FfmpegRunner ffmpeg,
                                CdnUploader cdnUploader,
                                CdnUrlSigner signer,
                                com.aistareco.aep.service.storage.StorageQuotaService storage,
                                ObjectMapper om,
                                @Value("${server.port:8080}") int serverPort,
                                @Value("${aep.cdn.public-base-url:/cdn}") String cdnPublicBaseUrl,
                                @Value("${aep.cdn.oss.base-url:}") String cdnOssBaseUrl) {
        this.repo = repo;
        this.ffmpeg = ffmpeg;
        this.cdnUploader = cdnUploader;
        this.signer = signer;
        this.storage = storage;
        this.om = om;
        this.serverPort = serverPort;
        List<String> origins = new ArrayList<>();
        origins.add("http://localhost:" + serverPort);
        String publicOrigin = originOf(cdnPublicBaseUrl); // 相对路径（如 "/cdn"）解析为 null，天然同源
        if (publicOrigin != null) origins.add(publicOrigin);
        String ossOrigin = originOf(cdnOssBaseUrl);
        if (ossOrigin != null) origins.add(ossOrigin);
        this.trustedDownloadOrigins = List.copyOf(origins);
        log.info("[drama-assemble] trustedDownloadOrigins={}", trustedDownloadOrigins);
    }

    /** 解析 URL 的 scheme://authority；相对路径 / 不可解析时返回 null。与 PublishJobService 同口径。 */
    private static String originOf(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            URI u = URI.create(url.trim());
            if (u.getScheme() == null || u.getAuthority() == null) return null;
            return u.getScheme() + "://" + u.getAuthority();
        } catch (Exception e) {
            return null;
        }
    }

    /** body: { ep } → { url, cdnKey, durationSec, shotCount, at }。 */
    public JsonNode assemble(String projectId, JsonNode body, String userId) {
        DramaProject row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(projectId, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_PROJECT_NOT_FOUND", "短剧项目不存在"));
        int ep = body != null ? body.path("ep").asInt(1) : 1;

        List<String> clipUrls = collectClipUrls(row, ep);
        if (clipUrls.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_ASSEMBLE_NO_CLIPS",
                    "第 " + ep + " 集还没有已出片的镜头 —— 先去视频工厂渲染分镜视频。");
        }

        Path workDir = null;
        try {
            workDir = Files.createTempDirectory("drama-assemble-");
            List<Path> locals = new ArrayList<>();
            for (int i = 0; i < clipUrls.size(); i++) {
                locals.add(download(clipUrls.get(i), workDir.resolve("clip_" + i + ".mp4")));
            }
            Path listFile = workDir.resolve("list.txt");
            StringBuilder sb = new StringBuilder();
            for (Path p : locals) {
                sb.append("file '").append(p.toAbsolutePath().toString().replace("'", "'\\''")).append("'\n");
            }
            Files.writeString(listFile, sb.toString());

            Path out = workDir.resolve("episode.mp4");
            try {
                // 同管线产出的分镜编码一致 → 流复制最快
                ffmpeg.runFfmpeg(List.of("-y", "-f", "concat", "-safe", "0",
                        "-i", listFile.toString(), "-c", "copy", out.toString()));
            } catch (Exception copyFail) {
                log.info("[drama-assemble] -c copy 失败，回退重编码: {}", copyFail.getMessage());
                ffmpeg.runFfmpeg(List.of("-y", "-f", "concat", "-safe", "0",
                        "-i", listFile.toString(),
                        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-movflags", "+faststart", out.toString()));
            }

            double durationSec = 0;
            try {
                durationSec = ffmpeg.probeDurationSec(out.toFile());
            } catch (Exception ignore) { /* 时长仅展示用 */ }

            String key = "drama/assemblies/" + projectId + "_ep" + ep + "_"
                    + UUID.randomUUID().toString().replace("-", "").substring(0, 8) + ".mp4";
            cdnUploader.upload(out, key, "video/mp4");
            // 记入存储用量（成片，归属项目；项目彻底删除时释放）
            try {
                storage.record("drama", userId, "成片", projectId, key, Files.size(out));
            } catch (Exception ignore) { /* 记账 best-effort */ }

            ObjectNode result = om.createObjectNode();
            result.put("url", signer.signKey(key));
            result.put("cdnKey", key);
            result.put("durationSec", Math.round(durationSec));
            result.put("shotCount", clipUrls.size());
            result.put("at", OffsetDateTime.now().toString());
            log.info("[drama-assemble] ok user={} project={} ep={} shots={} dur={}s key={}",
                    userId, projectId, ep, clipUrls.size(), Math.round(durationSec), key);
            return result;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[drama-assemble] failed user={} project={} ep={}: {}", userId, projectId, ep, e.toString());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "DRAMA_ASSEMBLE_FAILED",
                    "成片拼接失败，请稍后重试（" + e.getMessage() + "）");
        } finally {
            cleanup(workDir);
        }
    }

    /** episodeDocs[ep].storyboard 优先，缺则回退老 storyboard 字段；按场序 + 镜号取 videoUrl。 */
    private List<String> collectClipUrls(DramaProject row, int ep) {
        JsonNode data;
        try {
            data = row.getPayloadJson() != null ? om.readTree(row.getPayloadJson()) : om.createObjectNode();
        } catch (Exception e) {
            data = om.createObjectNode();
        }
        JsonNode storyboard = data.path("episodeDocs").path(String.valueOf(ep)).path("storyboard");
        if (storyboard.isMissingNode() || !storyboard.has("scenes")) {
            // 兼容：episodeDocs 尚未启用的老项目
            if (!data.has("episodeDocs") || !data.path("episodeDocs").elements().hasNext()) {
                storyboard = data.path("storyboard");
            }
        }
        List<String> urls = new ArrayList<>();
        for (JsonNode sc : storyboard.path("scenes")) {
            List<JsonNode> shots = new ArrayList<>();
            sc.path("shots").forEach(shots::add);
            shots.sort(Comparator.comparingInt(s -> s.path("no").asInt(0)));
            for (JsonNode sh : shots) {
                String url = sh.path("videoUrl").asText(null);
                if (url != null && !url.isBlank()) urls.add(url);
            }
        }
        return urls;
    }

    private Path download(String url, Path target) throws Exception {
        String abs = url.startsWith("http") ? url
                : "http://localhost:" + serverPort + (url.startsWith("/") ? url : "/" + url);
        if (url.startsWith("http")) {
            String origin = originOf(abs);
            boolean trusted = origin != null && trustedDownloadOrigins.stream().anyMatch(origin::equals);
            if (!trusted) {
                throw BusinessException.badRequest("VIDEO_URL_NOT_ALLOWED",
                        "分镜视频地址必须来自平台自身的 CDN 域，不支持外部/内网地址");
            }
        }
        HttpRequest req = HttpRequest.newBuilder(URI.create(abs))
                .timeout(Duration.ofSeconds(120)).GET().build();
        HttpResponse<InputStream> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofInputStream());
        if (resp.statusCode() / 100 != 2) {
            throw new IllegalStateException("下载分镜失败 HTTP " + resp.statusCode() + " · " + abs);
        }
        try (InputStream in = resp.body()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
        if (Files.size(target) == 0) throw new IllegalStateException("分镜文件为空 · " + abs);
        return target;
    }

    private static void cleanup(Path dir) {
        if (dir == null) return;
        try (var walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (Exception ignore) { /* 临时区清理 best-effort */ }
            });
        } catch (Exception ignore) { /* same */ }
    }
}
