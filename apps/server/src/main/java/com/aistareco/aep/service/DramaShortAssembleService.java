package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaShort;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.DramaShortRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.clip.service.ClipOverlayRenderer;
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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 风格短片真实成片总装：按镜号拼接全部已验收镜头，上传 CDN，并把 key 真值写回
 * {@code DramaShort.payloadJson.assembled}。网络下载沿用项目成片的同源/CDN 白名单，
 * 防止用户可编辑的 payloadJson 把服务端变成 SSRF 请求器。
 */
@Service
public class DramaShortAssembleService {

    private static final Logger log = LoggerFactory.getLogger(DramaShortAssembleService.class);
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final DramaShortRepository repo;
    private final MaterialVideoJobRepository videoJobs;
    private final FfmpegRunner ffmpeg;
    private final CdnUploader cdnUploader;
    private final CdnUrlSigner signer;
    private final StorageQuotaService storage;
    private final FileStorageService files;
    private final ClipOverlayRenderer overlays;
    private final ObjectMapper om;
    private final int serverPort;
    private final List<String> trustedDownloadOrigins;

    public DramaShortAssembleService(DramaShortRepository repo,
                                     MaterialVideoJobRepository videoJobs,
                                     FfmpegRunner ffmpeg,
                                     CdnUploader cdnUploader,
                                     CdnUrlSigner signer,
                                     StorageQuotaService storage,
                                     FileStorageService files,
                                     ClipOverlayRenderer overlays,
                                     ObjectMapper om,
                                     @Value("${server.port:8080}") int serverPort,
                                     @Value("${aep.cdn.public-base-url:/cdn}") String cdnPublicBaseUrl,
                                     @Value("${aep.cdn.oss.base-url:}") String cdnOssBaseUrl) {
        this.repo = repo;
        this.videoJobs = videoJobs;
        this.ffmpeg = ffmpeg;
        this.cdnUploader = cdnUploader;
        this.signer = signer == null ? CdnUrlSigner.NOOP : signer;
        this.storage = storage;
        this.files = files;
        this.overlays = overlays;
        this.om = om;
        this.serverPort = serverPort;
        List<String> origins = new ArrayList<>();
        origins.add("http://localhost:" + serverPort);
        String publicOrigin = originOf(cdnPublicBaseUrl);
        if (publicOrigin != null) origins.add(publicOrigin);
        String ossOrigin = originOf(cdnOssBaseUrl);
        if (ossOrigin != null) origins.add(ossOrigin);
        this.trustedDownloadOrigins = List.copyOf(origins);
    }

    /** → { url, cdnKey, durationSec, shotCount, at }。相同镜头版本重复点击直接返回已有成片。 */
    public JsonNode assemble(String shortId, String userId) {
        DramaShort row = requireOwned(shortId, userId);
        ObjectNode data = readPayload(row);
        AssemblyPlan plan = buildPlan(data);

        JsonNode existing = data.path("assembled");
        String existingKey = text(existing, "cdnKey");
        if (existingKey != null && plan.fingerprint().equals(text(existing, "sourceFingerprint"))) {
            long durationSec = existing.path("durationSec").asLong(plan.expectedDurationSec());
            int shotCount = existing.path("shotCount").asInt(plan.clipUrls().size());
            // 镜头曾编辑后又恢复成完全相同的输入时，旧成片仍有效：无需再次消耗 ffmpeg/OSS，
            // 但必须清掉 stale 并把行恢复为 done，不能只返回一个“看似成功”的响应。
            if (existing.path("stale").asBoolean(false) || !"done".equals(row.getStatus())) {
                ObjectNode current = ((ObjectNode) existing).deepCopy();
                current.remove("stale");
                data.set("assembled", current);
                row.setPayloadJson(write(data));
                row.setDurationSec((int) Math.min(Integer.MAX_VALUE, durationSec));
                row.setShotCount(shotCount);
                row.setDoneCount(shotCount);
                row.setStatus("done");
                row.setProgress(100);
                row.setUpdatedAt(OffsetDateTime.now());
                repo.save(row);
            }
            ObjectNode response = (ObjectNode) wire(existingKey, durationSec, shotCount, text(existing, "at"));
            String coverKey = text(existing, "coverCdnKey");
            if (coverKey != null) {
                response.put("coverCdnKey", coverKey);
                String coverUrl = signer.signKey(coverKey);
                if (coverUrl == null) coverUrl = cdnUploader.publicUrlFor(coverKey);
                if (coverUrl != null) response.put("coverUrl", coverUrl);
            }
            response.put("assemblyVersion", existing.path("assemblyVersion")
                    .asText(DramaShortContinuityService.ASSEMBLY_VERSION));
            return response;
        }

        Path workDir = null;
        String uploadedKey = null;
        String uploadedCoverKey = null;
        try {
            requireOwnClips(shortId, userId, plan);
            storage.checkQuota("drama", userId, 0);
            workDir = Files.createTempDirectory("drama-short-assemble-");
            List<Path> locals = new ArrayList<>();
            double expectedFromTimeline = 0;
            for (int i = 0; i < plan.segments().size(); i++) {
                Segment segment = plan.segments().get(i);
                Path visual = download(segment.clipUrl(), workDir.resolve("source_" + i + ".mp4"));
                Path audio;
                double duration;
                if (segment.audioCdnKey() != null) {
                    audio = files.openForRead(segment.audioCdnKey());
                    duration = ffmpeg.probeDurationSec(audio.toFile());
                    if (duration <= 0) throw new IllegalStateException("invalid audio duration for shot " + segment.no());
                } else {
                    duration = Math.max(1, segment.durationSec());
                    audio = workDir.resolve("silence_" + i + ".m4a");
                    ffmpeg.runFfmpeg(List.of("-y", "-f", "lavfi", "-i",
                            "anullsrc=r=48000:cl=stereo", "-t", seconds(duration),
                            "-c:a", "aac", audio.toString()));
                }
                Path normalized = workDir.resolve("clip_" + i + ".mp4");
                normalizeSegment(visual, audio, segment, duration, workDir, normalized);
                if (!ffmpeg.hasAudioStream(normalized.toFile())) {
                    throw new IllegalStateException("normalized shot has no audio " + segment.no());
                }
                locals.add(normalized);
                expectedFromTimeline += duration;
            }

            Path listFile = workDir.resolve("list.txt");
            StringBuilder list = new StringBuilder();
            for (Path local : locals) {
                list.append("file '")
                        .append(local.toAbsolutePath().toString().replace("'", "'\\''"))
                        .append("'\n");
            }
            Files.writeString(listFile, list.toString());

            Path joined = workDir.resolve("joined.mp4");
            try {
                ffmpeg.runFfmpeg(List.of("-y", "-f", "concat", "-safe", "0",
                        "-i", listFile.toString(), "-c", "copy", "-movflags", "+faststart", joined.toString()));
            } catch (Exception copyFail) {
                log.info("[drama-short-assemble] stream copy failed; transcoding short={} reason={}",
                        shortId, copyFail.getMessage());
                ffmpeg.runFfmpeg(List.of("-y", "-f", "concat", "-safe", "0",
                        "-i", listFile.toString(),
                        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-movflags", "+faststart", joined.toString()));
            }

            Path out = workDir.resolve("short.mp4");
            ffmpeg.runFfmpeg(List.of("-y", "-i", joined.toString(),
                    "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-c:a", "aac", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", out.toString()));

            double probed = ffmpeg.probeDurationSec(out.toFile());
            if (probed <= 0 || !ffmpeg.hasAudioStream(out.toFile())) {
                throw new IllegalStateException("final media failed ffprobe audio/duration gate");
            }
            double tolerance = Math.max(1.0, expectedFromTimeline * 0.05);
            if (Math.abs(probed - expectedFromTimeline) > tolerance) {
                throw new IllegalStateException("final duration drift expected=" + expectedFromTimeline + " actual=" + probed);
            }
            long durationSec = Math.round(probed);
            long outputBytes = Files.size(out);
            Path cover = workDir.resolve("cover.jpg");
            ffmpeg.runFfmpeg(List.of("-y", "-ss", "0.1", "-i", out.toString(),
                    "-frames:v", "1", "-q:v", "2", cover.toString()));
            outputBytes += Files.size(cover);
            storage.checkQuota("drama", userId, outputBytes);
            String requestedKey = "drama/shorts/" + shortId + "/final-"
                    + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + ".mp4";
            CdnUploader.CdnUploadResult upload = cdnUploader.upload(out, requestedKey, "video/mp4");
            uploadedKey = upload.key() == null || upload.key().isBlank() ? requestedKey : upload.key();
            String requestedCoverKey = "drama/shorts/" + shortId + "/cover-"
                    + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + ".jpg";
            CdnUploader.CdnUploadResult coverUpload = cdnUploader.upload(cover, requestedCoverKey, "image/jpeg");
            String coverKey = coverUpload.key() == null || coverUpload.key().isBlank()
                    ? requestedCoverKey : coverUpload.key();
            uploadedCoverKey = coverKey;

            String previousKey = text(existing, "cdnKey");
            String previousCoverKey = text(existing, "coverCdnKey");
            ObjectNode assembled = om.createObjectNode();
            assembled.put("cdnKey", uploadedKey);
            assembled.put("coverCdnKey", coverKey);
            assembled.put("durationSec", durationSec);
            assembled.put("shotCount", plan.clipUrls().size());
            assembled.put("sourceFingerprint", plan.fingerprint());
            assembled.put("assemblyVersion", DramaShortContinuityService.ASSEMBLY_VERSION);
            assembled.put("at", OffsetDateTime.now().toString());
            data.set("assembled", assembled);

            row.setPayloadJson(write(data));
            row.setDurationSec((int) Math.min(Integer.MAX_VALUE, durationSec));
            row.setShotCount(plan.clipUrls().size());
            row.setDoneCount(plan.clipUrls().size());
            row.setStatus("done");
            row.setProgress(100);
            row.setUpdatedAt(OffsetDateTime.now());
            repo.save(row);

            // 替换成片后再清旧对象；失败不影响新成片交付。
            if (previousKey != null && !previousKey.equals(uploadedKey)) {
                try { cdnUploader.delete(previousKey); }
                catch (Exception e) { log.warn("[drama-short-assemble] old object cleanup failed key={}", previousKey); }
            }
            if (previousCoverKey != null && !previousCoverKey.equals(coverKey)) {
                try { cdnUploader.delete(previousCoverKey); }
                catch (Exception e) { log.warn("[drama-short-assemble] old cover cleanup failed key={}", previousCoverKey); }
            }
            storage.releaseByRef("drama", "short:" + shortId);
            storage.record("drama", userId, "短视频成片", "short:" + shortId,
                    uploadedKey, outputBytes);

            log.info("[drama-short-assemble] ok user={} short={} shots={} duration={} key={}",
                    userId, shortId, plan.clipUrls().size(), durationSec, uploadedKey);
            ObjectNode response = (ObjectNode) wire(uploadedKey, durationSec, plan.clipUrls().size(), assembled.path("at").asText());
            response.put("coverCdnKey", coverKey);
            String coverUrl = signer.signKey(coverKey);
            if (coverUrl == null) coverUrl = cdnUploader.publicUrlFor(coverKey);
            if (coverUrl != null) response.put("coverUrl", coverUrl);
            response.put("assemblyVersion", DramaShortContinuityService.ASSEMBLY_VERSION);
            return response;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            // 上传成功但落库失败时尽量清理本轮孤儿对象。
            if (uploadedKey != null) {
                try { cdnUploader.delete(uploadedKey); } catch (Exception ignore) { /* best-effort */ }
            }
            if (uploadedCoverKey != null) {
                try { cdnUploader.delete(uploadedCoverKey); } catch (Exception ignore) { /* best-effort */ }
            }
            log.warn("[drama-short-assemble] failed user={} short={}: {}", userId, shortId, e.toString());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "DRAMA_SHORT_ASSEMBLE_FAILED",
                    "短视频合成失败，请稍后重试");
        } finally {
            cleanup(workDir);
        }
    }

    /**
     * 出片产物出处核验：每一镜的视频都必须来自**这个账号自己的**短剧渲染任务。
     *
     * <p>草稿 payload 是客户端整份 PUT 上来的，历史上不校验 {@code flow} / {@code videoUrl}
     * （见 TODO.md「PUT 保存可伪造逐镜产物」）。伪造
     * {@code {"flow":"done","videoUrl":"/cdn/<平台已有视频>"}} 就能跳过逐镜出片扣费直接总装成片。
     * 这里在花掉任何 ffmpeg / OSS 资源之前，把每镜视频按资产路径比对本人任务产物。</p>
     *
     * <p>先按本草稿的任务比对，再退到该账号全部短剧任务：老草稿的任务可能没落 {@code script_id}，
     * 且同一账号跨草稿复用自己已付费的成片不算绕过计费。两级都不命中 → 拒绝并要求重新出片。</p>
     */
    private void requireOwnClips(String shortId, String userId, AssemblyPlan plan) {
        Set<String> draftAssets = assetPathsOf(videoJobs.findScopedByScript(
                userId, MaterialVideoJobService.APP_DRAMA, shortId));
        Set<String> ownerAssets = null; // 惰性：只有本草稿任务对不上时才全量扫该账号
        List<Integer> unverified = new ArrayList<>();
        for (Segment segment : plan.segments()) {
            String asset = assetPath(segment.clipUrl());
            if (asset == null || draftAssets.contains(asset)) continue;
            if (ownerAssets == null) {
                ownerAssets = assetPathsOf(videoJobs.findScoped(userId, MaterialVideoJobService.APP_DRAMA));
            }
            if (ownerAssets.contains(asset)) {
                log.warn("[drama-short-assemble] clip matched owner-wide job (missing script_id?) short={} shot={}",
                        shortId, segment.no());
                continue;
            }
            unverified.add(segment.no());
        }
        if (!unverified.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SHORT_CLIP_UNVERIFIED",
                    "镜 " + join(unverified) + " 的视频不是这个账号出片生成的，无法合成；请在分镜表里重新出片。");
        }
    }

    /** 任务产物的资产路径集合（同时收 URL 全路径与文件名，容忍 CDN 域名 / 前缀变更）。 */
    private static Set<String> assetPathsOf(List<MaterialVideoJob> jobs) {
        Set<String> out = new HashSet<>();
        for (MaterialVideoJob job : jobs) {
            String path = assetPath(job.getVideoUrl());
            if (path != null) out.add(path);
        }
        return out;
    }

    /**
     * 资产标识：去掉 scheme / host / 查询串，只留路径与文件名。
     * 签名 URL 每次读取都会重签（§4.7.7），因此不能拿整串 URL 直接比。
     */
    static String assetPath(String url) {
        if (url == null || url.isBlank()) return null;
        String value = url.trim();
        int query = value.indexOf('?');
        if (query >= 0) value = value.substring(0, query);
        int scheme = value.indexOf("://");
        if (scheme >= 0) {
            int slash = value.indexOf('/', scheme + 3);
            value = slash >= 0 ? value.substring(slash) : "/";
        }
        int lastSlash = value.lastIndexOf('/');
        String file = lastSlash >= 0 ? value.substring(lastSlash + 1) : value;
        // 文件名带任务/资产 id，足以唯一标识产物；用它比对可跨 CDN 前缀迁移。
        return file.isBlank() ? value : file;
    }

    private static String join(List<Integer> nos) {
        StringBuilder sb = new StringBuilder();
        for (Integer no : nos) {
            if (sb.length() > 0) sb.append("、");
            sb.append(no);
        }
        return sb.toString();
    }

    static AssemblyPlan buildPlan(JsonNode data) {
        JsonNode shotsNode = data == null ? null : data.path("shots");
        if (shotsNode == null || !shotsNode.isArray() || shotsNode.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SHORT_ASSEMBLE_NO_CLIPS",
                    "还没有可合成的分镜视频，请先完成逐镜出片。");
        }
        List<JsonNode> shots = new ArrayList<>();
        shotsNode.forEach(shots::add);
        shots.sort(Comparator.comparingInt(s -> s.path("no").asInt(Integer.MAX_VALUE)));

        List<String> urls = new ArrayList<>();
        List<Segment> segments = new ArrayList<>();
        long expectedDuration = 0;
        StringBuilder fingerprintSource = new StringBuilder();
        List<Integer> missing = new ArrayList<>();
        List<Integer> missingAudio = new ArrayList<>();
        for (JsonNode shot : shots) {
            int no = shot.path("no").asInt(urls.size() + 1);
            String url = text(shot, "videoUrl");
            boolean approved = "done".equals(shot.path("flow").asText(""));
            if (!approved || url == null) {
                missing.add(no);
                continue;
            }
            urls.add(url);
            int duration = Math.max(0, shot.path("dur").asInt(0));
            expectedDuration += duration;
            String dialogue = text(shot, "voText");
            JsonNode audio = shot.path("audio");
            String audioKey = text(audio, "cdnKey");
            String dialogueFingerprint = DramaShortContinuityService.fingerprint(dialogue == null ? "" : dialogue);
            if (dialogue != null && (audioKey == null
                    || !dialogueFingerprint.equals(audio.path("textFingerprint").asText("")))) {
                missingAudio.add(no);
            }
            boolean subtitle = shot.path("sub").asBoolean(true) && dialogue != null;
            segments.add(new Segment(no, url, audioKey, dialogue, subtitle, duration));
            fingerprintSource.append(no).append('|').append(text(shot, "id")).append('|').append(url)
                    .append('|').append(audioKey == null ? "silence" : audioKey)
                    .append('|').append(subtitle).append('|').append(dialogueFingerprint).append('\n');
        }
        if (!missing.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SHORT_ASSEMBLE_INCOMPLETE",
                    "还有分镜缺少已验收视频：镜 " + missing + "。请补齐后重试。");
        }
        if (!missingAudio.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SHORT_ASSEMBLE_AUDIO_INCOMPLETE",
                    "还有分镜缺少与当前台词匹配的配音：镜 " + missingAudio + "。请先生成配音后重试。");
        }
        return new AssemblyPlan(List.copyOf(urls), expectedDuration, sha256(fingerprintSource.toString()), List.copyOf(segments));
    }

    private void normalizeSegment(Path visual, Path audio, Segment segment, double duration,
                                  Path workDir, Path output) {
        List<String> args = new ArrayList<>(List.of("-y", "-stream_loop", "-1", "-i", visual.toString(),
                "-i", audio.toString()));
        String videoFilter = "[0:v]scale=720:1280:force_original_aspect_ratio=increase,"
                + "crop=720:1280,setsar=1,fps=30[base]";
        String mappedVideo = "[base]";
        if (segment.subtitle() && segment.dialogue() != null && !segment.dialogue().isBlank()) {
            Path overlay = overlays.renderCaption(workDir, segment.no(), 0, segment.dialogue(), false);
            args.addAll(List.of("-stream_loop", "-1", "-i", overlay.toString()));
            videoFilter += ";[base][2:v]overlay=0:0:format=auto[v]";
            mappedVideo = "[v]";
        }
        args.addAll(List.of("-t", seconds(duration), "-filter_complex", videoFilter,
                "-map", mappedVideo, "-map", "1:a:0",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart",
                output.toString()));
        ffmpeg.runFfmpeg(args);
    }

    private static String seconds(double value) {
        return String.format(java.util.Locale.ROOT, "%.3f", Math.max(0.04, value));
    }

    private Path download(String url, Path target) throws Exception {
        String abs = url.startsWith("http") ? url
                : "http://localhost:" + serverPort + (url.startsWith("/") ? url : "/" + url);
        if (url.startsWith("http")) {
            String origin = originOf(abs);
            boolean trusted = origin != null && trustedDownloadOrigins.stream().anyMatch(origin::equals);
            if (!trusted) {
                throw BusinessException.badRequest("VIDEO_URL_NOT_ALLOWED",
                        "分镜视频地址必须来自平台自身的 CDN 域，不支持外部或内网地址");
            }
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(abs))
                .timeout(Duration.ofSeconds(120)).GET().build();
        HttpResponse<InputStream> response = HTTP.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() / 100 != 2) {
            throw new IllegalStateException("download failed HTTP " + response.statusCode());
        }
        try (InputStream in = response.body()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
        if (Files.size(target) == 0) throw new IllegalStateException("downloaded clip is empty");
        return target;
    }

    private DramaShort requireOwned(String id, String userId) {
        return repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "DRAMA_SHORT_NOT_FOUND", "短视频草稿不存在"));
    }

    private ObjectNode readPayload(DramaShort row) {
        try {
            JsonNode parsed = row.getPayloadJson() == null ? null : om.readTree(row.getPayloadJson());
            return parsed instanceof ObjectNode object ? object : om.createObjectNode();
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.CONFLICT, "DRAMA_SHORT_PAYLOAD_INVALID",
                    "短视频草稿数据损坏，无法合成，请先重新保存分镜。");
        }
    }

    private JsonNode wire(String key, long durationSec, int shotCount, String at) {
        ObjectNode out = om.createObjectNode();
        String url = signer.signKey(key);
        if (url == null) url = cdnUploader.publicUrlFor(key);
        if (url != null) out.put("url", url); else out.putNull("url");
        out.put("cdnKey", key);
        out.put("durationSec", durationSec);
        out.put("shotCount", shotCount);
        if (at != null) out.put("at", at); else out.putNull("at");
        return out;
    }

    static String originOf(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            URI uri = URI.create(url.trim());
            if (uri.getScheme() == null || uri.getAuthority() == null) return null;
            return uri.getScheme() + "://" + uri.getAuthority();
        } catch (Exception e) {
            return null;
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static String text(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) return null;
        String value = node.get(field).asText(null);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String write(JsonNode node) {
        try { return om.writeValueAsString(node); }
        catch (Exception e) { throw new IllegalStateException("serialize drama short payload", e); }
    }

    private static void cleanup(Path dir) {
        if (dir == null) return;
        try (var walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(path -> {
                try { Files.deleteIfExists(path); } catch (Exception ignore) { /* best-effort */ }
            });
        } catch (Exception ignore) { /* best-effort */ }
    }

    record Segment(int no, String clipUrl, String audioCdnKey, String dialogue,
                   boolean subtitle, int durationSec) {}
    record AssemblyPlan(List<String> clipUrls, long expectedDurationSec, String fingerprint,
                        List<Segment> segments) {}
}
