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
    private final FfmpegRunner ffmpeg;
    private final FileStorageService storage;
    private final ClipAssetService assets;
    private final ClipOverlayRenderer overlays;
    private final ClipMediaQualityGate qualityGate;

    public ClipAssemblyService(FfmpegRunner ffmpeg, FileStorageService storage, ClipAssetService assets,
                               ClipOverlayRenderer overlays, ClipMediaQualityGate qualityGate) {
        this.ffmpeg = ffmpeg;
        this.storage = storage;
        this.assets = assets;
        this.overlays = overlays;
        this.qualityGate = qualityGate;
    }

    public record Result(String outputCdnKey, String thumbnailCdnKey, int durationSec) {}

    public Result assemble(String owner, ClipProject project, Map<String, Object> jobState) {
        Path work = null;
        try {
            work = Files.createTempDirectory("clip-assemble-");
            Map<Integer, Map<String, Object>> states = statesByNo(jobState);
            List<Path> normalized = new ArrayList<>();
            List<Map<String, Object>> segments = ClipShotPlan.materialize(project.getPayloadJson());
            if (segments.isEmpty()) throw failure("出片没有可合成的分段");

            for (Map<String, Object> segment : segments) {
                int no = number(segment.get("no"), -1);
                String role = String.valueOf(segment.get("role"));
                Path output = work.resolve(String.format(Locale.ROOT, "segment-%03d.mp4", no));
                Map<String, Object> state = states.getOrDefault(no, Map.of());
                boolean generatedTail = "tail".equals(role) && text(segment.get("assetId")).isBlank();
                Path overlay = generatedTail
                        ? overlays.renderTail(work, no, project.getTemplateId(), project.getTemplateName())
                        : overlays.render(work, no, "tail".equals(role) ? "" : text(segment.get("text")));
                if ("avatar".equals(role)) normalizeAvatar(state, overlay, output);
                else if ("broll".equals(role)) normalizeBroll(owner, segment, state, overlay, output);
                else if ("tail".equals(role)) normalizeTail(owner, segment, overlay, output);
                else throw failure("出片分段角色无效");
                requireOutput(output);
                normalized.add(output);
            }

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
            extractThumbnail(finalFile, thumbnail);
            requireOutput(thumbnail);
            FileStorageService.StoredFile stored = storage.storeExisting(finalFile, "clip/works", owner,
                    "mp4", "video/mp4", true);
            FileStorageService.StoredFile thumbStored = storage.storeExisting(thumbnail, "clip/thumbnails", owner,
                    "jpg", "image/jpeg", true);
            return new Result(stored.key(), thumbStored.key(), duration);
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
            for (Map<String, Object> segment : segments) {
                int no = number(segment.get("no"), -1);
                String role = String.valueOf(segment.get("role"));
                if (!Set.of("avatar", "broll", "tail").contains(role)) throw failure("出片分段角色无效");
                Path overlay = "tail".equals(role)
                        ? overlays.renderTail(work, no, project.getTemplateId(), project.getTemplateName())
                        : overlays.render(work, no, text(segment.get("text")));
                overlays.markAsTest(overlay);
                Path output = work.resolve(String.format(Locale.ROOT, "segment-%03d.mp4", no));
                renderMockSegment(segment, role, no, overlay, output);
                requireOutput(output);
                normalized.add(output);
            }

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
            extractThumbnail(finalFile, thumbnail);
            requireOutput(thumbnail);
            FileStorageService.StoredFile stored = storage.storeExisting(finalFile, "clip/works", owner,
                    "mp4", "video/mp4", true);
            FileStorageService.StoredFile thumbStored = storage.storeExisting(thumbnail, "clip/thumbnails", owner,
                    "jpg", "image/jpeg", true);
            return new Result(stored.key(), thumbStored.key(), duration);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "CLIP_ASSEMBLY_FAILED",
                    "测试视频总装失败，请稍后重试", e.toString());
        } finally {
            deleteTree(work);
        }
    }

    private void normalizeAvatar(Map<String, Object> state, Path overlay, Path output) throws IOException {
        String key = text(state.get("videoCdnKey"));
        if (key.isBlank()) throw failure("分身出镜段尚未生成完成");
        Path input = storage.openForRead(key);
        List<String> args = new ArrayList<>(List.of("-y", "-i", input.toString(), "-stream_loop", "-1", "-i", overlay.toString(),
                "-filter_complex", decoratedFilter(0, 1), "-map", "[v]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
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
                                Path overlay, Path output) throws IOException {
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
                "-i", audio.toString(), "-stream_loop", "-1", "-i", overlay.toString(), "-t", seconds(duration),
                "-filter_complex", decoratedFilter(0, 2), "-map", "[v]", "-map", "1:a:0",
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

    private void renderMockSegment(Map<String, Object> segment, String role, int no, Path overlay, Path output) {
        int duration = Math.max(1, ClipProjectService.seconds(segment));
        String color = switch (role) {
            case "avatar" -> "#24463c";
            case "broll" -> "#70442e";
            default -> "#17362f";
        };
        int frequency = 360 + Math.floorMod(no, 8) * 35;
        ffmpeg.runFfmpeg(List.of("-y", "-f", "lavfi", "-i",
                "color=c=" + color + ":s=720x1280:r=30:d=" + duration,
                "-f", "lavfi", "-i", "sine=frequency=" + frequency + ":sample_rate=48000:duration=" + duration,
                "-stream_loop", "-1", "-i", overlay.toString(), "-t", String.valueOf(duration),
                "-filter_complex", decoratedFilter(0, 2), "-map", "[v]", "-map", "1:a:0",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart",
                output.toString()));
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
        ffmpeg.runFfmpeg(List.of("-y", "-i", video.toString(), "-map", "0:v:0", "-map", "0:a:0",
                "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k",
                "-movflags", "+faststart", output.toString()));
    }

    private void extractThumbnail(Path video, Path output) {
        ffmpeg.runFfmpeg(List.of("-y", "-ss", "0.2", "-i", video.toString(), "-frames:v", "1",
                "-vf", "scale=360:-2", "-q:v", "3", output.toString()));
    }

    private static String decoratedFilter(int videoIndex, int overlayIndex) {
        return "[" + videoIndex + ":v]" + VIDEO_FILTER + "[base];[base][" + overlayIndex
                + ":v]overlay=0:0:format=auto:shortest=1[v]";
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
