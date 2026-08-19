package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.model.ClipAsset;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

/**
 * 快出片逐段总装：所有石榴时效结果已先镜像成 cdnKey，本服务只消费我方存储。
 * 输出统一为 720x1280 / H.264 / AAC；b-roll 原声丢弃，只保留克隆声线 TTS。
 */
@Service
public class ClipAssemblyService {
    private static final String VIDEO_FILTER = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30";

    /**
     * 封面时长。封面不是播放内容，只是给抖音/视频号这类平台抓「第一帧当缩略图」用的那一帧，
     * 所以取到肉眼几乎察觉不到的下限：成片固定 30fps，0.04s ≈ 1.2 帧，落地就是 1~2 帧，
     * 远低于约 0.1s 的视觉停留阈值 —— 观众不会觉得片头杵了一张海报，平台却能稳稳拿到这张图。
     *
     * <p>为什么不干脆 1/30（0.0333）：实测过。同一条命令换成 -t 0.0333 / 0.034，
     * 出来的分段 ffprobe 数不出帧（nb_read_frames 为空）——边界帧被时间戳取整吞掉，
     * 得到的是一段 0 帧的空视频，concat 时反而更糟。0.04 ≈ 1.2 帧留出了余量，
     * 实测稳定落 1 帧（720x1280 / 30fps），拼完总时长只多 0.03~0.05 秒，
     * 四舍五入后上报给用户的成片时长不变。
     *
     * <p>做成常量而不是写死在参数里：万一哪个平台改成抽第 N 帧或某个固定时间点的帧，
     * 调这一个数就能整体加长（例如 1.0），不用回头改 filter 链和分段逻辑。
     */
    static final double COVER_DURATION_SEC = 0.04;

    private final FfmpegRunner ffmpeg;
    private final FileStorageService storage;
    private final ClipAssetService assets;
    private final ClipOverlayRenderer overlays;
    private final ClipCoverRenderer covers;
    private final ClipMediaQualityGate qualityGate;
    private final ClipLoudnessNormalizer loudnessNormalizer;

    public ClipAssemblyService(FfmpegRunner ffmpeg, FileStorageService storage, ClipAssetService assets,
                               ClipOverlayRenderer overlays, ClipCoverRenderer covers, ClipMediaQualityGate qualityGate) {
        this.ffmpeg = ffmpeg;
        this.storage = storage;
        this.assets = assets;
        this.overlays = overlays;
        this.covers = covers;
        this.qualityGate = qualityGate;
        this.loudnessNormalizer = new ClipLoudnessNormalizer(ffmpeg);
    }

    /** bytes = 成片本身 + 封面缩略图。作品要计入用户容量，字节数必须在生成的那一刻就记下来，
  * 事后去存储里 stat 一遍既慢又会因清理而失真。 */
    public record Result(String outputCdnKey, String thumbnailCdnKey, int durationSec, long bytes) {}

    public Result assemble(String owner, ClipProject project, Map<String, Object> jobState) {
        Path work = null;
        try {
            work = Files.createTempDirectory("clip-assemble-");
            Map<Integer, Map<String, Object>> states = statesByNo(jobState);
            List<Path> normalized = new ArrayList<>();
            List<Map<String, Object>> segments = ClipShotPlan.materialize(project.getPayloadJson());
            if (segments.isEmpty()) throw failure("出片没有可合成的分段");
            boolean aiWatermark = aiWatermarkEnabled(project);

            for (Map<String, Object> segment : segments) {
                int no = number(segment.get("no"), -1);
                String role = String.valueOf(segment.get("role"));
                Path output = work.resolve(String.format(Locale.ROOT, "segment-%03d.mp4", no));
                Map<String, Object> state = states.getOrDefault(no, Map.of());
                boolean generatedTail = "tail".equals(role) && text(segment.get("assetId")).isBlank();
                List<Path> overlayLayers = generatedTail
                        ? List.of(overlays.renderTail(work, no, project.getTemplateId(), project.getTemplateName(), aiWatermark))
                        : captionOverlays(work, no, segment, false, aiWatermark);
                if ("avatar".equals(role)) normalizeAvatar(segment, state, overlayLayers, output);
                else if ("broll".equals(role)) normalizeBroll(owner, segment, state, overlayLayers, output);
                else if ("tail".equals(role)) normalizeTail(owner, segment, overlayLayers.get(0), output);
                else throw failure("出片分段角色无效");
                requireOutput(output);
                normalized.add(output);
            }

            boolean covered = prependCover(owner, project, work, normalized, segments);

            Path concat = work.resolve("concat.txt");
            Files.writeString(concat, normalized.stream()
                    .map(path -> "file '" + escapeConcat(path.toAbsolutePath().toString()) + "'")
                    .reduce("", (a, b) -> a + b + "\n"), StandardCharsets.UTF_8);
            Path joined = work.resolve("joined.mp4");
            concat(normalized, concat, joined);

            Path finalFile = joined;
            String bgmAssetId = ClipDtos.string(project.getPayloadJson().get("bgmAssetId"));
            if (bgmAssetId != null && !bgmAssetId.isBlank()) {
                ClipAsset bgm = assets.requiredVisible(owner, bgmAssetId);
                if (!"bgm".equals(bgm.getKind())) throw failure("背景音乐素材类型无效");
                Path mixed = work.resolve("final.mp4");
                mixBgm(joined, storage.openForRead(bgm.getCdnKey()), mixed);
                requireOutput(mixed);
                finalFile = mixed;
            }

            Path loudnessNormalized = work.resolve("loudness-normalized.mp4");
            normalizeLoudness(finalFile, loudnessNormalized);
            requireOutput(loudnessNormalized);
            finalFile = loudnessNormalized;

            double probedDuration = ffmpeg.probeDurationSec(finalFile.toFile());
            if (probedDuration <= 0) throw failure("成片时长无效");
            if (!ffmpeg.hasAudioStream(finalFile.toFile())) throw failure("成片没有音轨");
            qualityGate.assertAcceptable(finalFile);
            int duration = Math.max(1, (int) Math.round(probedDuration));
            Path thumbnail = work.resolve("thumbnail.jpg");
            extractThumbnail(finalFile, thumbnail, covered);
            requireOutput(thumbnail);
            FileStorageService.StoredFile stored = storage.storeExisting(finalFile, "clip/works", owner,
                    "mp4", "video/mp4", true);
            FileStorageService.StoredFile thumbStored = storage.storeExisting(thumbnail, "clip/thumbnails", owner,
                    "jpg", "image/jpeg", true);
            return new Result(stored.key(), thumbStored.key(), duration, stored.bytes() + thumbStored.bytes());
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "CLIP_ASSEMBLY_FAILED",
                    "视频总装失败，请稍后重试", e.toString());
        } finally {
            deleteTree(work);
        }
    }

    /**
     * 非生产测试媒体总装：仍走真实分段、字幕、拼接、BGM、响度/亮度闸、缩略图与作品存储，
     * 只把石榴返回的 avatar/TTS 时效素材替换成确定性本地色块+测试音轨，供预发完整点通。
     */
    public Result assembleMock(String owner, ClipProject project) {
        Path work = null;
        try {
            work = Files.createTempDirectory("clip-assemble-mock-");
            List<Map<String, Object>> segments = ClipShotPlan.materialize(project.getPayloadJson());
            if (segments.isEmpty()) throw failure("出片没有可合成的分段");
            List<Path> normalized = new ArrayList<>();
            boolean aiWatermark = aiWatermarkEnabled(project);
            for (Map<String, Object> segment : segments) {
                int no = number(segment.get("no"), -1);
                String role = String.valueOf(segment.get("role"));
                if (!Set.of("avatar", "broll", "tail").contains(role)) throw failure("出片分段角色无效");
                List<Path> overlayLayers = "tail".equals(role)
                        ? List.of(overlays.renderTail(work, no, project.getTemplateId(), project.getTemplateName(), aiWatermark))
                        : captionOverlays(work, no, segment, true, aiWatermark);
                if ("tail".equals(role)) overlays.markAsTest(overlayLayers.get(0));
                Path output = work.resolve(String.format(Locale.ROOT, "segment-%03d.mp4", no));
                renderMockSegment(segment, role, no, overlayLayers, output);
                requireOutput(output);
                normalized.add(output);
            }

            boolean covered = prependCover(owner, project, work, normalized, segments);

            Path concat = work.resolve("concat.txt");
            Files.writeString(concat, normalized.stream()
                    .map(path -> "file '" + escapeConcat(path.toAbsolutePath().toString()) + "'")
                    .reduce("", (a, b) -> a + b + "\n"), StandardCharsets.UTF_8);
            Path joined = work.resolve("joined.mp4");
            concat(normalized, concat, joined);

            Path finalFile = joined;
            String bgmAssetId = ClipDtos.string(project.getPayloadJson().get("bgmAssetId"));
            if (bgmAssetId != null && !bgmAssetId.isBlank()) {
                ClipAsset bgm = assets.requiredVisible(owner, bgmAssetId);
                if (!"bgm".equals(bgm.getKind())) throw failure("背景音乐素材类型无效");
                Path mixed = work.resolve("final.mp4");
                mixBgm(joined, storage.openForRead(bgm.getCdnKey()), mixed);
                requireOutput(mixed);
                finalFile = mixed;
            }

            Path loudnessNormalized = work.resolve("loudness-normalized.mp4");
            normalizeLoudness(finalFile, loudnessNormalized);
            requireOutput(loudnessNormalized);
            finalFile = loudnessNormalized;
            double probedDuration = ffmpeg.probeDurationSec(finalFile.toFile());
            if (probedDuration <= 0) throw failure("成片时长无效");
            if (!ffmpeg.hasAudioStream(finalFile.toFile())) throw failure("成片没有音轨");
            qualityGate.assertAcceptable(finalFile);
            int duration = Math.max(1, (int) Math.round(probedDuration));
            Path thumbnail = work.resolve("thumbnail.jpg");
            extractThumbnail(finalFile, thumbnail, covered);
            requireOutput(thumbnail);
            FileStorageService.StoredFile stored = storage.storeExisting(finalFile, "clip/works", owner,
                    "mp4", "video/mp4", true);
            FileStorageService.StoredFile thumbStored = storage.storeExisting(thumbnail, "clip/thumbnails", owner,
                    "jpg", "image/jpeg", true);
            return new Result(stored.key(), thumbStored.key(), duration, stored.bytes() + thumbStored.bytes());
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "CLIP_ASSEMBLY_FAILED",
                    "测试视频总装失败，请稍后重试", e.toString());
        } finally {
            deleteTree(work);
        }
    }

    private List<Path> captionOverlays(Path work, int segmentNo, Map<String, Object> segment, boolean testMedia, boolean aiWatermark) {
        List<Map<String, Object>> cues = ClipDtos.mapListValue(segment.get("captions"));
        if (cues.isEmpty()) cues = List.of(Map.of("text", text(segment.get("text"))));
        List<Path> result = new ArrayList<>();
        for (int index = 0; index < cues.size(); index++) {
            Path layer = overlays.renderCaption(work, segmentNo, index, text(cues.get(index).get("text")), aiWatermark);
            if (testMedia) overlays.markAsTest(layer);
            result.add(layer);
        }
        return result;
    }

    private static boolean aiWatermarkEnabled(ClipProject project) {
        Map<String, Object> style = ClipDtos.safeMapValue(project.getPayloadJson().get("subtitleStyle"));
        return style != null && Boolean.TRUE.equals(style.get("aiWatermark"));
    }

    private void normalizeAvatar(Map<String, Object> segment, Map<String, Object> state, List<Path> overlayLayers, Path output) throws IOException {
        String key = text(state.get("videoCdnKey"));
        if (key.isBlank()) throw failure("分身出镜段尚未生成完成");
        Path input = storage.openForRead(key);
        double duration = ffmpeg.probeDurationSec(input.toFile());
        if (duration <= 0) duration = Math.max(1, ClipProjectService.seconds(segment));
        List<String> args = new ArrayList<>(List.of("-y", "-i", input.toString()));
        addOverlayInputs(args, overlayLayers);
        args.addAll(List.of("-filter_complex", decoratedCaptionFilter(0, 1, captionDurations(segment, duration)), "-map", "[v]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-pix_fmt", "yuv420p"));
        if (ffmpeg.hasAudioStream(input.toFile())) {
            args.addAll(List.of("-map", "0:a:0", "-c:a", "aac", "-ar", "48000", "-ac", "2"));
        } else {
            throw failure("分身出镜段没有音轨");
        }
        args.addAll(List.of("-movflags", "+faststart", output.toString()));
        ffmpeg.runFfmpeg(args);
    }

    private void normalizeBroll(String owner, Map<String, Object> segment, Map<String, Object> state,
                                List<Path> overlayLayers, Path output) throws IOException {
        String assetId = text(segment.get("assetId"));
        String audioKey = text(state.get("audioCdnKey"));
        if (assetId.isBlank() || audioKey.isBlank()) throw failure("配画面段的素材或配音尚未准备好");
        ClipAsset asset = assets.requiredVisible(owner, assetId);
        if (!Set.of("video", "image").contains(asset.getKind())) throw failure("配画面素材类型无效");
        Path visual = storage.openForRead(asset.getCdnKey());
        Path audio = storage.openForRead(audioKey);
        double duration = ffmpeg.probeDurationSec(audio.toFile());
        if (duration <= 0) duration = Math.max(1, ClipProjectService.seconds(segment));
        List<String> args = new ArrayList<>(List.of("-y", "-stream_loop", "-1", "-i", visual.toString(),
                "-i", audio.toString()));
        addOverlayInputs(args, overlayLayers);
        args.addAll(List.of("-t", seconds(duration),
                "-filter_complex", decoratedCaptionFilter(0, 2, captionDurations(segment, duration)), "-map", "[v]", "-map", "1:a:0",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart",
                output.toString()));
        ffmpeg.runFfmpeg(args);
    }

    private void normalizeTail(String owner, Map<String, Object> segment, Path overlay, Path output) throws IOException {
        int duration = Math.max(1, ClipProjectService.seconds(segment));
        String assetId = text(segment.get("assetId"));
        if (assetId.isBlank()) {
            ffmpeg.runFfmpeg(List.of("-y", "-f", "lavfi", "-i",
                    "color=c=#17362f:s=720x1280:r=30:d=" + duration,
                    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo:d=" + duration,
                    "-stream_loop", "-1", "-i", overlay.toString(), "-filter_complex", decoratedFilter(0, 2),
                    "-map", "[v]", "-map", "1:a:0", "-c:v", "libx264", "-preset", "veryfast",
                    "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "+faststart", output.toString()));
            return;
        }
        ClipAsset asset = assets.requiredVisible(owner, assetId);
        if (!Set.of("video", "image").contains(asset.getKind())) throw failure("结尾素材类型无效");
        Path visual = storage.openForRead(asset.getCdnKey());
        List<String> args = new ArrayList<>(List.of("-y", "-stream_loop", "-1", "-i", visual.toString()));
        if (ffmpeg.hasAudioStream(visual.toFile())) {
            args.addAll(List.of("-stream_loop", "-1", "-i", overlay.toString(), "-t", String.valueOf(duration),
                    "-filter_complex", decoratedFilter(0, 1), "-map", "[v]", "-map", "0:a:0", "-c:v", "libx264",
                    "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2"));
        } else {
            args.addAll(List.of("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo:d=" + duration,
                    "-stream_loop", "-1", "-i", overlay.toString(), "-t", String.valueOf(duration),
                    "-filter_complex", decoratedFilter(0, 2), "-map", "[v]", "-map", "1:a:0",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac"));
        }
        args.addAll(List.of("-shortest", "-movflags", "+faststart", output.toString()));
        ffmpeg.runFfmpeg(args);
    }

    private void renderMockSegment(Map<String, Object> segment, String role, int no, List<Path> overlayLayers, Path output) {
        int duration = Math.max(1, ClipProjectService.seconds(segment));
        String color = switch (role) {
            case "avatar" -> "#24463c";
            case "broll" -> "#70442e";
            default -> "#17362f";
        };
        int frequency = 360 + Math.floorMod(no, 8) * 35;
        List<String> args = new ArrayList<>(List.of("-y", "-f", "lavfi", "-i",
                "color=c=" + color + ":s=720x1280:r=30:d=" + duration,
                "-f", "lavfi", "-i", "sine=frequency=" + frequency + ":sample_rate=48000:duration=" + duration));
        addOverlayInputs(args, overlayLayers);
        args.addAll(List.of("-t", String.valueOf(duration),
                "-filter_complex", "tail".equals(role) ? decoratedFilter(0, 2)
                        : decoratedCaptionFilter(0, 2, captionDurations(segment, duration)), "-map", "[v]", "-map", "1:a:0",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart",
                output.toString()));
        ffmpeg.runFfmpeg(args);
    }

    /**
     * 把封面拼到成片最前面。封面是可选步骤 —— payload.cover 没开或四个槽位全空就直接跳过，
     * 用户没填就不该凭空多出一段。
     *
     * @return 是否真的加了封面（决定缩略图从第 0 帧还是第 0.2 秒取）
     */
    private boolean prependCover(String owner, ClipProject project, Path work,
                                 List<Path> normalized, List<Map<String, Object>> segments) throws IOException {
        Optional<ClipCoverPlan.Spec> parsed = ClipCoverPlan.parse(project.getPayloadJson());
        if (parsed.isEmpty()) return false;
        ClipCoverPlan.Spec spec = parsed.get();
        Path background = coverBackground(owner, spec, work, normalized, segments);
        Path image = covers.render(work, spec, background);
        Path output = work.resolve("segment-cover.mp4");
        // 封面段的编码参数必须与正片各段完全一致（720x1280 / yuv420p / 30fps / AAC 48k stereo），
        // 否则 concat 的 -c copy 快路径会失败退化成整片重编码。静音轨是必需的：
        // concat 要求每个输入的流构成一致，少一条音轨会直接拼不上。
        ffmpeg.runFfmpeg(List.of("-y", "-loop", "1", "-i", image.toString(),
                "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                "-t", coverSeconds(), "-r", "30",
                "-vf", "scale=720:1280,setsar=1",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest",
                "-movflags", "+faststart", output.toString()));
        requireOutput(output);
        normalized.add(0, output);
        return true;
    }

    /**
     * 封面底图：优先用用户自传的图片素材；否则从成片里抽一帧，默认挑形象出镜段
     * （人在画面里，比空镜更适合当封面）。抽帧失败不阻断出片，渲染器会退回渐变底。
     */
    private Path coverBackground(String owner, ClipCoverPlan.Spec spec, Path work,
                                 List<Path> normalized, List<Map<String, Object>> segments) throws IOException {
        if (!spec.backgroundAssetId().isBlank()) {
            ClipAsset asset = assets.requiredVisible(owner, spec.backgroundAssetId());
            if (!Set.of("video", "image").contains(asset.getKind())) throw failure("封面底图素材类型无效");
            Path source = storage.openForRead(asset.getCdnKey());
            if ("image".equals(asset.getKind())) return source;
            return grabFrame(source, work.resolve("cover-base.jpg"));
        }
        int index = coverSourceIndex(spec.backgroundSourceNo(), segments);
        if (index < 0 || index >= normalized.size()) return null;
        return grabFrame(normalized.get(index), work.resolve("cover-base.jpg"));
    }

    /** 用户指定了源句子就用它所在的镜头，否则第一个 avatar 段，再否则第一段。 */
    public static int coverSourceIndex(int sourceNo, List<Map<String, Object>> segments) {
        if (segments.isEmpty()) return -1;
        if (sourceNo > 0) {
            for (int index = 0; index < segments.size(); index++) {
                for (Object no : ClipDtos.list(segments.get(index).get("sourceNos"))) {
                    if (no instanceof Number n && n.intValue() == sourceNo) return index;
                }
            }
        }
        for (int index = 0; index < segments.size(); index++) {
            if ("avatar".equals(text(segments.get(index).get("role")))) return index;
        }
        return 0;
    }

    private Path grabFrame(Path source, Path output) {
        try {
            ffmpeg.runFfmpeg(List.of("-y", "-ss", "0.5", "-i", source.toString(), "-frames:v", "1",
                    "-q:v", "2", output.toString()));
            return Files.exists(output) && Files.size(output) > 0 ? output : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** 封面时长专用格式化：不能借用 {@link #seconds(double)}，那个会把值抬到 0.1 下限。 */
    private static String coverSeconds() {
        return String.format(Locale.ROOT, "%.3f", COVER_DURATION_SEC);
    }

    private void concat(List<Path> segments, Path list, Path output) {
        if (segments.isEmpty()) throw failure("出片没有可拼接的分段");
        try {
            ffmpeg.runFfmpeg(List.of("-y", "-f", "concat", "-safe", "0", "-i", list.toString(),
                    "-c", "copy", "-movflags", "+faststart", output.toString()));
        } catch (RuntimeException copyFailure) {
            ffmpeg.runFfmpeg(List.of("-y", "-f", "concat", "-safe", "0", "-i", list.toString(),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac",
                    "-ar", "48000", "-ac", "2", "-movflags", "+faststart", output.toString()));
        }
    }

    private void mixBgm(Path video, Path bgm, Path output) {
        ffmpeg.runFfmpeg(List.of("-y", "-i", video.toString(), "-stream_loop", "-1", "-i", bgm.toString(),
                "-filter_complex", "[0:a]volume=1[a0];[1:a]volume=0.12[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[a]",
                "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest",
                "-movflags", "+faststart", output.toString()));
    }

    private void normalizeLoudness(Path video, Path output) {
        loudnessNormalizer.normalize(video, output);
    }

    /**
     * 作品缩略图。有封面时必须从第 0 帧取 —— 封面本来就是给平台当缩略图用的那一帧，
     * 站内列表要和用户发布到抖音后看到的封面一致；0.2 秒的老口径会直接跳过封面取到正片首帧。
     */
    private void extractThumbnail(Path video, Path output, boolean covered) {
        ffmpeg.runFfmpeg(List.of("-y", "-ss", covered ? "0" : "0.2", "-i", video.toString(), "-frames:v", "1",
                "-vf", "scale=360:-2", "-q:v", "3", output.toString()));
    }

    private static String decoratedFilter(int videoIndex, int overlayIndex) {
        return "[" + videoIndex + ":v]" + VIDEO_FILTER + "[base];[base][" + overlayIndex
                + ":v]overlay=0:0:format=auto:shortest=1[v]";
    }

    private static void addOverlayInputs(List<String> args, List<Path> overlayLayers) {
        for (Path overlay : overlayLayers) {
            args.addAll(List.of("-stream_loop", "-1", "-i", overlay.toString()));
        }
    }

    /**
     * 同一画面段可以承载多句文案，但每句字幕必须在自己的配音时间窗内独立出现，
     * 不能把整段文案一次性塞进两行字幕后截断。
     */
    private static String decoratedCaptionFilter(int videoIndex, int firstOverlayIndex, List<Double> durations) {
        if (durations.isEmpty()) return decoratedFilter(videoIndex, firstOverlayIndex);
        StringBuilder filter = new StringBuilder("[").append(videoIndex).append(":v]")
                .append(VIDEO_FILTER).append("[base]");
        String previous = "base";
        double start = 0;
        for (int index = 0; index < durations.size(); index++) {
            double end = start + Math.max(0.1, durations.get(index));
            String output = index == durations.size() - 1 ? "v" : "caption" + index;
            filter.append(";[").append(previous).append("][")
                    .append(firstOverlayIndex + index).append(":v]")
                    .append("overlay=0:0:format=auto:shortest=1:enable='between(t,")
                    .append(seconds(start)).append(',').append(seconds(end)).append(")'[")
                    .append(output).append(']');
            previous = output;
            start = end;
        }
        return filter.toString();
    }

    private static List<Double> captionDurations(Map<String, Object> segment, double totalDuration) {
        List<Map<String, Object>> cues = ClipDtos.mapListValue(segment.get("captions"));
        if (cues.isEmpty()) return List.of(Math.max(0.1, totalDuration));
        List<Double> weights = cues.stream().map(cue -> {
            Object raw = cue.get("durationSec");
            double duration = raw instanceof Number n ? n.doubleValue() : 0;
            return duration > 0 ? duration : (double) Math.max(1, text(cue.get("text")).codePointCount(0, text(cue.get("text")).length()));
        }).toList();
        double totalWeight = weights.stream().mapToDouble(Double::doubleValue).sum();
        double available = Math.max(0.1, totalDuration);
        if (totalWeight <= 0) return List.of(available);
        return weights.stream().map(weight -> available * weight / totalWeight).toList();
    }

    private static Map<Integer, Map<String, Object>> statesByNo(Map<String, Object> jobState) {
        Map<Integer, Map<String, Object>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : ClipDtos.mapListValue(jobState == null ? null : jobState.get("segments"))) {
            int no = number(row.get("no"), -1);
            if (no > 0) result.put(no, row);
        }
        return result;
    }

    private static void requireOutput(Path output) throws IOException {
        if (!Files.exists(output) || Files.size(output) <= 0) throw failure("视频分段输出为空");
    }

    private static String seconds(double value) { return String.format(Locale.ROOT, "%.3f", Math.max(0.1, value)); }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static int number(Object value, int fallback) { return value instanceof Number n ? n.intValue() : fallback; }
    private static String escapeConcat(String path) { return path.replace("'", "'\\''"); }
    private static BusinessException failure(String message) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "CLIP_ASSEMBLY_FAILED", message);
    }
    private static void deleteTree(Path root) {
        if (root == null) return;
        try (var paths = Files.walk(root)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> { try { Files.deleteIfExists(path); } catch (Exception ignored) {} });
        } catch (Exception ignored) {}
    }
}
