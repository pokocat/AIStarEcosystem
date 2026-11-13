package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.MediaBytes;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Free canvas imports. Content is validated before storage/quota writes; no model or credit calls. */
@Service
public class StudioMediaImportService {
    private static final long MIB = 1024L * 1024;
    private final FileStorageService storage;
    private final FfmpegRunner ffmpeg;
    private final StudioAudioReference audioReferences;
    @org.springframework.beans.factory.annotation.Autowired(required=false) private IpSavedAssetService savedAssets;
    @org.springframework.beans.factory.annotation.Autowired private com.fasterxml.jackson.databind.ObjectMapper mapper;
    public record MediaImportResult(String key, String url, String mediaType, String mimeType,
                                    long bytes, String fileName, Integer width, Integer height, Double durationSec) {}
    public StudioMediaImportService(FileStorageService storage, FfmpegRunner ffmpeg) {
        this.storage = storage; this.ffmpeg = ffmpeg;
        this.audioReferences = new StudioAudioReference(storage, ffmpeg);
    }
    public MediaImportResult uploadMusic(String user, MultipartFile file) {
        return uploadImageOrAudio(user, file, "audio", false, null);
    }
    /** Preserve uploaded originals; prepare the model's short sample when binding the voice. */
    public MediaImportResult uploadReferenceAudio(String user, MultipartFile file) {
        return uploadImageOrAudio(user, file, "audio", true, null);
    }
    /** 存储上限检查（开关默认关，见 StudioStorageGuard）。 */
    private com.aistareco.aep.ipstudio.history.StudioStorageGuard storageGuard;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setStorageGuard(@org.springframework.context.annotation.Lazy com.aistareco.aep.ipstudio.history.StudioStorageGuard storageGuard) {
        this.storageGuard = storageGuard;
    }

    public static final long VIDEO_MAX_BYTES = 128 * MIB;
    public static final double REFERENCE_VIDEO_MAX_SECONDS = 60;
    static final String SOURCE = IpProjectService.CATEGORY_SOURCE;
    private static final long TRANSCODE_TIMEOUT = 480_000;

    public record UploadResponse(String key, String url, String mediaType, String mimeType, Long bytes,
                                 String fileName, Integer width, Integer height, Double durationSec, String jobId) {
        public static UploadResponse ready(MediaImportResult result) {
            return new UploadResponse(result.key(), result.url(), result.mediaType(), result.mimeType(),
                    result.bytes(), result.fileName(), result.width(), result.height(), result.durationSec(), null);
        }
        public static UploadResponse queued(String id) {
            return new UploadResponse(null, null, null, null, null, null, null, null, null, id);
        }
    }

    record VideoInput(Path file, String name) {}
    record VideoSource(Path file, FfmpegRunner.MediaProbe probe) {}

    // All HTTP video imports opt in to jobs. Legacy clients still get a synchronous response for short clips.
    public UploadResponse accept(String user, MultipartFile file, String type, String folder, boolean background,
                                 StudioMediaJobs jobs) {
        if (!"video".equals(type)) return UploadResponse.ready(uploadImageOrAudio(user, file, type, false, folder));
        validateSize(user, file, type);
        Path tmp = null;
        try {
            tmp = Files.createTempFile("studio-import-", ".mp4");
            file.transferTo(tmp);
            VideoSource source = inspectVideo(tmp);
            String name = fileName(file.getOriginalFilename());
            if (compatible(source.probe())) {
                return UploadResponse.ready(saveVideo(user, source, name, folder));
            }
            if (background) return UploadResponse.queued(jobs.normalize(user, new VideoInput(tmp, name), folder).id());
            if (source.probe().durationSec() > REFERENCE_VIDEO_MAX_SECONDS) {
                throw invalid("此视频需要兼容处理，请刷新页面后重新上传");
            }
            return UploadResponse.ready(convertInline(user, source, name, folder));
        } catch (IOException e) {
            throw invalid("视频读取失败，请重新选择");
        } finally {
            deleteTemp(tmp);
        }
    }

    private MediaImportResult uploadImageOrAudio(String user, MultipartFile file, String type, boolean voiceReference, String folder) {
        long max = validateSize(user, file, type);
        byte[] bytes;
        try { bytes = file.getBytes(); } catch (IOException e) { throw invalid("文件读取失败，请重新选择"); }
        if (bytes.length == 0 || bytes.length > max) throw invalid("文件大小不符合要求，请重新选择");
        var format = MediaBytes.sniff(type, bytes);
        if (format == null || "image".equals(type) && !Set.of("jpg", "jpeg", "png").contains(format.ext())
                || "audio".equals(type) && !Set.of("mp3", "wav", "m4a").contains(format.ext())) {
            throw invalid(unsupportedFile(type, bytes));
        }
        Integer width = null, height = null;
        Double duration = null;
        if ("image".equals(type)) {
            try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                if (input == null) throw invalid("图片无法读取");
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw invalid("图片无法读取");
                var reader = readers.next();
                try { reader.setInput(input, true, true); width = reader.getWidth(0); height = reader.getHeight(0); }
                finally { reader.dispose(); }
                if (!validDimensions(width, height) || width > 8000 || height > 8000) {
                    throw invalid("图片最长边不能超过 8000 像素，总像素不能超过 2400 万");
                }
            } catch (BusinessException e) { throw e; }
            catch (Exception e) { throw invalid("图片内容无法读取，请换一张图片"); }
        } else {
            Path tmp = null;
            try {
                tmp = Files.createTempFile("studio-import-", "." + format.ext());
                Files.write(tmp, bytes);
                var probe = ffmpeg.probeMedia(tmp.toFile());
                if (!validDuration(probe) || !probe.hasAudio() || probe.hasVideo()) {
                    throw invalid("音频没有可读取的声音，请重新选择");
                }
                duration = probe.durationSec();
                if (voiceReference && duration < com.aistareco.aep.service.materialvideo.JusuanH3Contract.AUDIO_MIN_SECONDS) {
                    throw invalid("角色声音需要至少 2 秒，请换一段音频");
                }
            } catch (IOException e) { throw invalid("音视频无法读取，请重新选择"); }
            finally { deleteTemp(tmp); }
        }
        checkQuota(user, bytes.length);
        var stored = storage.store(bytes, SOURCE, user, format.ext(), format.mime());
        var result = new MediaImportResult(stored.key(), storage.signedUrl(stored.key()), type, format.mime(),
                stored.bytes(), fileName(file.getOriginalFilename()), width, height, duration);
        saveAsset(user, result, folder, null);
        return result;
    }

    private MediaImportResult convertInline(String user, VideoSource source, String name, String folder) throws IOException {
        Path output = Files.createTempFile("studio-compatible-", ".mp4");
        try {
            var normalized = renderVideo(source, output, null, null, 150_000L);
            return saveVideo(user, normalized, name, folder);
        } finally { deleteTemp(output); }
    }

    VideoSource inspectVideo(Path file) throws IOException {
        if (Files.size(file) <= 0 || Files.size(file) > VIDEO_MAX_BYTES) throw invalid("视频文件为空或超过 128 MB");
        try (var stream = Files.newInputStream(file)) {
            byte[] header = stream.readNBytes(4096);
            if (MediaBytes.sniff("video", header) == null) throw invalid(unsupportedFile("video", header));
        }
        var probe = ffmpeg.probeMedia(file.toFile());
        checkVideo(probe);
        return new VideoSource(file, probe);
    }

    private static void checkVideo(FfmpegRunner.MediaProbe probe) {
        if (!validDuration(probe) || !probe.hasVideo()) throw invalid("视频没有可读取的画面，请重新选择");
        if (!validDimensions(probe.width(), probe.height())) throw invalid("视频尺寸无法读取或过大");
    }

    private static boolean validDuration(FfmpegRunner.MediaProbe probe) {
        return probe.readable() && Double.isFinite(probe.durationSec()) && probe.durationSec() > 0;
    }

    private static boolean validDimensions(int width, int height) {
        return width > 0 && height > 0 && (long) width * height <= 24_000_000;
    }

    private static boolean compatible(FfmpegRunner.MediaProbe probe) {
        return "h264".equals(probe.videoCodec()) && (!probe.hasAudio() || "aac".equals(probe.audioCodec()));
    }

    VideoSource renderVideo(VideoSource source, Path output, Double start, Double end, long timeout) throws IOException {
        var probe = source.probe();
        boolean clip = start != null;
        if (clip && end > probe.durationSec() + .001) throw invalid("截取终点超过原片时长");
        var args = new ArrayList<>(List.of("-v", "error", "-nostdin", "-y", "-threads", "2"));
        if (clip) args.addAll(List.of("-ss", Double.toString(start)));
        args.addAll(List.of("-i", source.file().toString(), "-map", "0:v:0", "-map", "0:a:0?"));
        // Re-encode excerpts for a precise start even when it falls between keyframes.
        double expected = clip ? end - start : probe.durationSec();
        if (clip) args.addAll(List.of("-t", Double.toString(Math.min(expected, REFERENCE_VIDEO_MAX_SECONDS - .05))));
        if (!clip && "h264".equals(probe.videoCodec())) args.addAll(List.of("-c:v", "copy"));
        else args.addAll(List.of("-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264",
                "-threads", "2", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"));
        args.addAll(List.of("-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                "-fs", Long.toString(VIDEO_MAX_BYTES + 1), output.toString()));
        try { ffmpeg.runFfmpeg(args, timeout); }
        catch (RuntimeException error) {
            throw BusinessException.wrapped(org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
                    "STUDIO_VIDEO_TRANSCODE_FAILED", clip ? "片段处理失败，请缩短所选片段或重试" : "视频兼容处理失败，请重试",
                    error.toString());
        }
        var normalized = ffmpeg.probeMedia(output.toFile());
        checkVideo(normalized);
        if (!compatible(normalized) || probe.hasAudio() != normalized.hasAudio()
                || Math.abs(normalized.durationSec() - expected) > .5
                || clip && normalized.durationSec() > REFERENCE_VIDEO_MAX_SECONDS
                || Files.size(output) < 1 || Files.size(output) > VIDEO_MAX_BYTES) {
            throw invalid(clip ? "截取后的片段不符合要求，请调整起止时间" : "视频兼容处理未完成，请重试");
        }
        return new VideoSource(output, normalized);
    }

    VideoSource renderVideo(VideoSource source, Path output, Double start, Double end) throws IOException {
        return renderVideo(source, output, start, end, TRANSCODE_TIMEOUT);
    }

    private MediaImportResult saveVideo(String user, VideoSource video, String name, String folder) throws IOException {
        Path file = video.file();
        checkQuota(user, Files.size(file));
        var stored = storage.storePath(file, SOURCE, user, "mp4", "video/mp4");
        var result = videoResult(stored, video.probe(), name);
        saveAsset(user, result, folder, null);
        return result;
    }

    MediaImportResult videoResult(FileStorageService.StoredFile stored, FfmpegRunner.MediaProbe probe, String name) {
        return new MediaImportResult(stored.key(), storage.signedUrl(stored.key()), "video", "video/mp4",
                stored.bytes(), name, probe.width(), probe.height(), probe.durationSec());
    }

    void saveAsset(String user, MediaImportResult result, String folder, String originalKey) {
        if (savedAssets == null) return;
        var asset = mapper.createObjectNode().put("kind", result.mediaType()).put("title", result.fileName())
                .put("source", "用户上传");
        var data = asset.putObject("data").put("storageKey", result.key()).put("mimeType", result.mimeType())
                .put("bytes", result.bytes());
        if (result.width() != null) data.put("width", result.width());
        if (result.height() != null) data.put("height", result.height());
        if (result.durationSec() != null) data.put("durationSec", result.durationSec());
        var metadata = asset.putObject("metadata");
        if (folder != null) metadata.put("folderId", folder);
        if (originalKey != null) metadata.put("originalStorageKey", originalKey);
        savedAssets.saveAutomatic(user, asset);
    }

    void checkQuota(String user, long bytes) {
        if (storageGuard != null) storageGuard.checkUpload(user, bytes);
    }

    private long validateSize(String user, MultipartFile file, String type) {
        if (!Set.of("image", "video", "audio").contains(type == null ? "" : type)) throw invalid("请选择图片、视频或音频");
        long max = "video".equals(type) ? VIDEO_MAX_BYTES : ("image".equals(type) ? 8 : 25) * MIB;
        if (file == null || file.isEmpty()) throw invalid("文件是空的，请重新选择");
        if (file.getSize() > max) throw invalid("文件超过 " + max / MIB + " MB，请压缩后重试");
        checkQuota(user, file.getSize());
        return max;
    }

    static String fileName(String filename) {
        String name = filename == null ? "画布附件" : filename.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").strip();
        if (name.isBlank()) return "画布附件";
        return name.substring(0, name.offsetByCodePoints(0, Math.min(100, name.codePointCount(0, name.length()))));
    }

    static void deleteTemp(Path path) {
        if (path != null) try { Files.deleteIfExists(path); } catch (IOException ignored) { }
    }

    public record ReferenceAudio(String key, double durationSec, double sourceDurationSec) {}
    /** Caller verifies key ownership first. Preserve the library original; bind a derived short sample if needed. */
    public ReferenceAudio prepareReferenceAudio(String user, String ownedKey) {
        var sample = audioReferences.prepare(user, ownedKey);
        return new ReferenceAudio(sample.key(), sample.durationSec(), sample.sourceDurationSec());
    }
    /** Says what the file actually is when its bytes tell us; a video dropped on an image slot reads as "not an image". */
    static String unsupportedFile(String type, byte[] bytes) {
        String kind = "image".equals(type) ? "图片" : "video".equals(type) ? "视频" : "音频";
        String supported = "image".equals(type) ? "JPG、PNG" : "video".equals(type) ? "MP4" : "MP3、WAV、M4A";
        var actual = MediaBytes.sniffConfigured(type, bytes);
        return actual == null ? "这个文件不是可用的" + kind + "，请选择 " + supported + " 格式的文件"
                : "暂不支持 " + actual.ext().toUpperCase(java.util.Locale.ROOT) + " 格式的" + kind + "，请换成 " + supported + " 格式";
    }
    private static BusinessException invalid(String message) { return BusinessException.badRequest("STUDIO_MEDIA_INVALID", message); }
}
