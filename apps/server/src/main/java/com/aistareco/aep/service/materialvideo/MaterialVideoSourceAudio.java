package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/** Deliver the original soundtrack over the edited picture when the user selects it. */
final class MaterialVideoSourceAudio {
    private MaterialVideoSourceAudio() {}

    static Path restore(FfmpegRunner ffmpeg, Path source, Path edited) throws IOException {
        var original = ffmpeg.probeMedia(source.toFile());
        if (!original.readable() || !original.hasVideo()) throw new IOException("Could not read the original clip");
        var output = Files.createTempFile("studio-video-source-audio-", ".mp4");
        boolean complete = false;
        try {
            if (original.hasAudio()) {
                ffmpeg.runFfmpeg(List.of("-nostdin", "-v", "error", "-y", "-i", edited.toString(), "-i", source.toString(),
                        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                        "-af", "apad", "-shortest", "-movflags", "+faststart", output.toString()), 60_000);
            } else {
                ffmpeg.runFfmpeg(List.of("-nostdin", "-v", "error", "-y", "-i", edited.toString(),
                        "-map", "0:v:0", "-c:v", "copy", "-movflags", "+faststart", output.toString()), 60_000);
            }
            var result = ffmpeg.probeMedia(output.toFile());
            if (!result.readable() || !result.hasVideo() || result.hasAudio() != original.hasAudio())
                throw new IOException("Could not restore the original soundtrack");
            complete = true;
            return output;
        } finally {
            if (!complete) Files.deleteIfExists(output);
        }
    }
}
