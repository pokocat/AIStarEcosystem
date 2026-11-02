package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.materialvideo.JusuanH3Contract;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.MediaBytes;
import com.aistareco.common.BusinessException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Prepare an owned voice sample without changing the library original or invoking a model.
 * Callers must run requireOwnedAssetKey before passing a key here, including quote requests. */
final class StudioAudioReference {
    static final double MAX_SECONDS = 14.9;
    record Prepared(String key, double durationSec, double sourceDurationSec) {
        boolean trimmed() { return sourceDurationSec > MAX_SECONDS; }
    }
    private final FileStorageService storage;
    private final FfmpegRunner ffmpeg;
    private final Object[] locks = java.util.stream.IntStream.range(0, 16).mapToObj(i -> new Object()).toArray();
    // Keys are immutable assets. Reuse the same derived key across quotes, submit and provider receipts.
    private final Map<String, Prepared> cache = new LinkedHashMap<>(32, .75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, Prepared> e) { return size() > 256; }
    };
    StudioAudioReference(FileStorageService storage, FfmpegRunner ffmpeg) { this.storage = storage; this.ffmpeg = ffmpeg; }

    Prepared prepare(String user, String key) {
        try {
            var path = storage.openForRead(key);
            long size = Files.size(path);
            if (size <= 0 || size > 25L * 1024 * 1024) throw invalid("声音样本为空或超过 25 MB，请换一段音频");
            byte[] header;
            try (var in = Files.newInputStream(path)) { header = in.readNBytes(4096); }
            if (!MediaBytes.allowed(MediaBytes.sniffConfigured("audio", header), JusuanH3Contract.AUDIO_FORMATS))
                throw invalid("请选择可读取的音频文件作为角色声音");
            var probe = ffmpeg.probeMedia(path.toFile());
            requireReadable(probe);
            if (probe.durationSec() <= MAX_SECONDS) return new Prepared(key, probe.durationSec(), probe.durationSec());
            String identity = user + "\n" + key;
            synchronized (locks[Math.floorMod(identity.hashCode(), locks.length)]) {
                Prepared previous;
                synchronized (cache) { previous = cache.get(identity); }
                if (previous != null) {
                    try { if (Files.size(storage.openForRead(previous.key())) > 0) return previous; }
                    catch (Exception ignored) { synchronized (cache) { cache.remove(identity); } }
                }
                var bytes = trim(path, ffmpeg);
                var stored = storage.store(bytes, IpProjectService.CATEGORY_GEN, user, "wav", "audio/wav");
                var prepared = new Prepared(stored.key(), MAX_SECONDS, probe.durationSec());
                synchronized (cache) { cache.put(identity, prepared); }
                return prepared;
            }
        } catch (BusinessException e) { throw e; }
        catch (Exception e) { throw invalid("声音样本处理失败，请重新上传或选择"); }
    }

    static byte[] trim(Path source, FfmpegRunner ffmpeg) throws java.io.IOException {
        Path output = Files.createTempFile("studio-voice-reference-", ".wav");
        try {
            ffmpeg.runFfmpeg(List.of("-v", "error", "-nostdin", "-y", "-threads", "1", "-i", source.toString(),
                    "-map", "0:a:0", "-vn", "-t", "14.9", "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", output.toString()), 60_000);
            var probe = ffmpeg.probeMedia(output.toFile());
            requireReadable(probe);
            if (probe.durationSec() > MAX_SECONDS + .000001 || Math.abs(probe.durationSec() - MAX_SECONDS) > .01
                    || Files.size(output) < 44 || Files.size(output) > JusuanH3Contract.REFERENCE_AUDIO_MAX_BYTES)
                throw invalid("声音样本截取未完成，请重新选择");
            byte[] bytes = Files.readAllBytes(output);
            if (!MediaBytes.WAV.equals(MediaBytes.sniff("audio", bytes))) throw invalid("声音样本截取未完成，请重新选择");
            return bytes;
        } finally { Files.deleteIfExists(output); }
    }

    private static void requireReadable(FfmpegRunner.MediaProbe probe) {
        if (probe == null || !probe.readable() || !probe.hasAudio() || probe.hasVideo()
                || !Double.isFinite(probe.durationSec()) || probe.durationSec() < JusuanH3Contract.AUDIO_MIN_SECONDS)
            throw invalid("声音样本需要至少 2 秒可读取的人声，请换一段音频");
    }
    private static BusinessException invalid(String message) { return BusinessException.badRequest("STUDIO_MEDIA_INVALID", message); }
}
