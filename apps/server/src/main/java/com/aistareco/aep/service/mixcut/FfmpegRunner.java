package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.MixcutProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 极薄的 ffmpeg / ffprobe ProcessBuilder 包装。
 * 调用方负责构造完整 args；本类负责执行 / 超时 / 收集 stderr。
 */
@Component
public class FfmpegRunner {

    private static final Logger log = LoggerFactory.getLogger(FfmpegRunner.class);

    private final MixcutProperties props;

    public FfmpegRunner(MixcutProperties props) {
        this.props = props;
    }

    /**
     * 执行 ffmpeg，args 不需要包含 "ffmpeg" 本身。返回完整 stderr（ffmpeg 把进度/日志都写 stderr）。
     * 异常抛出 RuntimeException 带 exit code + tail of stderr。
     */
    public String runFfmpeg(List<String> args) {
        return run(props.getFfmpegBin(), args);
    }

    public String runFfprobe(List<String> args) {
        return run(props.getFfprobeBin(), args);
    }

    private String run(String bin, List<String> args) {
        List<String> cmd = new ArrayList<>(args.size() + 1);
        cmd.add(bin);
        cmd.addAll(args);
        log.debug("[mixcut] exec: {}", String.join(" ", cmd));

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);

        Process p;
        try {
            p = pb.start();
        } catch (IOException e) {
            throw new RuntimeException("Failed to start " + bin + ": " + e.getMessage(), e);
        }

        StringBuilder output = new StringBuilder();
        Thread reader = new Thread(() -> {
            try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) {
                    if (output.length() < 32_000) output.append(line).append('\n');
                }
            } catch (IOException ignored) {
                // process killed mid-read
            }
        });
        reader.setDaemon(true);
        reader.start();

        boolean finished;
        try {
            finished = p.waitFor(props.getFfmpegTimeoutMs(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            p.destroyForcibly();
            throw new RuntimeException("ffmpeg interrupted", ie);
        }
        if (!finished) {
            p.destroyForcibly();
            throw new RuntimeException("ffmpeg timed out after " + props.getFfmpegTimeoutMs() + "ms");
        }
        try { reader.join(2000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }

        int code = p.exitValue();
        if (code != 0) {
            String tail = tail(output.toString(), 2_000);
            throw new RuntimeException("ffmpeg exit=" + code + " bin=" + bin + " tail=" + tail);
        }
        return output.toString();
    }

    /** ffprobe 拿视频/图片时长（秒）；失败返回 0。 */
    public double probeDurationSec(File file) {
        try {
            String out = runFfprobe(List.of(
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    file.getAbsolutePath()
            ));
            return Double.parseDouble(out.trim());
        } catch (Exception e) {
            return 0.0;
        }
    }

    private static String tail(String s, int n) {
        if (s == null) return "";
        return s.length() <= n ? s : s.substring(s.length() - n);
    }
}
