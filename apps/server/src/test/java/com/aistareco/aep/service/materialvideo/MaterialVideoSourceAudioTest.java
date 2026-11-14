package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class MaterialVideoSourceAudioTest {
    @TempDir Path temp;

    @Test
    void deliversTheOriginalAudioAndLeavesASilentSourceSilent() throws Exception {
        var ffmpeg = new FfmpegRunner(new com.aistareco.aep.config.MixcutProperties());
        try { ffmpeg.runFfmpeg(List.of("-version"), 10_000); }
        catch (RuntimeException unavailable) { assumeTrue(false, "FFmpeg unavailable"); }

        Path silent = temp.resolve("silent.mp4"), source = temp.resolve("source.mp4"), edited = temp.resolve("edited.mp4");
        ffmpeg.runFfmpeg(List.of("-v", "error", "-f", "lavfi", "-i", "color=blue:s=320x240:d=2", "-c:v", "libx264", silent.toString()), 20_000);
        addTone(ffmpeg, silent, source, 660);
        addTone(ffmpeg, silent, edited, 440);
        Path restored = MaterialVideoSourceAudio.restore(ffmpeg, source, edited);
        Path muted = MaterialVideoSourceAudio.restore(ffmpeg, silent, edited);
        try {
            assertTrue(ffmpeg.probeMedia(restored.toFile()).hasAudio());
            assertFalse(ffmpeg.probeMedia(muted.toFile()).hasAudio());
            assertEquals(2.0, ffmpeg.probeMedia(restored.toFile()).durationSec(), .1);
            Path samples = temp.resolve("samples.raw");
            ffmpeg.runFfmpeg(List.of("-v", "error", "-ss", "0.5", "-i", restored.toString(), "-t", "1",
                    "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", samples.toString()), 20_000);
            byte[] pcm = Files.readAllBytes(samples);
            int crossings = 0, previous = 0;
            for (int i = 0; i + 1 < pcm.length; i += 2) {
                int sample = (short)((pcm[i] & 255) | (pcm[i + 1] << 8));
                if (previous < 0 && sample >= 0) crossings++;
                previous = sample;
            }
            assertEquals(660, crossings, 5, "the soundtrack must come from the 660 Hz source");
        } finally {
            Files.deleteIfExists(restored);
            Files.deleteIfExists(muted);
        }
    }

    private static void addTone(FfmpegRunner ffmpeg, Path video, Path output, int frequency) {
        ffmpeg.runFfmpeg(List.of("-v", "error", "-i", video.toString(), "-f", "lavfi", "-i",
                "sine=frequency=" + frequency + ":duration=2", "-c:v", "copy", "-c:a", "aac",
                "-shortest", output.toString()), 20_000);
    }
}
