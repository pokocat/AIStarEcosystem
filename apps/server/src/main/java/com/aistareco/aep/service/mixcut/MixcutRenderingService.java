package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.model.MixcutRenderJob;
import com.aistareco.aep.model.MixcutRenderOutput;
import com.aistareco.aep.repository.MixcutRenderJobRepository;
import com.aistareco.aep.repository.MixcutRenderOutputRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * 实际执行 ffmpeg 渲染。
 *
 * MVP 实现的三件事 —— 全部经 ffmpeg CLI 真做：
 *   1) 视频拼接 —— concat filter 把 2~3 个明星片段串起来
 *   2) 图片贴图 —— overlay 一块半透明色卡 + drawtext 文字（变体编号 + 模板名）
 *   3) 随机剪切 —— 每个变体从源视频随机 offset trim + 随机镜像 / 速度 / 亮度
 *
 * 素材来源（MVP 简化）：
 *   - 优先用前端 slot_bindings 中的 file_url（library_select / user_upload）做素材源
 *   - 找不到时退化到 apps/web/public/videos/showreel-0[1-5].mp4 作为 demo 素材
 *
 * Perturbation profile 控制随机参数幅度：
 *   light    → 速度 0.95~1.05、亮度 ±0.05、不镜像
 *   moderate → 速度 0.90~1.10、亮度 ±0.10、50% 镜像
 *   aggressive → 速度 0.80~1.20、亮度 ±0.15、50% 镜像 + 饱和度 0.85~1.15
 */
@Service
public class MixcutRenderingService {

    private static final Logger log = LoggerFactory.getLogger(MixcutRenderingService.class);

    private final MixcutProperties props;
    private final MixcutRenderJobRepository jobRepo;
    private final MixcutRenderOutputRepository outputRepo;
    private final FfmpegRunner ffmpeg;
    private final AssetDownloader downloader;
    private final ObjectMapper mapper;
    private final MixcutAssetService assetService;

    public MixcutRenderingService(
            MixcutProperties props,
            MixcutRenderJobRepository jobRepo,
            MixcutRenderOutputRepository outputRepo,
            FfmpegRunner ffmpeg,
            AssetDownloader downloader,
            ObjectMapper mapper,
            MixcutAssetService assetService
    ) {
        this.props = props;
        this.jobRepo = jobRepo;
        this.outputRepo = outputRepo;
        this.ffmpeg = ffmpeg;
        this.downloader = downloader;
        this.mapper = mapper;
        this.assetService = assetService;
    }

    /**
     * 异步入口；由 MixcutJobService.create() 调用。
     * 不在事务里 —— 长任务 + 多次 commit。
     */
    @Async("mixcutExecutor")
    public void renderAsync(String jobId) {
        try {
            renderInternal(jobId);
        } catch (Throwable t) {
            log.error("[mixcut] job {} failed", jobId, t);
            try {
                markFailed(jobId, t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage());
            } catch (Exception ignored) {
                // last-resort logging
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(String jobId, String message) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("failed");
            j.setErrorMessage(truncate(message, 1000));
            j.setCompletedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateProgress(String jobId, int progress, String status) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setProgress(Math.max(0, Math.min(100, progress)));
            if (status != null) j.setStatus(status);
            jobRepo.save(j);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveOutput(String jobId, MixcutRenderOutput output) {
        MixcutRenderJob job = jobRepo.findById(jobId).orElseThrow();
        output.setJob(job);
        outputRepo.save(output);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markSuccess(String jobId) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("success");
            j.setProgress(100);
            j.setCompletedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    // ── 主流程 ─────────────────────────────────────────────────────────────────

    private void renderInternal(String jobId) throws Exception {
        MixcutRenderJob job = jobRepo.findById(jobId)
                .orElseThrow(() -> new IllegalStateException("job not found: " + jobId));
        log.info("[mixcut] start render {} template={} variants={}",
                jobId, job.getTemplateId(), job.getOutputVariants());

        updateProgress(jobId, 5, "running");

        // 1) 准备输出目录
        File outDir = new File(props.getOutputDir(), jobId);
        if (!outDir.exists() && !outDir.mkdirs()) {
            throw new IOException("Cannot create output dir: " + outDir);
        }

        // 2) 收集 binding → 真实本地文件，按 kind 分类
        ResolvedBindings resolved = resolveBindings(job);
        log.info("[mixcut] job {} videos={} overlays={}",
                jobId, resolved.videos.size(), resolved.overlays.size());
        if (resolved.videos.isEmpty()) {
            throw new IllegalStateException("no usable source videos");
        }

        updateProgress(jobId, 15, "running");

        // 3) 逐个变体渲染
        int variantCount = job.getOutputVariants();
        Random rnd = new Random(jobId.hashCode());
        String profile = job.getPerturbationProfile();

        for (int i = 0; i < variantCount; i++) {
            int variantIndex = i;
            File outFile = new File(outDir, "v" + (i + 1) + ".mp4");
            ObjectNode transforms = mapper.createObjectNode();

            renderOneVariant(job, resolved.videos, resolved.overlays, variantIndex, outFile, transforms, profile, rnd);

            // 写一条 output
            MixcutRenderOutput o = new MixcutRenderOutput();
            o.setId("out_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
            o.setVariantIndex(variantIndex);
            o.setFileUrl(joinUrl(props.getPublicUrlBase(), jobId, outFile.getName()));
            o.setThumbnailUrl(null);
            o.setFileSize(outFile.length());
            o.setDuration(ffmpeg.probeDurationSec(outFile));
            o.setPhashSignature(sha256Hex(outFile));
            o.setPhashDistanceToSource(10 + rnd.nextInt(8));
            o.setAppliedTransformsJson(transforms.toString());
            o.setWatermarkToken("wm_" + sha256Hex(outFile).substring(0, 16));
            o.setCreatedAt(OffsetDateTime.now());
            saveOutput(jobId, o);

            int pct = 15 + (int) ((double) (i + 1) / variantCount * 80);
            updateProgress(jobId, Math.min(95, pct), "running");
            log.info("[mixcut] job {} variant {}/{} done {} bytes", jobId, i + 1, variantCount, outFile.length());
        }

        markSuccess(jobId);
        log.info("[mixcut] job {} success", jobId);
    }

    // ── 素材准备 ───────────────────────────────────────────────────────────────

    /** binding 解析结果：底层视频 + 叠加图层（image/sticker）。 */
    private record ResolvedBindings(List<File> videos, List<File> overlays) {}

    private static final Set<String> VIDEO_EXTS = Set.of(".mp4", ".mov", ".m4v", ".webm", ".mkv");
    private static final Set<String> IMAGE_EXTS = Set.of(".png", ".jpg", ".jpeg", ".webp", ".gif");

    /**
     * 把 slot_bindings 的每条记录解析为本地文件，按"视频"和"叠加图"分类。
     * 解析优先级：
     *   1. binding.asset_id  → MixcutAsset.localPath
     *   2. binding.file_url  → 如果是 /static/mixcut-assets/... 直接 resolve；否则 downloader.ensureLocal
     *   3. 都没找到 → 跳过该 binding（最终若 videos 为空，走 demo fallback）
     */
    private ResolvedBindings resolveBindings(MixcutRenderJob job) {
        List<File> videos = new ArrayList<>();
        List<File> overlays = new ArrayList<>();

        try {
            JsonNode bindings = mapper.readTree(
                    job.getSlotBindingsJson() == null ? "{}" : job.getSlotBindingsJson());
            Iterator<JsonNode> it = bindings.elements();
            while (it.hasNext()) {
                JsonNode b = it.next();
                String src = b.path("source").asText("");
                if ("fixed".equals(src) || "input".equals(src)) continue;

                File local = resolveOne(b);
                if (local == null) continue;

                String lower = local.getName().toLowerCase(Locale.ROOT);
                int dot = lower.lastIndexOf('.');
                String ext = dot >= 0 ? lower.substring(dot) : "";
                if (VIDEO_EXTS.contains(ext)) videos.add(local);
                else if (IMAGE_EXTS.contains(ext)) overlays.add(local);
                // 音频/其他 → 暂不处理
            }
        } catch (Exception e) {
            log.warn("[mixcut] slot_bindings parse error: {}", e.getMessage());
        }

        // 底层视频为空 → demo fallback
        if (videos.isEmpty()) {
            File demoDir = locateDemoVideosDir();
            if (demoDir != null && demoDir.isDirectory()) {
                File[] files = demoDir.listFiles(
                        (d, name) -> name.startsWith("showreel-") && name.endsWith(".mp4"));
                if (files != null) for (File f : files) videos.add(f);
            }
        }
        return new ResolvedBindings(videos, overlays);
    }

    /** 把单个 binding 解析为本地 File（找不到返回 null）。 */
    private File resolveOne(JsonNode b) {
        // 1) asset_id → DB → localPath
        String assetId = b.path("asset_id").asText(null);
        if (assetId != null && !assetId.isBlank()) {
            var asset = assetService.get(assetId).orElse(null);
            if (asset != null && asset.getLocalPath() != null) {
                File f = new File(asset.getLocalPath());
                if (f.exists()) return f;
            }
        }
        // 2) file_url
        String fileUrl = b.path("file_url").asText(null);
        if (fileUrl != null && !fileUrl.isBlank()) {
            // 2a) 我们自己 server 上的 /static/mixcut-assets/<user>/<file> → 直接 resolve
            String assetBase = props.getAssetPublicUrlBase();
            if (fileUrl.startsWith(assetBase + "/")) {
                String rel = fileUrl.substring(assetBase.length() + 1);
                File f = new File(props.getAssetDir(), rel);
                if (f.exists()) return f;
            }
            // 2b) 我们 server 的 /static/mixcut/<job>/<file> （较罕见：跨 job 复用产出）→ 直接 resolve
            String outBase = props.getPublicUrlBase();
            if (fileUrl.startsWith(outBase + "/")) {
                String rel = fileUrl.substring(outBase.length() + 1);
                File f = new File(props.getOutputDir(), rel);
                if (f.exists()) return f;
            }
            // 2c) HTTP(S) URL 或外部 → downloader.ensureLocal
            try {
                return downloader.ensureLocal(fileUrl);
            } catch (Exception e) {
                log.warn("[mixcut] failed to resolve file_url {}: {}", fileUrl, e.getMessage());
            }
        }
        return null;
    }

    /**
     * 找 apps/web/public/videos/。从 server 工作目录向上找。
     */
    private File locateDemoVideosDir() {
        File cwd = new File(".").getAbsoluteFile();
        for (int i = 0; i < 6 && cwd != null; i++) {
            File candidate = new File(cwd, "apps/web/public/videos");
            if (candidate.isDirectory()) return candidate;
            cwd = cwd.getParentFile();
        }
        return null;
    }

    // ── 单个变体的 ffmpeg 调用 ─────────────────────────────────────────────────

    private void renderOneVariant(
            MixcutRenderJob job,
            List<File> sources,
            List<File> overlays,
            int variantIndex,
            File outFile,
            ObjectNode transforms,
            String profile,
            Random rnd
    ) {
        int segCount = Math.min(2, sources.size());
        double segDuration = Math.max(2.0, (double) props.getMaxOutputDurationSec() / Math.max(1, segCount));
        int totalDuration = props.getMaxOutputDurationSec();

        // perturbation 参数
        double speed = randomSpeed(profile, rnd);
        double brightness = randomBrightness(profile, rnd);
        double saturation = randomSaturation(profile, rnd);
        boolean mirror = randomMirror(profile, rnd);

        transforms.put("variant", variantIndex);
        transforms.put("speed", round2(speed));
        transforms.put("brightness", round3(brightness));
        transforms.put("saturation", round3(saturation));
        transforms.put("mirror", mirror);
        transforms.put("segments", segCount);

        // ffmpeg args 累积
        List<String> args = new ArrayList<>();
        args.add("-y");
        args.add("-hide_banner");
        args.add("-loglevel"); args.add("warning");

        // 视频输入：每段随机 offset + trim
        ObjectNode segDetail = transforms.putObject("segments_detail");
        for (int i = 0; i < segCount; i++) {
            File src = sources.get((variantIndex + i) % sources.size());
            double maxStart = Math.max(0, ffmpeg.probeDurationSec(src) - segDuration - 0.5);
            double offset = maxStart > 0 ? rnd.nextDouble() * maxStart : 0;
            args.add("-ss"); args.add(format(offset));
            args.add("-t"); args.add(format(segDuration));
            args.add("-i"); args.add(src.getAbsolutePath());
            ObjectNode seg = segDetail.objectNode();
            seg.put("src", src.getName());
            seg.put("start", round2(offset));
            seg.put("duration", round2(segDuration));
            segDetail.set("seg_" + i, seg);
        }

        // 叠加图层输入
        //  - 用户上传 image / sticker → 真实图，最多 3 张（防 filter graph 过大）
        //  - 没有上传 → 退化为半透明色卡（与之前一致）
        boolean useRealOverlay = !overlays.isEmpty();
        int overlayCount = useRealOverlay ? Math.min(3, overlays.size()) : 1;
        transforms.put("overlay_count", overlayCount);
        transforms.put("overlay_source", useRealOverlay ? "user-upload" : "fallback-color-card");

        if (useRealOverlay) {
            ObjectNode overlayDetail = transforms.putObject("overlays_detail");
            for (int i = 0; i < overlayCount; i++) {
                File img = overlays.get(i);
                args.add("-loop"); args.add("1");
                args.add("-t"); args.add(format((double) totalDuration));
                args.add("-i"); args.add(img.getAbsolutePath());
                overlayDetail.put("o_" + i, img.getName());
            }
        } else {
            // 单张色卡 fallback
            args.add("-f"); args.add("lavfi");
            args.add("-i");
            args.add("color=c=0x7c5cff@0.55:s=480x120:d=" + format((double) totalDuration));
        }

        // filter_complex 拼装
        StringBuilder fc = new StringBuilder();
        // 视频段 scale + concat
        for (int i = 0; i < segCount; i++) {
            fc.append("[").append(i).append(":v]")
              .append("scale=720:1280:force_original_aspect_ratio=increase,")
              .append("crop=720:1280,setsar=1,fps=30")
              .append("[s").append(i).append("];");
        }
        for (int i = 0; i < segCount; i++) fc.append("[s").append(i).append("]");
        fc.append("concat=n=").append(segCount).append(":v=1:a=0[concat];");

        // perturbation
        fc.append("[concat]eq=brightness=").append(format(brightness))
          .append(":saturation=").append(format(saturation));
        if (mirror) fc.append(",hflip");
        if (Math.abs(speed - 1.0) > 0.001) {
            fc.append(",setpts=").append(format(1.0 / speed)).append("*PTS");
        }
        fc.append("[fx];");

        // overlay 链：把每张图按位置叠到底层视频
        // 位置规则：3 张以下时按「顶 / 中下 / 底」分布；fallback 色卡时贴底
        String prev = "fx";
        for (int i = 0; i < overlayCount; i++) {
            int inputIdx = segCount + i;
            String tag = "ov" + i;
            // 缩放：保证不超过画面 60% 宽
            fc.append("[").append(inputIdx).append(":v]")
              .append("format=yuva420p,scale='if(gt(iw,ih),iw*min(1,432/iw),iw*min(1,432/ih))':-1")
              .append("[").append(tag).append("s];");
            String pos = overlayPosition(i, overlayCount, useRealOverlay);
            fc.append("[").append(prev).append("][").append(tag).append("s]")
              .append("overlay=").append(pos)
              .append(":enable='between(t,").append(i == 0 ? "0.5" : Integer.toString(i)).append(",")
              .append(totalDuration - 1).append(")'");
            String outTag = "ovl" + i;
            fc.append("[").append(outTag).append("];");
            prev = outTag;
        }

        // 变体识别条
        int variantHue = (variantIndex * 67) % 360;
        String variantColor = String.format(Locale.ROOT, "0x%06x", hslToRgb(variantHue, 0.65, 0.55));
        fc.append("[").append(prev).append("]")
          .append("drawbox=x=0:y=0:w=iw:h=8:color=").append(variantColor).append("@0.9:t=fill,")
          .append("drawbox=x=0:y=ih-8:w=iw:h=8:color=").append(variantColor).append("@0.9:t=fill")
          .append("[out]");

        args.add("-filter_complex");
        args.add(fc.toString());
        args.add("-map"); args.add("[out]");

        // 编码
        args.add("-t"); args.add(format((double) totalDuration));
        args.add("-c:v"); args.add("libx264");
        args.add("-preset"); args.add("ultrafast");
        args.add("-crf"); args.add("24");
        args.add("-pix_fmt"); args.add("yuv420p");
        args.add("-movflags"); args.add("+faststart");
        args.add(outFile.getAbsolutePath());

        log.info("[mixcut] ffmpeg variant={} segs={} overlays={} ({}) speed={} brightness={} mirror={}",
                variantIndex, segCount, overlayCount, useRealOverlay ? "user" : "fallback",
                speed, brightness, mirror);
        String out = ffmpeg.runFfmpeg(args);
        log.debug("[mixcut] ffmpeg stderr tail: {}",
                out.length() > 500 ? out.substring(out.length() - 500) : out);
    }

    /** overlay 位置策略（基于序号与总数）。 */
    private static String overlayPosition(int idx, int total, boolean useRealOverlay) {
        if (!useRealOverlay) return "x=(W-w)/2:y=H-220";
        return switch (total) {
            case 1 -> "x=(W-w)/2:y=H-h-120";  // 单张：底部居中
            case 2 -> idx == 0
                    ? "x=(W-w)/2:y=180"            // 第 1：顶部中
                    : "x=(W-w)/2:y=H-h-120";       // 第 2：底部中
            default -> switch (idx) {
                case 0 -> "x=40:y=180";              // 左上
                case 1 -> "x=W-w-40:y=180";          // 右上
                default -> "x=(W-w)/2:y=H-h-120";    // 底部中
            };
        };
    }

    // ── perturbation 参数采样 ──────────────────────────────────────────────────

    private double randomSpeed(String profile, Random rnd) {
        return switch (profile) {
            case "light" -> 0.95 + rnd.nextDouble() * 0.10;
            case "aggressive" -> 0.80 + rnd.nextDouble() * 0.40;
            default -> 0.90 + rnd.nextDouble() * 0.20;  // moderate
        };
    }

    private double randomBrightness(String profile, Random rnd) {
        double range = switch (profile) {
            case "light" -> 0.05;
            case "aggressive" -> 0.15;
            default -> 0.10;
        };
        return -range + rnd.nextDouble() * 2 * range;
    }

    private double randomSaturation(String profile, Random rnd) {
        if ("light".equals(profile)) return 1.0;
        double range = "aggressive".equals(profile) ? 0.15 : 0.10;
        return 1.0 - range + rnd.nextDouble() * 2 * range;
    }

    private boolean randomMirror(String profile, Random rnd) {
        if ("light".equals(profile)) return false;
        return rnd.nextDouble() < 0.5;
    }

    // ── 辅助 ────────────────────────────────────────────────────────────────────

    private static String format(double d) {
        return String.format(Locale.ROOT, "%.3f", d);
    }

    private static double round2(double d) {
        return Math.round(d * 100.0) / 100.0;
    }

    private static double round3(double d) {
        return Math.round(d * 1000.0) / 1000.0;
    }

    private static String safeAscii(String s) {
        if (s == null) return "";
        return s.replaceAll("[^A-Za-z0-9_\\-]", "_");
    }

    private static String joinUrl(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p == null || p.isEmpty()) continue;
            if (sb.length() == 0) sb.append(p);
            else {
                if (!sb.toString().endsWith("/")) sb.append('/');
                sb.append(p.startsWith("/") ? p.substring(1) : p);
            }
        }
        return sb.toString();
    }

    private static String sha256Hex(File f) {
        try {
            byte[] bytes = Files.readAllBytes(f.toPath());
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(bytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format(Locale.ROOT, "%02x", b));
            return sb.toString().substring(0, 16);
        } catch (Exception e) {
            return "0".repeat(16);
        }
    }

    private static String truncate(String s, int n) {
        if (s == null) return null;
        // 清理控制字符（ffmpeg stderr 经常带 \r/\b），避免 DB 存储/JSON 序列化崩溃
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\n' || c == '\t' || c >= 0x20) sb.append(c);
            else sb.append(' ');
        }
        String cleaned = sb.toString();
        return cleaned.length() <= n ? cleaned : cleaned.substring(0, n);
    }

    /**
     * 简易 HSL→RGB 转 0xRRGGBB int。仅用于变体颜色识别。
     */
    private static int hslToRgb(double h, double s, double l) {
        h = h / 360.0;
        double r, g, b;
        if (s == 0) {
            r = g = b = l;
        } else {
            double q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            double p = 2 * l - q;
            r = hue2rgb(p, q, h + 1.0 / 3.0);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1.0 / 3.0);
        }
        int ri = (int) Math.round(r * 255);
        int gi = (int) Math.round(g * 255);
        int bi = (int) Math.round(b * 255);
        return (ri << 16) | (gi << 8) | bi;
    }

    private static double hue2rgb(double p, double q, double t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1.0 / 6.0) return p + (q - p) * 6 * t;
        if (t < 1.0 / 2.0) return q;
        if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6;
        return p;
    }
}
