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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_PROJECT_NOT_FOUND", "找不到这部短剧"));
        int ep = body != null ? body.path("ep").asInt(1) : 1;

        List<String> clipUrls = collectClipUrls(row, ep);
        if (clipUrls.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_ASSEMBLE_NO_CLIPS",
                    "第 " + ep + " 集还没有生成好视频的镜头，先在「分镜」里给镜头生成视频。");
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
            // 技术细节（下载 HTTP 码 / ffmpeg 报错）只进日志与错误日志，不直出给用户（§8.0.1 ①：5xx 笼统）。
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "DRAMA_ASSEMBLE_FAILED",
                    "成片没合成出来，稍后再试一次。", e.toString());
        } finally {
            cleanup(workDir);
        }
    }

    // ── v0.198 画布：按给定视频 key 顺序拼接 ─────────────────────────────────────────

    /** 画布合成成片的产物（key 已记进 storage_asset，app=drama）。 */
    public record AssembledVideo(String key, long durationSec, long bytes) {}

    /** 成片时长与各段时长之和的允许偏差：取 1.5 秒与 5% 中较大的那个。 */
    static double durationTolerance(double expectedSec) {
        return Math.max(1.5, expectedSec * 0.05);
    }

    /**
     * 画布「合成成片」（v0.198）：按调用方给定的顺序把这些视频 key 拼成一条，存进我方存储并记 storage_asset。
     *
     * <p>和 {@link #assemble} 同一套拼接（先流复制，失败回退重编码）与下载白名单；key 由调用方从**库里的文档**取、
     * 并且已经过归属闸（{@code DramaCanvasOwnership.requireOwned}）—— 这里不再判归属，只负责拼。
     *
     * <p>质量门（失败即抛，不交付一条坏片）：
     * <ol>
     *   <li>每段必须是 ffprobe 读得出、带视频流、时长 &gt; 0 的文件；</li>
     *   <li>成片同样要读得出、带视频流；时长与各段之和偏差超过 {@link #durationTolerance} → 流复制的结果不可信，
     *       改用重编码再拼一次；还不对就失败（时间戳错乱的成片播起来会卡顿或丢段）。</li>
     * </ol>
     *
     * <p>两条拼法（按各段 ffprobe 结果选）：
     * <ul>
     *   <li><b>copy</b>：各段宽高、视频编码、有没有音轨（以及音轨的编码 / 采样率 / 声道）全一致 →
     *       concat 分离器流复制（失败或时长不对回退 concat 分离器重编码）。</li>
     *   <li><b>normalize</b>：有任何一项不一致 —— 每段可以选不同的视频模型（2026-10 生产：H3 竖屏回 768×1024，
     *       别的模型回 9:16），有的段没有音轨 —— concat 分离器拼出来是坏片或直接失败。改成一条 filter_complex：
     *       每段缩放到目标画幅内、补边、统一 30fps / yuv420p，音轨统一 44.1kHz 立体声，没音轨的段补同长静音，
     *       再 concat 滤镜拼。目标画幅按画布比例选，见 {@link #targetSize}。参数见 {@link #normalizeArgs}。</li>
     * </ul>
     *
     * @param refId storage_asset 的 refId（画布 id）
     * @param canvasRatio 画布画幅（"9:16" / "16:9"，建画布时定死）；只影响 normalize 路径选目标画幅。
     *                    null（受理时没快照比例的老运行）→ 不看比例，按出现最多的尺寸选
     */
    public AssembledVideo assembleKeys(String userId, String refId, int episodeNo, List<String> videoKeys,
                                       String canvasRatio) {
        if (videoKeys == null || videoKeys.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_NOTHING_TO_ASSEMBLE",
                    "这一集还没有可以合成的视频。");
        }
        Path workDir = null;
        try {
            workDir = Files.createTempDirectory("drama-canvas-assemble-");
            List<Path> locals = new ArrayList<>();
            List<FfmpegRunner.MediaProbe> probes = new ArrayList<>();
            double expected = 0;
            for (int i = 0; i < videoKeys.size(); i++) {
                String key = videoKeys.get(i);
                String url = signer.signKey(key);
                if (url == null || url.isBlank()) url = signer.publicUrlFor(key);
                if (url == null || url.isBlank()) {
                    throw new IllegalStateException("片段视频没有可读地址 key=" + key);
                }
                Path local = download(url, workDir.resolve("clip_" + i + ".mp4"));
                FfmpegRunner.MediaProbe probe = ffmpeg.probeMedia(local.toFile());
                if (!probe.readable() || !probe.hasVideo() || probe.durationSec() <= 0) {
                    throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "DRAMA_ASSEMBLE_BAD_CLIP",
                            "第 " + (i + 1) + " 个片段的视频文件读不出来，重新生成这个片段再合成。",
                            "key=" + key + " readable=" + probe.readable() + " video=" + probe.videoCodec()
                                    + " dur=" + probe.durationSec());
                }
                expected += probe.durationSec();
                locals.add(local);
                probes.add(probe);
            }

            Path out = workDir.resolve("episode.mp4");
            double tolerance = durationTolerance(expected);
            double actual = -1;
            if (uniformForCopy(probes)) {
                log.info("[drama-assemble] canvas path=copy canvas={} ep={} clips={} size={}x{}",
                        refId, episodeNo, locals.size(), probes.get(0).width(), probes.get(0).height());
                Path listFile = workDir.resolve("list.txt");
                StringBuilder sb = new StringBuilder();
                for (Path p : locals) {
                    sb.append("file '").append(p.toAbsolutePath().toString().replace("'", "'\\''")).append("'\n");
                }
                Files.writeString(listFile, sb.toString());

                boolean copied = false;
                try {
                    ffmpeg.runFfmpeg(List.of("-y", "-f", "concat", "-safe", "0",
                            "-i", listFile.toString(), "-c", "copy", out.toString()));
                    copied = true;
                    actual = gatedDuration(out);
                } catch (Exception copyFail) {
                    log.info("[drama-assemble] canvas -c copy 失败，回退重编码: {}", copyFail.getMessage());
                }
                if (!copied || actual < 0 || Math.abs(actual - expected) > tolerance) {
                    if (copied) {
                        log.info("[drama-assemble] canvas 流复制时长不对 expected={} actual={}，改重编码", expected, actual);
                    }
                    ffmpeg.runFfmpeg(List.of("-y", "-f", "concat", "-safe", "0",
                            "-i", listFile.toString(),
                            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-movflags", "+faststart", out.toString()));
                    actual = gatedDuration(out);
                    if (actual < 0 || Math.abs(actual - expected) > tolerance) {
                        throw new IllegalStateException("成片质量门没过 expected=" + expected + " actual=" + actual);
                    }
                }
            } else {
                int[] target = targetSize(probes, canvasRatio);
                log.info("[drama-assemble] canvas path=normalize canvas={} ep={} clips={} ratio={} target={}x{} clipsMeta={}",
                        refId, episodeNo, locals.size(), canvasRatio, target[0], target[1], describe(probes));
                ffmpeg.runFfmpeg(normalizeArgs(locals, probes, target[0], target[1], out));
                actual = gatedDuration(out);
                if (actual < 0 || Math.abs(actual - expected) > tolerance) {
                    throw new IllegalStateException("成片质量门没过（统一画幅重编码）expected=" + expected + " actual=" + actual);
                }
            }

            String key = "drama/canvas/assemblies/" + safeSegment(refId) + "_ep" + episodeNo + "_"
                    + UUID.randomUUID().toString().replace("-", "").substring(0, 8) + ".mp4";
            cdnUploader.upload(out, key, "video/mp4");
            long bytes = Files.size(out);
            // 记入存储用量（成片，归属画布）。画布的归属闸也查这张表；调用方会再用 DramaCanvasOwnership.record 兜一次。
            storage.record("drama", userId, "成片", refId, key, bytes);
            log.info("[drama-assemble] canvas ok user={} canvas={} ep={} clips={} dur={}s key={}",
                    userId, refId, episodeNo, locals.size(), Math.round(actual), key);
            return new AssembledVideo(key, Math.round(actual), bytes);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[drama-assemble] canvas failed user={} canvas={} ep={}: {}", userId, refId, episodeNo, e.toString());
            // 技术细节（下载 HTTP 码 / ffmpeg 报错）只进日志，不直出给用户（§8.0.1 ①：5xx 笼统）。
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "DRAMA_ASSEMBLE_FAILED",
                    "成片没合成出来，稍后再试一次。", e.toString());
        } finally {
            cleanup(workDir);
        }
    }

    /** 成片读得出且带视频流 → 时长（秒）；否则 -1。 */
    private double gatedDuration(Path out) {
        FfmpegRunner.MediaProbe probe = ffmpeg.probeMedia(out.toFile());
        if (!probe.readable() || !probe.hasVideo() || probe.durationSec() <= 0) return -1;
        return probe.durationSec();
    }

    /** 合成统一画幅时的帧率 / 音频采样率。 */
    static final int NORMALIZE_FPS = 30;
    static final int NORMALIZE_SAMPLE_RATE = 44100;
    private static final String AUDIO_FORMAT =
            "aformat=sample_fmts=fltp:sample_rates=" + NORMALIZE_SAMPLE_RATE + ":channel_layouts=stereo";

    /**
     * 能不能直接流复制：各段宽高、视频编码、有没有音轨一致；都有音轨时音轨编码 / 采样率 / 声道也要一致
     * （concat 分离器流复制不会转音频参数，采样率不同的段拼出来音调会变）。
     */
    static boolean uniformForCopy(List<FfmpegRunner.MediaProbe> probes) {
        if (probes == null || probes.isEmpty()) return true;
        FfmpegRunner.MediaProbe first = probes.get(0);
        for (FfmpegRunner.MediaProbe p : probes) {
            if (p.width() != first.width() || p.height() != first.height()) return false;
            if (!sameCodec(p.videoCodec(), first.videoCodec())) return false;
            if (p.hasAudio() != first.hasAudio()) return false;
            if (first.hasAudio() && (!sameCodec(p.audioCodec(), first.audioCodec())
                    || p.sampleRate() != first.sampleRate() || p.channels() != first.channels())) {
                return false;
            }
        }
        return true;
    }

    private static boolean sameCodec(String a, String b) {
        return (a == null ? "" : a.toLowerCase(Locale.ROOT)).equals(b == null ? "" : b.toLowerCase(Locale.ROOT));
    }

    /** 片段宽高比与画布比例的容差（相对误差）：768×1344 ≈ 0.571 对 9:16 = 0.5625 差 1.6%，算同一比例。 */
    static final double RATIO_TOLERANCE = 0.02;

    /**
     * 统一画幅的目标宽高。成片尽量跟画布比例走（2026-10-03 生产：9:16 画布里一条老的 768×1024（3:4）
     * 加一条新的 768×1344，按「出现最多、并列取第一段」拼成了 3:4）：
     * <ol>
     *   <li>先只看宽高比与画布比例相差 {@link #RATIO_TOLERANCE} 以内的片段：取其中出现最多的尺寸，
     *       并列取像素面积大的，再并列取靠前的；</li>
     *   <li>一个对得上画布比例的都没有，或 {@code canvasRatio} 为 null / 读不出 → 所有片段里出现最多的，
     *       并列取靠前的（第一段在并列里就是第一段的）。</li>
     * </ol>
     * 取偶数（libx264 + yuv420p 不收奇数宽高）。
     */
    static int[] targetSize(List<FfmpegRunner.MediaProbe> probes, String canvasRatio) {
        Double want = parseRatio(canvasRatio);
        if (want != null) {
            Map<String, int[]> matched = new LinkedHashMap<>(); // "WxH" → {w, h, count}
            for (FfmpegRunner.MediaProbe p : probes) {
                if (p.width() <= 0 || p.height() <= 0) continue;
                double r = (double) p.width() / p.height();
                if (Math.abs(r - want) / want > RATIO_TOLERANCE) continue;
                matched.computeIfAbsent(p.width() + "x" + p.height(), k -> new int[]{p.width(), p.height(), 0})[2]++;
            }
            int[] best = null;
            for (int[] c : matched.values()) {
                if (best == null || c[2] > best[2]
                        || (c[2] == best[2] && (long) c[0] * c[1] > (long) best[0] * best[1])) {
                    best = c;
                }
            }
            if (best != null) return new int[]{even(best[0]), even(best[1])};
        }
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (FfmpegRunner.MediaProbe p : probes) {
            counts.merge(p.width() + "x" + p.height(), 1, Integer::sum);
        }
        String best = null;
        int bestCount = 0;
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            if (e.getValue() > bestCount) {
                best = e.getKey();
                bestCount = e.getValue();
            }
        }
        String[] wh = best == null ? new String[]{"720", "1280"} : best.split("x");
        return new int[]{even(Integer.parseInt(wh[0])), even(Integer.parseInt(wh[1]))};
    }

    /** "9:16" → 0.5625；null / 读不出 → null。 */
    static Double parseRatio(String ratio) {
        if (ratio == null) return null;
        String[] parts = ratio.trim().split(":");
        if (parts.length != 2) return null;
        try {
            double w = Double.parseDouble(parts[0].trim());
            double h = Double.parseDouble(parts[1].trim());
            if (w <= 0 || h <= 0) return null;
            return w / h;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static int even(int v) {
        int e = v - (v % 2);
        return Math.max(2, e);
    }

    /**
     * 统一画幅重编码的 ffmpeg 参数（一条 filter_complex）：每段缩放到目标画幅内（保持比例）+ 补边 + 30fps + yuv420p；
     * 有音轨的段重采样到 44.1kHz 立体声，没音轨的段用同长静音顶上；再 {@code concat=n=N:v=1:a=1}。
     * libx264 veryfast + aac + faststart，输出路径在最后一个参数。
     */
    static List<String> normalizeArgs(List<Path> inputs, List<FfmpegRunner.MediaProbe> probes,
                                      int width, int height, Path out) {
        if (inputs.size() != probes.size()) {
            throw new IllegalArgumentException("inputs/probes 数量不一致 " + inputs.size() + " vs " + probes.size());
        }
        List<String> args = new ArrayList<>();
        args.add("-y");
        for (Path p : inputs) {
            args.add("-i");
            args.add(p.toAbsolutePath().toString());
        }
        StringBuilder graph = new StringBuilder();
        StringBuilder concatIn = new StringBuilder();
        for (int i = 0; i < inputs.size(); i++) {
            graph.append('[').append(i).append(":v]")
                    .append("scale=").append(width).append(':').append(height)
                    .append(":force_original_aspect_ratio=decrease,")
                    .append("pad=").append(width).append(':').append(height).append(":(ow-iw)/2:(oh-ih)/2,")
                    .append("setsar=1,fps=").append(NORMALIZE_FPS).append(",format=yuv420p")
                    .append("[v").append(i).append("];");
            FfmpegRunner.MediaProbe probe = probes.get(i);
            if (probe.hasAudio()) {
                graph.append('[').append(i).append(":a]")
                        .append("aresample=").append(NORMALIZE_SAMPLE_RATE).append(',').append(AUDIO_FORMAT);
            } else {
                graph.append("anullsrc=r=").append(NORMALIZE_SAMPLE_RATE).append(":cl=stereo,")
                        .append("atrim=duration=").append(String.format(Locale.ROOT, "%.3f", probe.durationSec()))
                        .append(',').append(AUDIO_FORMAT);
            }
            graph.append("[a").append(i).append("];");
            concatIn.append("[v").append(i).append("][a").append(i).append(']');
        }
        graph.append(concatIn).append("concat=n=").append(inputs.size()).append(":v=1:a=1[vout][aout]");
        args.addAll(List.of(
                "-filter_complex", graph.toString(),
                "-map", "[vout]", "-map", "[aout]",
                "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-ar", String.valueOf(NORMALIZE_SAMPLE_RATE), "-ac", "2",
                "-movflags", "+faststart",
                out.toString()));
        return args;
    }

    /** 日志用：每段的宽高 / 视频编码 / 音轨。 */
    private static String describe(List<FfmpegRunner.MediaProbe> probes) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < probes.size(); i++) {
            FfmpegRunner.MediaProbe p = probes.get(i);
            if (i > 0) sb.append(", ");
            sb.append(p.width()).append('x').append(p.height()).append('/').append(p.videoCodec())
                    .append('/').append(p.hasAudio() ? p.audioCodec() + "@" + p.sampleRate() : "noaudio");
        }
        return sb.append(']').toString();
    }

    private static String safeSegment(String s) {
        String v = s == null ? "canvas" : s.replaceAll("[^A-Za-z0-9_-]", "");
        return v.isEmpty() ? "canvas" : v;
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
                        "镜头视频必须是在平台里生成的，不支持外部链接。");
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
