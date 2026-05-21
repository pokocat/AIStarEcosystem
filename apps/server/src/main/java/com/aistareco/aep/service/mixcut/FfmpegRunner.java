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
import java.util.Map;
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
    /**
     * 宽松回退正则 —— 当严格 FILTER_LINE 漏掉关键 filter 时尝试。
     * 适配 vendor 定制 build 偏离上游格式的情况（4 位 flag 列 / 含字母 flag 如 `TS.` / 多空格分隔）。
     * 关键约束：要求行尾出现 ffmpeg signature 列（`A->A` / `VV->V` / `|->A` / `N->N` 等），
     * 这是 -filters 输出独有的结构，可避免随便一行三个 token 都被当成 filter。
     */
    private static final Pattern FILTER_LINE_LOOSE = Pattern.compile(
            "^\\s*\\S{1,4}\\s+([a-z][A-Za-z0-9_]*)\\s+[AVN|]+->[AVN|]+(\\s+.*)?$");
    /**
     * v0.21+: 渲染期必检的关键 filter 集合。任一缺失会让 MixcutRenderingService 直接降级
     * （overlay → 丢弃用户 overlay；crop → 输出尺寸失真；eq → 亮度/饱和度静默退回）。
     * `-filters` 文本解析在 vendor build 上偶发漏掉条目，这里在解析后用 `-h filter=<name>`
     * 兜底单条 probe。每个 probe ~30-80ms；首次 boot 多花 0.5s 左右，换来用户能真看到效果。
     */
    private static final List<String> CRITICAL_FILTERS = List.of(
            "scale", "overlay", "concat", "crop", "eq", "hflip",
            "setpts", "aresample", "aformat", "atempo", "amix",
            "format", "split", "boxblur", "drawbox", "color",
            "colorchannelmixer", "volume"
    );

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
                // overlay 是 picgen / 用户图层上必需的；缺它就把诊断快照打全，
                // 用户不用提 issue 我也能从 log 一眼看出是 PATH 问题 / vendor build / 还是真缺。
                if (missing.contains("overlay")) {
                    log.warn("[mixcut] CRITICAL: overlay filter not detected. Diagnostic snapshot follows ↓");
                    try {
                        diagnosticSnapshot().forEach((k, v) ->
                                log.warn("[mixcut]   ffmpeg-diag.{} = {}", k, v));
                    } catch (Exception diagErr) {
                        log.warn("[mixcut] diagnosticSnapshot threw: {}", diagErr.getMessage());
                    }
                }
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
     *
     * 三阶段探测（v0.21+，修复 vendor 定制 build 上 overlay/crop/eq 等关键 filter
     * 被严格正则漏掉、导致用户 picgen overlay 被静默丢弃的问题）：
     *  1. 严格正则 FILTER_LINE 解析 `-filters` 输出
     *  2. 宽松正则 FILTER_LINE_LOOSE 在同一输出上补一遍
     *  3. 对仍未命中的关键 filter (CRITICAL_FILTERS) 单条 `ffmpeg -h filter=<name>` 兜底
     */
    public Set<String> availableFilters() {
        Set<String> cached = availableFilters;
        if (cached != null) return cached;
        synchronized (this) {
            if (availableFilters != null) return availableFilters;

            String out;
            try {
                out = run(props.getFfmpegBin(), List.of("-hide_banner", "-filters"), 512_000);
            } catch (Exception e) {
                log.warn("[mixcut] `{} -filters` failed: {} — will fall back to per-filter probe",
                        props.getFfmpegBin(), e.getMessage());
                out = "";
            }

            Set<String> parsed = new HashSet<>();
            for (String line : out.split("\\R")) {
                Matcher m = FILTER_LINE.matcher(line);
                if (m.matches()) {
                    parsed.add(m.group(1));
                }
            }
            int strictCount = parsed.size();

            for (String line : out.split("\\R")) {
                Matcher m = FILTER_LINE_LOOSE.matcher(line);
                if (m.matches()) {
                    parsed.add(m.group(1));
                }
            }
            int looseAdded = parsed.size() - strictCount;
            if (looseAdded > 0) {
                log.info("[mixcut] loose regex recovered {} additional filter names (strict missed format)", looseAdded);
            }

            Set<String> probedRecovered = new HashSet<>();
            for (String name : CRITICAL_FILTERS) {
                if (parsed.contains(name)) continue;
                if (probeFilter(name)) {
                    parsed.add(name);
                    probedRecovered.add(name);
                }
            }
            if (!probedRecovered.isEmpty()) {
                log.warn("[mixcut] `-filters` parser missed critical filters; recovered via `-h filter=<name>` probe: {}",
                        probedRecovered);
            }

            availableFilters = Collections.unmodifiableSet(parsed);
            log.info("[mixcut] ffmpeg filter set finalized: {} total (strict={}, loose+={}, probe+={})",
                    parsed.size(), strictCount, looseAdded, probedRecovered.size());
            return availableFilters;
        }
    }

    /**
     * 用 `ffmpeg -h filter=<name>` 单条权威探测 filter 是否真实存在。
     * 比 `-filters` 文本解析可靠：直接询问 libavfilter 注册表，无需正则匹配输出格式。
     *
     * 存在：ffmpeg exit=0 且输出含 "Filter <name>" header。
     * 不存在：ffmpeg exit=1 + "Unknown filter '<name>'." (run() 抛 RuntimeException)，或者
     *         个别版本 exit=0 但输出仅含 "Unknown filter" 字样。
     *
     * 每次 probe 都在 INFO 级别留一行诊断（成功 + 失败 + 异常）—— 用户上报"overlay 不被识别"
     * 时不用打 DEBUG 日志重跑，直接 grep `[mixcut] probe filter=` 就能定位。
     */
    private boolean probeFilter(String name) {
        try {
            String out = run(props.getFfmpegBin(),
                    List.of("-hide_banner", "-h", "filter=" + name), 16_000);
            if (out == null) {
                log.warn("[mixcut] probe filter={}: ffmpeg returned null output", name);
                return false;
            }
            String lower = out.toLowerCase();
            if (lower.contains("unknown filter")) {
                log.info("[mixcut] probe filter={} → NOT PRESENT (ffmpeg said 'Unknown filter')", name);
                return false;
            }
            boolean ok = out.contains("Filter " + name)
                    || out.contains("filter '" + name + "'")
                    || lower.contains("filter " + name.toLowerCase());
            if (!ok) {
                log.warn("[mixcut] probe filter={} ran (exit=0) but output 不含预期 'Filter {}' header；first 200 chars: {}",
                        name, name, snip(out, 200));
            } else {
                log.info("[mixcut] probe filter={} → PRESENT (recovered)", name);
            }
            return ok;
        } catch (Exception e) {
            log.warn("[mixcut] probe filter={} threw: {}", name, e.getMessage());
            return false;
        }
    }

    private static String snip(String s, int n) {
        if (s == null) return "(null)";
        return s.length() <= n ? s.replaceAll("\\s+", " ") : s.substring(0, n).replaceAll("\\s+", " ") + " ...";
    }

    /**
     * 诊断信息字典，用于在渲染失败时 attach 到 error_message，避免用户回头翻 server log。
     * Returns:
     *  - bin: 配置里的 ffmpeg 路径（可能是相对名）
     *  - version: ffmpeg -version 第一行
     *  - filters_total: 已识别的 filter 总数
     *  - overlay_present / scale_present / crop_present: 关键 filter 状态
     *  - filters_head: -filters 输出前 300 字（折成单行）
     */
    public Map<String, String> diagnosticSnapshot() {
        Map<String, String> diag = new java.util.LinkedHashMap<>();
        diag.put("bin", props.getFfmpegBin());
        try {
            String ver = run(props.getFfmpegBin(), List.of("-version"), 4_000);
            diag.put("version", ver.split("\\R", 2)[0]);
        } catch (Exception e) {
            diag.put("version", "(failed: " + e.getMessage() + ")");
        }
        Set<String> filters;
        try {
            filters = availableFilters();
            diag.put("filters_total", String.valueOf(filters.size()));
            diag.put("overlay_present", String.valueOf(filters.contains("overlay")));
            diag.put("scale_present", String.valueOf(filters.contains("scale")));
            diag.put("crop_present", String.valueOf(filters.contains("crop")));
        } catch (Exception e) {
            diag.put("filters_total", "(failed: " + e.getMessage() + ")");
        }
        try {
            String head = run(props.getFfmpegBin(), List.of("-hide_banner", "-filters"), 8_000);
            diag.put("filters_head", snip(head, 300));
        } catch (Exception e) {
            diag.put("filters_head", "(failed: " + e.getMessage() + ")");
        }
        try {
            String overlayProbe = run(props.getFfmpegBin(),
                    List.of("-hide_banner", "-h", "filter=overlay"), 8_000);
            diag.put("overlay_probe_head", snip(overlayProbe, 200));
        } catch (Exception e) {
            diag.put("overlay_probe_head", "(threw: " + e.getMessage() + ")");
        }
        return diag;
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
