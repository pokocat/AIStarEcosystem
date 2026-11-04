package com.aistareco.aep.ipstudio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/** Offline runtime acceptance of the actual bundled Studio adapter; no application context. */
public final class AistarHypitRuntimeVerification {
    public static void main(String[] args) throws Exception {
        Path directory = Files.createTempDirectory("aistar-hypit-acceptance-");
        try {
            Path video = directory.resolve("synthetic.mp4");
            Process source = new ProcessBuilder(List.of("ffmpeg", "-nostdin", "-v", "error",
                    "-threads", "1", "-filter_complex_threads", "1",
                    "-f", "lavfi", "-i", "color=c=red:s=320x240:r=12:d=1",
                    "-f", "lavfi", "-i", "color=c=blue:s=320x240:r=12:d=1",
                    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]",
                    "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-y", video.toString()))
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.INHERIT).start();
            if (!source.waitFor(30, TimeUnit.SECONDS)) {
                source.destroyForcibly();
                throw new IllegalStateException("Synthetic source timed out");
            }
            if (source.exitValue() != 0) throw new IllegalStateException("Synthetic source failed");
            var adapter = new StudioHypitMedia("node");
            adapter.requireReady();
            var evidence = adapter.read(video, directory.resolve("evidence"), 2.0);
            var frames = evidence.path("frames");
            if (frames.size() != 24) throw new IllegalStateException("Native frame clock changed");
            for (int i = 0; i < frames.size(); i++) {
                if (Math.abs(frames.get(i).path("at").asDouble() - i / 12.0) > .002)
                    throw new IllegalStateException("Native timestamp changed");
            }
            Process node = new ProcessBuilder("node", "--version").start();
            String version = new String(node.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).strip();
            if (!node.waitFor(10, TimeUnit.SECONDS) || node.exitValue() != 0)
                throw new IllegalStateException("Node runtime failed");
            System.out.println(new ObjectMapper().writeValueAsString(Map.of(
                    "actual_studio_adapter", true, "node_version", version,
                    "revision", evidence.path("revision").asText(), "frames", frames.size(),
                    "native_timestamps_verified", true, "synthetic_source_only", true,
                    "external_services_called", false)));
        } finally {
            try (var paths = Files.walk(directory)) {
                for (Path path : paths.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }
}
