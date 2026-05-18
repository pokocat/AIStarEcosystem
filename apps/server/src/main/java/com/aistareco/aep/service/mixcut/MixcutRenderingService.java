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
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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

        // 2) 读取模板快照（v0.10）：画布尺寸、槽位 rect / layer_type / policy、扰动总开关
        RenderContext ctx = buildContext(job);
        log.info("[mixcut] job {} canvas={}x{} slots_in_snapshot={} overrides=mirror:{} speed:{} bright:{} sat:{}",
                jobId, ctx.outputWidth, ctx.outputHeight, ctx.slotMap.size(),
                ctx.overrides.allowMirror, ctx.overrides.allowSpeed,
                ctx.overrides.allowBrightness, ctx.overrides.allowSaturation);

        // 3) 收集 binding → 真实本地文件，按 layer_type / 后缀分类
        ResolvedBindings resolved = resolveBindings(job, ctx);
        log.info("[mixcut] job {} videos={} overlays={}",
                jobId, resolved.videos.size(), resolved.overlays.size());
        if (resolved.videos.isEmpty()) {
            throw new IllegalStateException("no usable source videos");
        }

        updateProgress(jobId, 15, "running");

        // 4) 原片视觉指纹（aHash 64bit hex）。后续每个变体都和这条比对汉明距离。
        //    用第一段底层视频抽中段一帧 → 8×8 灰度 aHash。失败不致命：fallback 全 0,距离会偏高。
        String sourcePhash = "0000000000000000";
        try {
            sourcePhash = PhashUtil.ahashOfVideo(resolved.videos.get(0), ffmpeg, outDir);
            job.setSourcePhash(sourcePhash);
            jobRepo.save(job);
            log.info("[mixcut] job {} source_phash={}", jobId, sourcePhash);
        } catch (Exception e) {
            log.warn("[mixcut] job {} source phash failed: {}", jobId, e.getMessage());
        }

        // 5) 逐个变体渲染
        int variantCount = job.getOutputVariants();
        Random rnd = new Random(jobId.hashCode());
        String profile = job.getPerturbationProfile();

        for (int i = 0; i < variantCount; i++) {
            int variantIndex = i;
            File outFile = new File(outDir, "v" + (i + 1) + ".mp4");
            ObjectNode transforms = mapper.createObjectNode();

            renderOneVariant(job, ctx, resolved.videos, resolved.overlays, resolved.bgm, variantIndex, outFile, transforms, profile, rnd);

            // 抽 1s 处的一帧作为该变体的 poster (失败不致命,占位 null)
            File thumbFile = new File(outDir, "v" + (i + 1) + ".jpg");
            String thumbUrl = null;
            try {
                ffmpeg.runFfmpeg(List.of(
                        "-y",
                        "-ss", "1",
                        "-i", outFile.getAbsolutePath(),
                        "-frames:v", "1",
                        "-update", "1",
                        "-vf", "scale=480:-2",
                        "-q:v", "4",
                        thumbFile.getAbsolutePath()
                ));
                if (thumbFile.exists() && thumbFile.length() > 0) {
                    thumbUrl = joinUrl(props.getPublicUrlBase(), jobId, thumbFile.getName());
                }
            } catch (Exception e) {
                log.warn("[mixcut] job {} variant {} thumbnail extract failed: {}", jobId, i + 1, e.getMessage());
            }

            // 变体视觉指纹 + 与原片的真实汉明距离（aHash 64bit,理论最大 64）
            String variantPhash;
            int phashDistance;
            try {
                variantPhash = PhashUtil.ahashOfVideo(outFile, ffmpeg, outDir);
                phashDistance = PhashUtil.hammingHex(sourcePhash, variantPhash);
            } catch (Exception e) {
                log.warn("[mixcut] job {} variant {} phash failed: {}", jobId, i + 1, e.getMessage());
                variantPhash = sha256Hex(outFile).substring(0, 16);
                phashDistance = 10 + rnd.nextInt(8);
            }

            // 写一条 output
            MixcutRenderOutput o = new MixcutRenderOutput();
            o.setId("out_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
            o.setVariantIndex(variantIndex);
            o.setFileUrl(joinUrl(props.getPublicUrlBase(), jobId, outFile.getName()));
            o.setThumbnailUrl(thumbUrl);
            o.setFileSize(outFile.length());
            o.setDuration(ffmpeg.probeDurationSec(outFile));
            o.setPhashSignature(variantPhash);
            o.setPhashDistanceToSource(phashDistance);
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

    /**
     * binding 解析结果：底层视频 + 叠加图层（image/sticker） + BGM 音轨（可空）。
     * overlay 已按 z_index 升序排好。bgm 只取第一条（多条 BGM 暂不支持）。
     */
    private record ResolvedBindings(List<File> videos, List<OverlaySpec> overlays, File bgm) {}

    /** 单张 overlay 的渲染参数 —— 文件 + 槽位定位信息。 */
    /**
     * Overlay 元数据。fit = "cover"（默认）= 填满裁切；"contain" = 完整居中，
     * letterbox 用原图高斯模糊作为背景。
     */
    private record OverlaySpec(File file, String slotId, NormRect rect, int zIndex, String layerType, String fit) {}

    /** 归一化矩形 (0..1) ；x,y=左上角。 */
    private record NormRect(double x, double y, double w, double h) {}

    /** 槽位元信息（从 slots_snapshot 派生）。 */
    private record SlotInfo(String slotId, String layerType, NormRect rect, int zIndex, String fit) {}

    /** 渲染上下文：从模板快照与 overrides 计算出的、贯穿整个 job 的不变量。 */
    private record RenderContext(
            int outputWidth,
            int outputHeight,
            Map<String, SlotInfo> slotMap,
            Overrides overrides
    ) {}

    /**
     * 任务级扰动总开关。任一项 false ⇒ 全局短路该算子。
     * 前 4 项 = 整段画面级（hflip / atempo / eq.brightness / eq.saturation）；
     * 后 2 项 = 逐素材抖动总开关（与 slot 级 SlotPerturbationPolicy 双层 AND）。
     */
    private record Overrides(
            boolean allowMirror,
            boolean allowSpeed,
            boolean allowBrightness,
            boolean allowSaturation,
            boolean allowPositionJitter,
            boolean allowScaleJitter
    ) {
        static Overrides defaults() { return new Overrides(true, true, true, true, true, true); }
    }

    private static final Set<String> VIDEO_EXTS = Set.of(".mp4", ".mov", ".m4v", ".webm", ".mkv");
    private static final Set<String> IMAGE_EXTS = Set.of(".png", ".jpg", ".jpeg", ".webp", ".gif");
    private static final Set<String> AUDIO_EXTS = Set.of(".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac");
    private static final Set<String> VIDEO_LAYERS = Set.of("video", "digital_human");
    private static final Set<String> OVERLAY_LAYERS = Set.of("image", "sticker", "text");

    /** 从 job 的 snapshot JSON 派生 RenderContext。任何缺省字段都退回安全默认。 */
    private RenderContext buildContext(MixcutRenderJob job) {
        int width = 720;
        int height = 1280;
        try {
            String cs = job.getCanvasSnapshotJson();
            if (cs != null && !cs.isBlank()) {
                JsonNode node = mapper.readTree(cs);
                int w = node.path("width").asInt(0);
                int h = node.path("height").asInt(0);
                if (w > 0 && h > 0) {
                    // 限制到 1080×1920 以内（性能 + 编码器友好）；保持比例
                    double scale = Math.min(1.0, Math.min(1080.0 / w, 1920.0 / h));
                    width = (int) Math.round(w * scale) / 2 * 2;   // 必须偶数
                    height = (int) Math.round(h * scale) / 2 * 2;
                }
            }
        } catch (Exception e) {
            log.warn("[mixcut] canvas snapshot parse error: {}", e.getMessage());
        }

        Map<String, SlotInfo> slotMap = new HashMap<>();
        try {
            String ss = job.getSlotsSnapshotJson();
            if (ss != null && !ss.isBlank()) {
                JsonNode arr = mapper.readTree(ss);
                if (arr.isArray()) {
                    for (JsonNode s : arr) {
                        String slotId = s.path("slot_id").asText(null);
                        if (slotId == null) continue;
                        String layerType = s.path("layer_type").asText("");
                        int zIndex = s.path("z_index").asInt(0);
                        NormRect rect = null;
                        JsonNode r = s.path("rect");
                        if (r.isObject()) {
                            rect = new NormRect(
                                    r.path("x").asDouble(0),
                                    r.path("y").asDouble(0),
                                    r.path("w").asDouble(0),
                                    r.path("h").asDouble(0));
                        }
                        String fit = s.path("fit").asText("cover");
                        if (!"cover".equals(fit) && !"contain".equals(fit)) fit = "cover";
                        slotMap.put(slotId, new SlotInfo(slotId, layerType, rect, zIndex, fit));
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[mixcut] slots snapshot parse error: {}", e.getMessage());
        }

        Overrides overrides = Overrides.defaults();
        try {
            String po = job.getPerturbationOverridesJson();
            if (po != null && !po.isBlank()) {
                JsonNode n = mapper.readTree(po);
                overrides = new Overrides(
                        n.path("allow_mirror").asBoolean(true),
                        n.path("allow_speed").asBoolean(true),
                        n.path("allow_brightness").asBoolean(true),
                        n.path("allow_saturation").asBoolean(true),
                        n.path("allow_position_jitter").asBoolean(true),
                        n.path("allow_scale_jitter").asBoolean(true));
            }
        } catch (Exception e) {
            log.warn("[mixcut] perturbation overrides parse error: {}", e.getMessage());
        }

        return new RenderContext(width, height, slotMap, overrides);
    }

    /**
     * 把 slot_bindings 的每条记录解析为本地文件，按"视频"和"叠加图"分类。
     * 路由优先级：
     *   1. snapshot.slotMap[slot_id].layer_type → video/digital_human=底层；image/sticker/text=overlay
     *   2. snapshot 缺失时，回退到按文件后缀分类
     * overlay 列表按 z_index 升序排好（小 z 先合成，大 z 在上）。
     */
    private ResolvedBindings resolveBindings(MixcutRenderJob job, RenderContext ctx) {
        List<File> videos = new ArrayList<>();
        List<OverlaySpec> overlays = new ArrayList<>();
        File bgm = null;

        try {
            JsonNode bindings = mapper.readTree(
                    job.getSlotBindingsJson() == null ? "{}" : job.getSlotBindingsJson());
            Iterator<Map.Entry<String, JsonNode>> it = bindings.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> entry = it.next();
                String slotId = entry.getKey();
                JsonNode b = entry.getValue();
                String src = b.path("source").asText("");
                if ("fixed".equals(src) || "input".equals(src)) continue;

                File local = resolveOne(b);
                if (local == null) continue;

                SlotInfo slot = ctx.slotMap.get(slotId);
                String layerType = slot != null ? slot.layerType : inferLayerFromExt(local);
                if (VIDEO_LAYERS.contains(layerType)) {
                    videos.add(local);
                } else if (OVERLAY_LAYERS.contains(layerType)) {
                    int z = slot != null ? slot.zIndex : 0;
                    NormRect rect = slot != null ? slot.rect : null;
                    String fit = slot != null && slot.fit != null ? slot.fit : "cover";
                    overlays.add(new OverlaySpec(local, slotId, rect, z, layerType, fit));
                } else if ("audio".equals(layerType)) {
                    if (bgm == null) bgm = local; // 仅取第一条 BGM
                }
            }
        } catch (Exception e) {
            log.warn("[mixcut] slot_bindings parse error: {}", e.getMessage());
        }

        overlays.sort(Comparator.comparingInt(OverlaySpec::zIndex));

        // 底层视频为空 → demo fallback
        if (videos.isEmpty()) {
            File demoDir = locateDemoVideosDir();
            if (demoDir != null && demoDir.isDirectory()) {
                File[] files = demoDir.listFiles(
                        (d, name) -> name.startsWith("showreel-") && name.endsWith(".mp4"));
                if (files != null) for (File f : files) videos.add(f);
            }
        }
        return new ResolvedBindings(videos, overlays, bgm);
    }

    /** 无 snapshot 时按后缀回退判断 layer 类别。 */
    private static String inferLayerFromExt(File f) {
        String lower = f.getName().toLowerCase(Locale.ROOT);
        int dot = lower.lastIndexOf('.');
        String ext = dot >= 0 ? lower.substring(dot) : "";
        if (VIDEO_EXTS.contains(ext)) return "video";
        if (IMAGE_EXTS.contains(ext)) return "image";
        if (AUDIO_EXTS.contains(ext)) return "audio";
        return "";
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
            RenderContext ctx,
            List<File> sources,
            List<OverlaySpec> overlays,
            File bgm,
            int variantIndex,
            File outFile,
            ObjectNode transforms,
            String profile,
            Random rnd
    ) {
        int segCount = Math.min(2, sources.size());
        double segDuration = Math.max(2.0, (double) props.getMaxOutputDurationSec() / Math.max(1, segCount));
        int totalDuration = props.getMaxOutputDurationSec();
        int W = ctx.outputWidth;
        int H = ctx.outputHeight;

        // perturbation 参数（按 overrides 短路；被关掉的算子用恒等值，不进入 filter）
        double speed       = ctx.overrides.allowSpeed       ? randomSpeed(profile, rnd)       : 1.0;
        double brightness  = ctx.overrides.allowBrightness  ? randomBrightness(profile, rnd)  : 0.0;
        double saturation  = ctx.overrides.allowSaturation  ? randomSaturation(profile, rnd)  : 1.0;
        boolean mirror     = ctx.overrides.allowMirror      && randomMirror(profile, rnd);

        transforms.put("variant", variantIndex);
        transforms.put("speed", round2(speed));
        transforms.put("brightness", round3(brightness));
        transforms.put("saturation", round3(saturation));
        transforms.put("mirror", mirror);
        transforms.put("segments", segCount);
        transforms.put("canvas_w", W);
        transforms.put("canvas_h", H);
        ObjectNode overridesNode = transforms.putObject("overrides");
        overridesNode.put("allow_mirror", ctx.overrides.allowMirror);
        overridesNode.put("allow_speed", ctx.overrides.allowSpeed);
        overridesNode.put("allow_brightness", ctx.overrides.allowBrightness);
        overridesNode.put("allow_saturation", ctx.overrides.allowSaturation);
        overridesNode.put("allow_position_jitter", ctx.overrides.allowPositionJitter);
        overridesNode.put("allow_scale_jitter", ctx.overrides.allowScaleJitter);

        // ffmpeg args 累积
        List<String> args = new ArrayList<>();
        args.add("-y");
        args.add("-hide_banner");
        args.add("-loglevel"); args.add("warning");

        // 视频输入：每段随机 offset + trim；同时探测音轨存在性,决定是否走 concat 音频路径
        ObjectNode segDetail = transforms.putObject("segments_detail");
        boolean allHaveAudio = true;
        for (int i = 0; i < segCount; i++) {
            File src = sources.get((variantIndex + i) % sources.size());
            double maxStart = Math.max(0, ffmpeg.probeDurationSec(src) - segDuration - 0.5);
            double offset = maxStart > 0 ? rnd.nextDouble() * maxStart : 0;
            args.add("-ss"); args.add(format(offset));
            args.add("-t"); args.add(format(segDuration));
            args.add("-i"); args.add(src.getAbsolutePath());
            boolean srcHasAudio = ffmpeg.hasAudioStream(src);
            if (!srcHasAudio) allHaveAudio = false;
            ObjectNode seg = segDetail.objectNode();
            seg.put("src", src.getName());
            seg.put("start", round2(offset));
            seg.put("duration", round2(segDuration));
            seg.put("has_audio", srcHasAudio);
            segDetail.set("seg_" + i, seg);
        }
        boolean useSourceAudio = allHaveAudio;
        boolean useBgm = bgm != null && bgm.exists();
        boolean hasAudio = useSourceAudio || useBgm;
        transforms.put("audio_source", useBgm
                ? (useSourceAudio ? "source+bgm" : "bgm")
                : (useSourceAudio ? "source" : "silent"));

        // 叠加图层输入
        //  - snapshot 解析出的 overlay（已按 z_index 排序）→ 真实图
        //  - 没有可用 overlay → 退化为半透明色卡兜底
        boolean useRealOverlay = !overlays.isEmpty();
        int overlayCount = useRealOverlay ? Math.min(4, overlays.size()) : 1;
        transforms.put("overlay_count", overlayCount);
        transforms.put("overlay_source", useRealOverlay ? "user-upload" : "fallback-color-card");

        if (useRealOverlay) {
            ObjectNode overlayDetail = transforms.putObject("overlays_detail");
            for (int i = 0; i < overlayCount; i++) {
                OverlaySpec spec = overlays.get(i);
                args.add("-loop"); args.add("1");
                args.add("-t"); args.add(format((double) totalDuration));
                args.add("-i"); args.add(spec.file.getAbsolutePath());
                ObjectNode od = overlayDetail.objectNode();
                od.put("file", spec.file.getName());
                od.put("slot_id", spec.slotId);
                od.put("layer_type", spec.layerType);
                od.put("z_index", spec.zIndex);
                od.put("fit", spec.fit);
                if (spec.rect != null) {
                    ObjectNode r = od.putObject("rect");
                    r.put("x", round3(spec.rect.x));
                    r.put("y", round3(spec.rect.y));
                    r.put("w", round3(spec.rect.w));
                    r.put("h", round3(spec.rect.h));
                }
                overlayDetail.set("o_" + i, od);
            }
        } else {
            args.add("-f"); args.add("lavfi");
            args.add("-i");
            args.add("color=c=0x7c5cff@0.55:s=" + (W / 2) + "x" + Math.max(80, H / 16) + ":d=" + format((double) totalDuration));
        }

        // BGM 输入（如果有）—— 循环到 totalDuration
        int bgmInputIdx = -1;
        if (useBgm) {
            bgmInputIdx = segCount + (useRealOverlay ? overlayCount : 1);
            args.add("-stream_loop"); args.add("-1");
            args.add("-t"); args.add(format((double) totalDuration));
            args.add("-i"); args.add(bgm.getAbsolutePath());
        }

        // filter_complex 拼装
        StringBuilder fc = new StringBuilder();
        // 视频段 scale + concat → 严格按 ctx 画布；音频归一化到 stereo 44.1kHz 再 concat
        for (int i = 0; i < segCount; i++) {
            fc.append("[").append(i).append(":v]")
              .append("scale=").append(W).append(":").append(H).append(":force_original_aspect_ratio=increase,")
              .append("crop=").append(W).append(":").append(H).append(",setsar=1,fps=30")
              .append("[s").append(i).append("];");
            if (useSourceAudio) {
                fc.append("[").append(i).append(":a]")
                  .append("aresample=44100,aformat=channel_layouts=stereo")
                  .append("[as").append(i).append("];");
            }
        }
        // concat 输入交错:[s0][as0][s1][as1]... 当含音频时;否则只 [s0][s1]
        if (useSourceAudio) {
            for (int i = 0; i < segCount; i++) {
                fc.append("[s").append(i).append("]").append("[as").append(i).append("]");
            }
            fc.append("concat=n=").append(segCount).append(":v=1:a=1[concat_v][concat_a];");
        } else {
            for (int i = 0; i < segCount; i++) fc.append("[s").append(i).append("]");
            fc.append("concat=n=").append(segCount).append(":v=1:a=0[concat_v];");
        }

        // perturbation 视频链（eq 总是写一次以保持链条完整；恒等值无视觉影响）
        fc.append("[concat_v]eq=brightness=").append(format(brightness))
          .append(":saturation=").append(format(saturation));
        if (mirror) fc.append(",hflip");
        if (Math.abs(speed - 1.0) > 0.001) {
            fc.append(",setpts=").append(format(1.0 / speed)).append("*PTS");
        }
        fc.append("[fx];");

        // perturbation 音频链:speed≠1 时同步 atempo;再决定是否 amix BGM
        String audioOutTag = null;
        if (useSourceAudio) {
            if (Math.abs(speed - 1.0) > 0.001) {
                fc.append("[concat_a]atempo=").append(format(speed)).append("[fx_a];");
                audioOutTag = "fx_a";
            } else {
                audioOutTag = "concat_a";
            }
        }
        if (useBgm) {
            // BGM 单路归一化
            fc.append("[").append(bgmInputIdx).append(":a]")
              .append("aresample=44100,aformat=channel_layouts=stereo,volume=0.6")
              .append("[bgm_a];");
            if (audioOutTag != null) {
                // 源音 + BGM 混合(源音权重高,BGM 0.6 已降过)
                fc.append("[").append(audioOutTag).append("][bgm_a]")
                  .append("amix=inputs=2:duration=longest:dropout_transition=0")
                  .append("[mix_a];");
                audioOutTag = "mix_a";
            } else {
                audioOutTag = "bgm_a";
            }
        }

        // overlay 链：每张图按 slot.rect 精确定位 + 缩放（force_original_aspect_ratio=decrease 防止失真）
        String prev = "fx";
        for (int i = 0; i < overlayCount; i++) {
            int inputIdx = segCount + i;
            String tag = "ov" + i;

            int rx, ry, rw, rh;
            if (useRealOverlay && overlays.get(i).rect != null) {
                NormRect r = overlays.get(i).rect;
                rx = (int) Math.round(r.x * W);
                ry = (int) Math.round(r.y * H);
                rw = Math.max(2, (int) Math.round(r.w * W));
                rh = Math.max(2, (int) Math.round(r.h * H));
            } else {
                // 无 rect → 按位置序号兜底（保留旧逻辑）
                int[] fallback = overlayFallback(i, overlayCount, W, H, useRealOverlay);
                rx = fallback[0]; ry = fallback[1]; rw = fallback[2]; rh = fallback[3];
            }

            // 填充方式分支（v0.13+ 模板字段 slot.fit）
            //   cover  = 填满裁切：force_original_aspect_ratio=increase + crop=rw:rh
            //   contain = 完整居中：split → 一路 cover+boxblur 作为 letterbox 背景，
            //                       另一路 fit-inside 作为主体，再 overlay 居中
            // 都用 crop 截到精确 rw x rh，避免旧版 scale-decrease+pad 在边界 rounding 时报
            //   "Padded dimensions cannot be smaller than input dimensions"。
            String fit = useRealOverlay && overlays.get(i).fit != null
                    ? overlays.get(i).fit
                    : "cover";
            if ("contain".equals(fit)) {
                // 模糊背景填充：[i:v] split → [bg] cover+blur，[fg] fit，[bg][fg] overlay center
                String bgTag = tag + "bg";
                String fgTag = tag + "fg";
                fc.append("[").append(inputIdx).append(":v]")
                  .append("format=yuva420p,split=2[").append(bgTag).append("0][").append(fgTag).append("0];");
                fc.append("[").append(bgTag).append("0]")
                  .append("scale=").append(rw).append(":").append(rh)
                  .append(":force_original_aspect_ratio=increase,")
                  .append("crop=").append(rw).append(":").append(rh).append(",")
                  .append("boxblur=14:1,eq=brightness=-0.05")
                  .append("[").append(bgTag).append("];");
                fc.append("[").append(fgTag).append("0]")
                  .append("scale=").append(rw).append(":").append(rh)
                  .append(":force_original_aspect_ratio=decrease")
                  .append("[").append(fgTag).append("];");
                fc.append("[").append(bgTag).append("][").append(fgTag).append("]")
                  .append("overlay=(W-w)/2:(H-h)/2:format=auto")
                  .append("[").append(tag).append("s];");
            } else {
                // 填满裁切（默认）：scale-increase + crop
                fc.append("[").append(inputIdx).append(":v]")
                  .append("format=yuva420p,scale=").append(rw).append(":").append(rh)
                  .append(":force_original_aspect_ratio=increase,")
                  .append("crop=").append(rw).append(":").append(rh)
                  .append("[").append(tag).append("s];");
            }
            fc.append("[").append(prev).append("][").append(tag).append("s]")
              .append("overlay=x=").append(rx).append(":y=").append(ry)
              .append(":enable='between(t,").append(i == 0 ? "0.0" : "0.0").append(",")
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
        if (hasAudio && audioOutTag != null) {
            args.add("-map"); args.add("[" + audioOutTag + "]");
        }

        // 编码
        args.add("-t"); args.add(format((double) totalDuration));
        args.add("-c:v"); args.add("libx264");
        args.add("-preset"); args.add("ultrafast");
        args.add("-crf"); args.add("24");
        args.add("-pix_fmt"); args.add("yuv420p");
        if (hasAudio && audioOutTag != null) {
            args.add("-c:a"); args.add("aac");
            args.add("-b:a"); args.add("128k");
            args.add("-ar"); args.add("44100");
            args.add("-ac"); args.add("2");
        } else {
            args.add("-an"); // 显式无音轨,避免某些播放器报错
        }
        args.add("-movflags"); args.add("+faststart");
        args.add(outFile.getAbsolutePath());

        log.info("[mixcut] ffmpeg variant={} canvas={}x{} segs={} overlays={} ({}) audio={} speed={} brightness={} mirror={}",
                variantIndex, W, H, segCount, overlayCount, useRealOverlay ? "user" : "fallback",
                hasAudio ? (useBgm ? (useSourceAudio ? "source+bgm" : "bgm") : "source") : "none",
                speed, brightness, mirror);
        String out = ffmpeg.runFfmpeg(args);
        log.debug("[mixcut] ffmpeg stderr tail: {}",
                out.length() > 500 ? out.substring(out.length() - 500) : out);
    }

    /** 无 slot.rect 时按序号兜底定位。返回 [x, y, w, h] 像素值。 */
    private static int[] overlayFallback(int idx, int total, int W, int H, boolean useRealOverlay) {
        int defaultW = (int) (W * 0.6);
        int defaultH = (int) (H * 0.08);
        if (!useRealOverlay) {
            return new int[]{ (W - defaultW) / 2, H - 220, defaultW, defaultH };
        }
        return switch (total) {
            case 1 -> new int[]{ (W - defaultW) / 2, H - defaultH - 120, defaultW, defaultH };
            case 2 -> idx == 0
                    ? new int[]{ (W - defaultW) / 2, 180, defaultW, defaultH }
                    : new int[]{ (W - defaultW) / 2, H - defaultH - 120, defaultW, defaultH };
            default -> switch (idx) {
                case 0 -> new int[]{ 40, 180, defaultW / 2, defaultH };
                case 1 -> new int[]{ W - defaultW / 2 - 40, 180, defaultW / 2, defaultH };
                default -> new int[]{ (W - defaultW) / 2, H - defaultH - 120, defaultW, defaultH };
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
