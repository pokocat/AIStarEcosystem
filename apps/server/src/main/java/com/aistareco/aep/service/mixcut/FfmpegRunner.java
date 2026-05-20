package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.MixcutProperties;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 极薄的 ffmpeg / ffprobe ProcessBuilder 包装。
 * 调用方负责构造完整 args；本类负责执行 / 超时 / 收集 stderr。
 */
@Component
public class FfmpegRunner {

    private static final Logger log = LoggerFactory.getLogger(FfmpegRunner.class);
    private static final Pattern FILTER_LINE = Pattern.compile("^\\s*[.A-Z|]{3,}\\s+([A-Za-z0-9_]+)\\s+.*$");

    private final MixcutProperties props;
    private volatile Set<String> availableFilters;

    public FfmpegRunner(MixcutProperties props) {
        this.props = props;
    }

    /**
     * 启动时探测 ffmpeg / ffprobe 是否可执行。失败 log warning（不阻塞 boot）—— 但任何
     * 后续渲染任务最终会失败。
     *
     * 历史问题：用户从 IDE 启动 server 时 PATH 不含 /opt/homebrew/bin，渲染 worker 抛
     * "Cannot run program 'ffmpeg'" 时已经过了 status=running 5%，迷惑性大。这里启动时
     * 一次性打印版本号，让 boot log 一眼可见。
     */
    @PostConstruct
    void probeOnStartup() {
        for (String bin : new String[] {props.getFfmpegBin(), props.getFfprobeBin()}) {
            try {
                String out = run(bin, List.of("-version"));
                String firstLine = out.split("\\R", 2)[0];
                log.info("[mixcut] ✅ {} ready: {}", bin, firstLine);
            } catch (Exception e) {
                log.warn("[mixcut] ⚠️ {} NOT runnable — 渲染任务会失败. 安装: brew install ffmpeg. 错误: {}",
                        bin, e.getMessage());
            }
        }
        try {
            Set<String> filters = availableFilters();
            List<String> missing = List.of("scale", "overlay", "concat", "crop", "eq", "hflip", "drawbox", "boxblur")
                    .stream()
                    .filter(name -> !filters.contains(name))
                    .toList();
            if (missing.isEmpty()) {
                log.info("[mixcut] ffmpeg filter capability check OK ({} filters)", filters.size());
            } else {
                log.warn("[mixcut] ffmpeg filter capability degraded: missing {}. Render worker will fallback where possible.",
                        missing);
            }
        } catch (Exception e) {
            log.warn("[mixcut] cannot inspect ffmpeg filters via `{} -filters`: {}", props.getFfmpegBin(), e.getMessage());
        }
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
        return run(bin, args, 32_000);
    }

    private String run(String bin, List<String> args, int maxOutputChars) {
        List<String> cmd = new ArrayList<>(args.size() + 1);
        cmd.add(bin);
        cmd.addAll(args);
        log.debug("[mixcut] exec: {}", String.join(" ", cmd));
        long t0 = System.nanoTime();

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
                    if (output.length() < maxOutputChars) output.append(line).append('\n');
                }
            } catch (IOException ignored) {
                // process killed mid-read
            }
        });
        reader.setDaemon(true);
        reader.start();

        long startNs = System.nanoTime();
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
            // 让 reader 多读一会，把 destroyForcibly 触发的最后输出收上来
            try { reader.join(1500); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            long elapsedMs = (System.nanoTime() - startNs) / 1_000_000L;
            String tail = tail(output.toString(), 4_000);
            // 超时时带上 stderr 尾巴 —— 否则用户只看到 "timed out" 完全不知道
            // ffmpeg 卡在哪一步（demuxing? filter chain init? encoding?）。
            // 历史上这条错只有时长，每次都得手动加 -loglevel verbose 重跑。
            throw new RuntimeException(
                    "ffmpeg timed out after " + elapsedMs + "ms (limit=" + props.getFfmpegTimeoutMs()
                            + "ms). 调大 aep.mixcut.ffmpeg-timeout-ms 或减小 variants / source 尺寸. tail=" + tail);
        }
        try { reader.join(2000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }

        int code = p.exitValue();
        if (code != 0) {
            // 8KB 的 tail：ffmpeg 失败时的错误消息里通常含完整 filter_complex
            // 字符串 + parser 位置指针。之前 2KB 截到了字符串的尾段，看不见
            // 失败位置，反而误导诊断（用户反复看到 around: 指向同一个 [s0]
            // 标签，但实际错误在更前面的 filter）。8KB 能容下 4K 多字符的
            // filter chain + framing。
            String tail = tail(output.toString(), 8_000);
            throw new RuntimeException("ffmpeg exit=" + code + " bin=" + bin + " tail=" + tail);
        }
        long elapsedMs = (System.nanoTime() - t0) / 1_000_000L;
        // 单次 ffmpeg 调用耗时 — 视频拼接 / 编码慢时能在 log 里直观看到，便于
        // 决定调大 aep.mixcut.ffmpeg-timeout-ms 或减小 variants。
        if (elapsedMs > 20_000L) {
            log.info("[mixcut] {} took {}ms (slow)", bin, elapsedMs);
        } else {
            log.debug("[mixcut] {} took {}ms", bin, elapsedMs);
        }
        return output.toString();
    }

    /**
     * 当前 ffmpeg binary 实际注册的 filters。FFmpeg 官方文档明确建议用
     * `ffmpeg -filters` 查看可用 filter；构建时也可以 `--disable-filters`
     * 或裁掉单个 filter，所以渲染器不能假设 full build。
     */
    public Set<String> availableFilters() {
        Set<String> cached = availableFilters;
        if (cached != null) return cached;
        synchronized (this) {
            if (availableFilters != null) return availableFilters;
            String out = run(props.getFfmpegBin(), List.of("-hide_banner", "-filters"), 512_000);
            Set<String> parsed = new HashSet<>();
            for (String line : out.split("\\R")) {
                Matcher m = FILTER_LINE.matcher(line);
                if (m.matches()) parsed.add(m.group(1));
            }
            availableFilters = Collections.unmodifiableSet(parsed);
            return availableFilters;
        }
    }

    public boolean hasFilter(String name) {
        return availableFilters().contains(name);
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

    /** 文件是否至少有一路音轨。失败/无音 → false。 */
    public boolean hasAudioStream(File file) {
        try {
            String out = runFfprobe(List.of(
                    "-v", "error",
                    "-select_streams", "a",
                    "-show_entries", "stream=codec_type",
                    "-of", "csv=p=0",
                    file.getAbsolutePath()
            ));
            return out != null && out.contains("audio");
        } catch (Exception e) {
            return false;
        }
    }

    private static String tail(String s, int n) {
        if (s == null) return "";
        return s.length() <= n ? s : s.substring(s.length() - n);
    }
}
