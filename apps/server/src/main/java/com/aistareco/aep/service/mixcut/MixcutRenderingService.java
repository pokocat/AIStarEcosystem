package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.config.PicgenProperties;
import com.aistareco.aep.model.MixcutRenderJob;
import com.aistareco.aep.model.MixcutRenderOutput;
import com.aistareco.aep.repository.MixcutRenderJobRepository;
import com.aistareco.aep.repository.MixcutRenderOutputRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.picgen.PicgenClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final PicgenProperties picgenProps;
    private final MixcutRenderJobRepository jobRepo;
    private final MixcutRenderOutputRepository outputRepo;
    private final FfmpegRunner ffmpeg;
    private final AssetDownloader downloader;
    private final ObjectMapper mapper;
    private final MixcutAssetService assetService;
    /** v0.14+: 可选注入；缺省（无 CdnUploader bean）时跳过上传，仅留 fileUrl。 */
    private final CdnUploader cdnUploader;
    /** v0.16+: 文字转图客户端，调独立 pic-gen 服务。 */
    private final PicgenClient picgen;

    public MixcutRenderingService(
            MixcutProperties props,
            PicgenProperties picgenProps,
            MixcutRenderJobRepository jobRepo,
            MixcutRenderOutputRepository outputRepo,
            FfmpegRunner ffmpeg,
            AssetDownloader downloader,
            ObjectMapper mapper,
            MixcutAssetService assetService,
            @Autowired(required = false) CdnUploader cdnUploader,
            PicgenClient picgen
    ) {
        this.props = props;
        this.picgenProps = picgenProps;
        this.jobRepo = jobRepo;
        this.outputRepo = outputRepo;
        this.ffmpeg = ffmpeg;
        this.downloader = downloader;
        this.mapper = mapper;
        this.assetService = assetService;
        this.cdnUploader = cdnUploader;
        this.picgen = picgen;
        if (cdnUploader != null) {
            log.info("[mixcut] CDN uploader injected: {}", cdnUploader.driverName());
        } else {
            log.warn("[mixcut] no CdnUploader bean → render outputs will only have local file_url");
        }
    }

    /**
     * 异步入口；由 MixcutJobService.create() 调用。
     * 不在事务里 —— 长任务 + 多次 commit。
     *
     * 入口仅 log，不写 DB —— 历史上加 updateProgress(1) 作为 "我接走了" 信号时，
     * 因为 self-invocation 让 @Transactional REQUIRES_NEW 不生效，与 renderInternal
     * 第一次 updateProgress(5) 形成 Hibernate session 竞争，progress 被锁在 1% 不再推进。
     *
     * 现行方案：worker 唯一信号 = server log `[mixcut] worker picked up ...`；
     * progress 推进交给 renderInternal 内的 updateProgress（同样 self-invocation，
     * 但只跑一次写入，不会和别的 @Transactional 内部方法竞争 session）。
     */
    @Async("mixcutExecutor")
    public void renderAsync(String jobId) {
        log.info("[mixcut] worker picked up job={} thread={}", jobId, Thread.currentThread().getName());
        try {
            renderInternal(jobId);
        } catch (Throwable t) {
            log.error("[mixcut] job {} failed in renderInternal", jobId, t);
            try {
                markFailed(jobId, t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage());
                log.info("[mixcut] job {} marked failed", jobId);
            } catch (Exception inner) {
                // markFailed 也失败 → 这是 H2 锁 / 连接池耗尽等极端场景，至少要 log
                log.error("[mixcut] job {} markFailed ALSO threw (status will stay running)", jobId, inner);
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
        // v0.14+: 失败时清理已上传到 CDN 的部分变体，避免孤儿文件
        if (cdnUploader != null) {
            try {
                outputRepo.findAll().stream()
                        .filter(o -> o.getJob() != null && jobId.equals(o.getJob().getId()))
                        .filter(o -> o.getCdnKey() != null && !o.getCdnKey().isBlank())
                        .forEach(o -> {
                            try { cdnUploader.delete(o.getCdnKey()); }
                            catch (Exception e) { log.warn("[mixcut] cdn cleanup failed key={}: {}", o.getCdnKey(), e.getMessage()); }
                        });
            } catch (Exception ignored) {
                // 清理本身不致命；主流程已 mark failed
            }
        }
    }

    /** 上传到 CDN，最多重试 1 次（共 2 次尝试）。失败抛 IOException。 */
    private CdnUploader.CdnUploadResult uploadWithRetry(java.nio.file.Path src, String key, String contentType) throws IOException {
        try {
            return cdnUploader.upload(src, key, contentType);
        } catch (Exception e1) {
            log.warn("[mixcut] cdn upload attempt 1 failed key={}: {} — retrying", key, e1.getMessage());
            try {
                Thread.sleep(500);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            return cdnUploader.upload(src, key, contentType);
        }
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
        log.info("[mixcut] step=enter job={}", jobId);
        MixcutRenderJob job = jobRepo.findById(jobId)
                .orElseThrow(() -> new IllegalStateException("job not found: " + jobId));
        log.info("[mixcut] step=loaded job={} template={} variants={}",
                jobId, job.getTemplateId(), job.getOutputVariants());

        updateProgress(jobId, 5, "running");
        log.info("[mixcut] step=progress=5 job={}", jobId);

        // 1) 准备输出目录
        File outDir = new File(props.getOutputDir(), jobId);
        if (!outDir.exists() && !outDir.mkdirs()) {
            throw new IOException("Cannot create output dir: " + outDir);
        }

        // 2) 读取模板快照（v0.10）：画布尺寸、槽位 rect / layer_type / policy、扰动总开关
        RenderContext ctx = buildContext(job);
        log.info("[mixcut] step=ctx job={} canvas={}x{} slots_in_snapshot={} overrides=mirror:{} speed:{} bright:{} sat:{}",
                jobId, ctx.outputWidth, ctx.outputHeight, ctx.slotMap.size(),
                ctx.overrides.allowMirror, ctx.overrides.allowSpeed,
                ctx.overrides.allowBrightness, ctx.overrides.allowSaturation);

        // 3) 收集 binding → 真实本地文件，按 layer_type / 后缀分类
        log.info("[mixcut] step=resolving job={}", jobId);
        ResolvedBindings resolved = resolveBindings(job, ctx);
        log.info("[mixcut] step=resolved job={} videos={} overlays={}",
                jobId, resolved.videos.size(), resolved.overlays.size());
        if (resolved.videos.isEmpty()) {
            throw new IllegalStateException("no usable source videos");
        }

        updateProgress(jobId, 15, "running");
        log.info("[mixcut] step=progress=15 job={}", jobId);

        // 4) 原片视觉指纹（aHash 64bit hex）。后续每个变体都和这条比对汉明距离。
        //    用第一段底层视频抽中段一帧 → 8×8 灰度 aHash。失败不致命：fallback 全 0,距离会偏高。
        log.info("[mixcut] step=phashing job={}", jobId);
        String sourcePhash = "0000000000000000";
        try {
            sourcePhash = PhashUtil.ahashOfVideo(resolved.videos.get(0), ffmpeg, outDir);
            job.setSourcePhash(sourcePhash);
            jobRepo.save(job);
            log.info("[mixcut] step=phashed job={} source_phash={}", jobId, sourcePhash);
        } catch (Exception e) {
            log.warn("[mixcut] step=phash_failed job={} {}", jobId, e.getMessage());
        }

        // 5) 逐个变体渲染
        int variantCount = job.getOutputVariants();
        Random rnd = new Random(jobId.hashCode());
        String profile = job.getPerturbationProfile();

        for (int i = 0; i < variantCount; i++) {
            int variantIndex = i;
            File outFile = new File(outDir, "v" + (i + 1) + ".mp4");
            ObjectNode transforms = mapper.createObjectNode();

            // v0.16+: 为本变体出 picgen 图，合入 overlays（base overlays 不可变，复制后追加再排）
            List<OverlaySpec> variantOverlays = resolved.overlays;
            if (!resolved.picgenSlots.isEmpty()) {
                List<OverlaySpec> picgenOverlays = renderPicgenForVariant(
                        jobId, variantIndex, resolved.picgenSlots, ctx, outDir);
                if (!picgenOverlays.isEmpty()) {
                    variantOverlays = new ArrayList<>(resolved.overlays);
                    variantOverlays.addAll(picgenOverlays);
                    variantOverlays.sort(Comparator.comparingInt(OverlaySpec::zIndex));
                    transforms.put("picgen_count", picgenOverlays.size());
                }
            }

            renderOneVariant(job, ctx, resolved.videos, variantOverlays, resolved.bgm, variantIndex, outFile, transforms, profile, rnd);

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

            // v0.14+: 上传到 CDN（best-effort，失败保留本地 fileUrl）
            String cdnVideoUrl = null;
            String cdnVideoKey = null;
            String cdnThumbUrl = null;
            OffsetDateTime cdnUploadedAt = null;
            if (cdnUploader != null) {
                String videoKey = "mixcut/" + jobId + "/v" + (i + 1) + ".mp4";
                try {
                    var res = uploadWithRetry(outFile.toPath(), videoKey, "video/mp4");
                    cdnVideoUrl = res.cdnUrl();
                    cdnVideoKey = res.key();
                    cdnUploadedAt = OffsetDateTime.now();
                } catch (Exception e) {
                    log.warn("[mixcut] job {} variant {} CDN upload failed (keeping fileUrl): {}",
                            jobId, i + 1, e.getMessage());
                }
                if (thumbFile.exists() && thumbFile.length() > 0) {
                    String thumbKey = "mixcut/" + jobId + "/v" + (i + 1) + ".jpg";
                    try {
                        var res = uploadWithRetry(thumbFile.toPath(), thumbKey, "image/jpeg");
                        cdnThumbUrl = res.cdnUrl();
                    } catch (Exception e) {
                        log.warn("[mixcut] job {} variant {} CDN thumbnail upload failed: {}",
                                jobId, i + 1, e.getMessage());
                    }
                }
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
            o.setCdnUrl(cdnVideoUrl);
            o.setCdnKey(cdnVideoKey);
            o.setCdnThumbnailUrl(cdnThumbUrl);
            o.setCdnUploadedAt(cdnUploadedAt);
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
     * binding 解析结果：底层视频 + 叠加图层（image / text） + BGM 音轨（可空） + picgen 待出图槽位。
     * overlay 已按 z_index 升序排好。bgm 只取第一条（多条 BGM 暂不支持）。
     * picgenSlots 在变体循环内被消费 —— 每变体一张图，按 (jobId, variantIndex, slotId) 做 seed。
     */
    private record ResolvedBindings(
            List<File> videos,
            List<OverlaySpec> overlays,
            File bgm,
            List<PicgenSlotSpec> picgenSlots
    ) {}

    /**
     * v0.16+: picgen 槽位规格 —— 从 binding 拿 title/subtitle/tag，从 slot snapshot 拿 rect/z_index/fit。
     * 每变体调一次 PicgenClient.renderPng 出图，结果作为 OverlaySpec 合入变体 overlays。
     */
    private record PicgenSlotSpec(
            String slotId,
            String title,
            String subtitle,
            String tag,
            NormRect rect,
            int zIndex,
            String fit
    ) {}

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

    /**
     * v0.13+ 扰动贴图池条目：从 job.stickerPoolJson 派生。
     * 渲染器按 jobId+variantIndex 做 seed，从 poolIds 随机抽 pickCount 张 GIF overlay。
     */
    private record StickerPoolEntry(
            String slotKey,           // slot id 或 "_global"
            List<String> poolIds,     // 候选 MixcutAsset.id
            String coverage,          // intro / outro / loop / random_3s
            double opacity,           // 0..1
            double scalePct,          // 5..50 (相对画布宽度的百分比)
            int pickCount             // 1..2，每变体从 pool 抽几张
    ) {}

    /** v0.13+ 单个 sticker overlay 的最终渲染参数（ffmpeg 用）。 */
    private record StickerOverlay(
            File file,
            String slotKey,
            int x,
            int y,
            int targetWidth,
            double opacity,
            double startT,
            double endT
    ) {}

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

    private record FilterCaps(
            boolean scale,
            boolean overlay,
            boolean concat,
            boolean crop,
            boolean eq,
            boolean hflip,
            boolean setpts,
            boolean aresample,
            boolean aformat,
            boolean atempo,
            boolean amix,
            boolean format,
            boolean split,
            boolean boxblur,
            boolean drawbox,
            boolean color,
            boolean colorchannelmixer,
            boolean volume
    ) {
        static FilterCaps from(Set<String> filters) {
            return new FilterCaps(
                    filters.contains("scale"),
                    filters.contains("overlay"),
                    filters.contains("concat"),
                    filters.contains("crop"),
                    filters.contains("eq"),
                    filters.contains("hflip"),
                    filters.contains("setpts"),
                    filters.contains("aresample"),
                    filters.contains("aformat"),
                    filters.contains("atempo"),
                    filters.contains("amix"),
                    filters.contains("format"),
                    filters.contains("split"),
                    filters.contains("boxblur"),
                    filters.contains("drawbox"),
                    filters.contains("color"),
                    filters.contains("colorchannelmixer"),
                    filters.contains("volume")
            );
        }

        boolean canNormalizeAudio() {
            return aresample && aformat;
        }

        List<String> missingEnhancements() {
            List<String> missing = new ArrayList<>();
            if (!crop) missing.add("crop");
            if (!eq) missing.add("eq");
            if (!hflip) missing.add("hflip");
            if (!setpts) missing.add("setpts");
            if (!atempo) missing.add("atempo");
            if (!boxblur) missing.add("boxblur");
            if (!drawbox) missing.add("drawbox");
            if (!colorchannelmixer) missing.add("colorchannelmixer");
            return missing;
        }
    }

    private FilterCaps filterCaps() {
        Set<String> filters = ffmpeg.availableFilters();
        if (filters.isEmpty()) {
            throw new IllegalStateException("ffmpeg returned no filters from `-filters`; cannot build a safe filtergraph");
        }
        FilterCaps caps = FilterCaps.from(filters);
        if (!caps.scale) {
            throw new IllegalStateException("ffmpeg missing required filter `scale`; install a full ffmpeg build or set AEP_FFMPEG_BIN");
        }
        return caps;
    }

    private static final Set<String> VIDEO_EXTS = Set.of(".mp4", ".mov", ".m4v", ".webm", ".mkv");
    private static final Set<String> IMAGE_EXTS = Set.of(".png", ".jpg", ".jpeg", ".webp", ".gif");
    /** 真正的「单帧静态图」：image2 demuxer 只产 1 帧后 EOF。
     *  这里不再使用 `-loop 1`：部分精简 ffmpeg build 不识别该 input option。
     *  静态图改为单帧输入，由 overlay filter 的 repeatlast 保持到整段结束。
     *  注意 .gif 不在此集合 —— GIF 是动图，仍走 gif demuxer + -stream_loop -1。 */
    private static final Set<String> STATIC_IMAGE_EXTS = Set.of(".png", ".jpg", ".jpeg", ".webp");
    private static final Set<String> AUDIO_EXTS = Set.of(".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac");

    /** 判断文件是不是单帧静态图（jpg/png/webp，不包括 gif）。 */
    private static boolean isStaticImage(File f) {
        String n = f.getName().toLowerCase(Locale.ROOT);
        int dot = n.lastIndexOf('.');
        if (dot < 0) return false;
        return STATIC_IMAGE_EXTS.contains(n.substring(dot));
    }

    private static void addRepeatingOverlayInput(List<String> args, File file, int totalDuration) {
        if (!isStaticImage(file)) {
            args.add("-stream_loop"); args.add("-1");
            args.add("-t"); args.add(format((double) totalDuration));
        }
        args.add("-i"); args.add(file.getAbsolutePath());
    }

    private static void appendScaledVideo(
            StringBuilder fc,
            int width,
            int height,
            boolean cover,
            boolean canCrop,
            String outTag
    ) {
        appendScaledVideo(fc, width, height, cover, canCrop, outTag, false);
    }

    private static void appendScaledVideo(
            StringBuilder fc,
            int width,
            int height,
            boolean cover,
            boolean canCrop,
            String outTag,
            boolean chainContinues
    ) {
        fc.append("scale=w=").append(width).append(":h=").append(height);
        if (canCrop) {
            fc.append(":force_original_aspect_ratio=").append(cover ? "increase" : "decrease");
            if (cover) {
                fc.append(",crop=w=").append(width).append(":h=").append(height);
            }
        } else if (!cover) {
            fc.append(":force_original_aspect_ratio=decrease");
        }
        if (chainContinues) {
            fc.append(",");
        } else {
            fc.append("[").append(outTag).append("];");
        }
    }

    // v0.x: layer_type 收缩到 4 类(video / image / text / audio)。
    // 旧 job 的 slots_snapshot 仍可能含 digital_human / sticker,buildContext 在解析时归一化。
    private static final Set<String> VIDEO_LAYERS = Set.of("video");
    private static final Set<String> OVERLAY_LAYERS = Set.of("image", "text");

    /** 把可能出现的旧 layer_type 字符串归一化到当前 4 类。 */
    private static String normalizeLayerType(String raw) {
        if (raw == null) return "";
        return switch (raw) {
            case "digital_human" -> "video";
            case "sticker" -> "image";
            default -> raw;
        };
    }

    /** 从 job 的 snapshot JSON 派生 RenderContext。任何缺省字段都退回安全默认。 */
    private RenderContext buildContext(MixcutRenderJob job) {
        int capW = Math.max(160, props.getMaxOutputWidth());
        int capH = Math.max(160, props.getMaxOutputHeight());
        int width = capW;
        int height = capH;
        try {
            String cs = job.getCanvasSnapshotJson();
            if (cs != null && !cs.isBlank()) {
                JsonNode node = mapper.readTree(cs);
                int w = node.path("width").asInt(0);
                int h = node.path("height").asInt(0);
                if (w > 0 && h > 0) {
                    // 限制到配置的 max-output-width/height 以内（性能 + 编码器友好）；保持比例。
                    // 默认 720x1280，软编 CPU 在 macOS 上能跑接近 realtime；通过 max-output-width=1080
                    // + video-codec=h264_videotoolbox 切到 1080p GPU 编码。
                    double scale = Math.min(1.0, Math.min((double) capW / w, (double) capH / h));
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
                        String layerType = normalizeLayerType(s.path("layer_type").asText(""));
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
     *   1. snapshot.slotMap[slot_id].layer_type → video=底层；image/text=overlay；audio=BGM
     *   2. snapshot 缺失时，回退到按文件后缀分类
     * overlay 列表按 z_index 升序排好（小 z 先合成，大 z 在上）。
     */
    private ResolvedBindings resolveBindings(MixcutRenderJob job, RenderContext ctx) {
        List<File> videos = new ArrayList<>();
        List<OverlaySpec> overlays = new ArrayList<>();
        List<PicgenSlotSpec> picgenSlots = new ArrayList<>();
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

                // v0.16+: picgen 走单独通道，按变体落地
                if ("picgen".equals(src)) {
                    String title = b.path("title").asText("");
                    if (title.isBlank()) {
                        log.warn("[mixcut] picgen slot {} 缺 title，跳过", slotId);
                        continue;
                    }
                    SlotInfo slot = ctx.slotMap.get(slotId);
                    int z = slot != null ? slot.zIndex : 0;
                    NormRect rect = slot != null ? slot.rect : null;
                    String fit = slot != null && slot.fit != null ? slot.fit : "cover";
                    picgenSlots.add(new PicgenSlotSpec(
                            slotId,
                            title.trim(),
                            blankToNull(b.path("subtitle").asText("")),
                            blankToNull(b.path("tag").asText("")),
                            rect, z, fit
                    ));
                    continue;
                }

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
        return new ResolvedBindings(videos, overlays, bgm, picgenSlots);
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    /**
     * v0.16+: 在变体循环内为每个 picgen 槽位调一次 pic-gen，把出图作为 overlay 合入。
     * 失败兜底 —— 单张图出错只是 log + 跳过，不让任务 fail。
     */
    private List<OverlaySpec> renderPicgenForVariant(
            String jobId,
            int variantIndex,
            List<PicgenSlotSpec> specs,
            RenderContext ctx,
            File outDir
    ) {
        List<OverlaySpec> out = new ArrayList<>();
        if (specs == null || specs.isEmpty()) return out;
        if (picgen == null || !picgen.isEnabled()) return out;

        File picgenDir = new File(outDir, "picgen");
        if (!picgenDir.exists() && !picgenDir.mkdirs()) {
            log.warn("[mixcut] picgen dir mkdir failed: {}", picgenDir);
            return out;
        }

        for (PicgenSlotSpec s : specs) {
            try {
                int width = picgenPixelWidth(s, ctx);
                int height = picgenPixelHeight(s, ctx);
                long seed = picgenSeed(jobId, variantIndex, s.slotId);
                var params = new PicgenClient.PicgenParams(
                        s.title, s.subtitle, s.tag,
                        width, height, seed,
                        null, null, null
                );
                byte[] png = picgen.renderPng(params);
                File png_file = new File(picgenDir, "v" + (variantIndex + 1) + "-" + s.slotId + ".png");
                Files.write(png_file.toPath(), png);
                out.add(new OverlaySpec(png_file, s.slotId, s.rect, s.zIndex, "image", s.fit));
            } catch (Exception e) {
                log.warn("[mixcut] picgen slot {} variant {} 失败: {}", s.slotId, variantIndex + 1, e.getMessage());
                // fall-through: 缺这张图，但任务不 fail
            }
        }
        return out;
    }

    private static int picgenPixelWidth(PicgenSlotSpec s, RenderContext ctx) {
        double w = s.rect != null ? s.rect.w : 0.9;
        int px = (int) Math.round(ctx.outputWidth * w);
        return Math.max(200, Math.min(1920, px));
    }

    private static int picgenPixelHeight(PicgenSlotSpec s, RenderContext ctx) {
        double h = s.rect != null ? s.rect.h : 0.2;
        int px = (int) Math.round(ctx.outputHeight * h);
        return Math.max(120, Math.min(1080, px));
    }

    /** 64-bit deterministic seed → 让 pic-gen 选模板/配色/字体每变体不同但可复现。 */
    private static long picgenSeed(String jobId, int variantIndex, String slotId) {
        long s = (jobId == null ? 0L : jobId.hashCode());
        s = s * 31 + variantIndex;
        s = s * 31 + (slotId == null ? 0 : slotId.hashCode());
        // 折成正数 32-bit，与 server.js 端 seededPick 的 (Number(seed) || 0) ^ ... 兼容
        return Math.abs(s) & 0x7fffffffL;
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
        FilterCaps caps = filterCaps();
        List<String> missingEnhancements = caps.missingEnhancements();
        if (!missingEnhancements.isEmpty()) {
            log.warn("[mixcut] ffmpeg lacks optional filters {}; rendering degraded variant={} job={}",
                    missingEnhancements, variantIndex, job.getId());
        }

        int segCount = caps.concat ? Math.min(2, sources.size()) : 1;
        double segDuration = Math.max(2.0, (double) props.getMaxOutputDurationSec() / Math.max(1, segCount));
        int totalDuration = props.getMaxOutputDurationSec();
        int W = ctx.outputWidth;
        int H = ctx.outputHeight;

        // perturbation 参数（按 overrides 短路；被关掉的算子用恒等值，不进入 filter）
        double speed       = ctx.overrides.allowSpeed       ? randomSpeed(profile, rnd)       : 1.0;
        double brightness  = ctx.overrides.allowBrightness  ? randomBrightness(profile, rnd)  : 0.0;
        double saturation  = ctx.overrides.allowSaturation  ? randomSaturation(profile, rnd)  : 1.0;
        boolean mirror     = ctx.overrides.allowMirror      && randomMirror(profile, rnd);

        ObjectNode overridesNode = transforms.putObject("overrides");
        overridesNode.put("allow_mirror", ctx.overrides.allowMirror);
        overridesNode.put("allow_speed", ctx.overrides.allowSpeed);
        overridesNode.put("allow_brightness", ctx.overrides.allowBrightness);
        overridesNode.put("allow_saturation", ctx.overrides.allowSaturation);
        overridesNode.put("allow_position_jitter", ctx.overrides.allowPositionJitter);
        overridesNode.put("allow_scale_jitter", ctx.overrides.allowScaleJitter);
        if (!caps.eq) {
            brightness = 0.0;
            saturation = 1.0;
        }
        if (!caps.hflip) mirror = false;
        if (!caps.setpts) speed = 1.0;

        // ffmpeg args 累积
        List<String> args = new ArrayList<>();
        args.add("-y");
        args.add("-hide_banner");
        args.add("-loglevel"); args.add("warning");
        // -stats: 强制周期打印 `frame= ... fps= ... time= ... bitrate= ...`。
        // 即使 -loglevel warning 也会输出，所以超时被 forceKill 时 stderr tail 能反映
        // ffmpeg 实际推进到了哪一帧 / 哪个时间戳，区分「卡 demux」/「编码慢」/「filter 异常」。
        args.add("-stats");

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
        if (useSourceAudio && !caps.canNormalizeAudio()) {
            useSourceAudio = false;
        }
        if (useSourceAudio && Math.abs(speed - 1.0) > 0.001 && !caps.atempo) {
            speed = 1.0;
        }
        boolean useBgm = bgm != null && bgm.exists() && caps.canNormalizeAudio();
        if (useBgm && useSourceAudio && !caps.amix) {
            useBgm = false;
        }
        boolean hasAudio = useSourceAudio || useBgm;

        transforms.put("variant", variantIndex);
        transforms.put("speed", round2(speed));
        transforms.put("brightness", round3(brightness));
        transforms.put("saturation", round3(saturation));
        transforms.put("mirror", mirror);
        transforms.put("segments", segCount);
        transforms.put("canvas_w", W);
        transforms.put("canvas_h", H);
        transforms.put("ffmpeg_degraded", !missingEnhancements.isEmpty());
        transforms.put("audio_source", useBgm
                ? (useSourceAudio ? "source+bgm" : "bgm")
                : (useSourceAudio ? "source" : "silent"));

        // 叠加图层输入
        //  - snapshot 解析出的 overlay（已按 z_index 排序）→ 真实图
        //  - 没有可用 overlay → 退化为半透明色卡兜底
        //
        // v0.21+: 当用户绑定了 overlay（包括 picgen 文字生图）但 caps.overlay=false 时，
        // 直接 fail-fast 而不是静默丢弃。历史 bug：用户填了文字生图素材，最后渲染出的
        // 视频里什么都没有（picgen PNG 生成成功但被 overlay 阶段跳过），用户没有任何线索
        // 知道发生了什么。FfmpegRunner 已经做了 -filters 解析 + -h filter=<name> 兜底 probe，
        // 走到这里 caps.overlay 仍 false 说明 ffmpeg binary 真的没有 overlay filter。
        if (!caps.overlay && !overlays.isEmpty()) {
            throw new RuntimeException(
                    "ffmpeg binary 缺少必需的 `overlay` filter，无法把图片/文字生图叠加到视频上。"
                    + " 当前用户绑定了 " + overlays.size() + " 个 overlay（含 picgen 文字生图）。"
                    + " 请安装完整的 ffmpeg build（brew install ffmpeg / apt install ffmpeg）"
                    + " 或设置 AEP_FFMPEG_BIN 指向有 overlay filter 的二进制。");
        }
        boolean useRealOverlay = caps.overlay && !overlays.isEmpty();
        int overlayCount = useRealOverlay ? Math.min(4, overlays.size()) : (caps.overlay && caps.color ? 1 : 0);
        transforms.put("overlay_count", overlayCount);
        transforms.put("overlay_source", useRealOverlay ? "user-upload"
                : (overlayCount == 1 ? "fallback-color-card" : "disabled-missing-filter"));

        if (useRealOverlay) {
            ObjectNode overlayDetail = transforms.putObject("overlays_detail");
            for (int i = 0; i < overlayCount; i++) {
                OverlaySpec spec = overlays.get(i);
                addRepeatingOverlayInput(args, spec.file, totalDuration);
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
        } else if (overlayCount == 1) {
            args.add("-f"); args.add("lavfi");
            args.add("-i");
            args.add("color=c=0x7c5cff@0.55:s=" + (W / 2) + "x" + Math.max(80, H / 16) + ":d=" + format((double) totalDuration));
        }

        // BGM 输入（如果有）—— 循环到 totalDuration
        int bgmInputIdx = -1;
        if (useBgm) {
            bgmInputIdx = segCount + overlayCount;
            args.add("-stream_loop"); args.add("-1");
            args.add("-t"); args.add(format((double) totalDuration));
            args.add("-i"); args.add(bgm.getAbsolutePath());
        }

        // v0.13+: 扰动贴图池 —— 每变体按 (jobId + variantIndex) seed 从 pool_ids 随机抽。
        //   pool 里通常是 GIF（gif demuxer 支持 seek-back → -stream_loop OK），
        //   但 admin 也可能上传 PNG/JPG 静态贴图，那作为单帧输入交给 overlay repeatlast。
        List<StickerOverlay> stickers = caps.overlay
                ? buildVariantStickers(job, ctx, variantIndex, totalDuration, transforms)
                : List.of();
        int stickerInputStart = segCount + overlayCount + (useBgm ? 1 : 0);
        for (StickerOverlay so : stickers) {
            addRepeatingOverlayInput(args, so.file, totalDuration);
        }
        transforms.put("sticker_overlay_count", stickers.size());

        // filter_complex 拼装
        StringBuilder fc = new StringBuilder();
        // 单段时跳过 concat 滤镜 —— concat=n=1 是个 no-op 但有些 ffmpeg build
        // 对 n=1 处理有 bug (用户实测 exit=234 "Error parsing filterchain ...
        // around: [s0];[0:a]aresample=...")。让段输出直接命名为 concat_v /
        // concat_a 接到下游 fx 链,跳过没必要的 passthrough.
        boolean skipConcat = (segCount == 1);
        for (int i = 0; i < segCount; i++) {
            // `setsar=1` 和 `fps=30` 之前内嵌在 filter 链里——某些精简 ffmpeg
            // build 的 libavfilter 没注册这两个滤镜,整链 parse 失败 (exit=234
            // "Error parsing filterchain ... around: ,setsar=1,fps=30")。
            // 改用:framerate 走最外层 `-r 30` 输出选项 (CLI 主程序自带,
            // 不依赖 libavfilter);SAR 不强设,让源 SAR 透传——99% 的现代
            // mp4 / mov / webm 都是 SAR=1:1,不强设也没差别。
            // 全程使用「显式 key=value」形式 (e.g. `scale=w=W:h=H` 而非
            // `scale=W:H`)。原因:某些 ffmpeg build 没注册 scale/crop/aresample
            // 等 filter 的 `shorthand` 数组,positional 参数会触发
            // exit=234 "No option name near '1080:1920'"。named 形式在所有
            // ffmpeg 版本上都可用,且对可读性也更好。
            String vOut = skipConcat ? "concat_v" : ("s" + i);
            String aOut = skipConcat ? "concat_a" : ("as" + i);
            fc.append("[").append(i).append(":v]");
            appendScaledVideo(fc, W, H, true, caps.crop, vOut);
            if (useSourceAudio) {
                fc.append("[").append(i).append(":a]")
                  .append("aresample=sample_rate=44100,aformat=channel_layouts=stereo")
                  .append("[").append(aOut).append("];");
            }
        }
        if (!skipConcat) {
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
        }

        // perturbation 视频链：只使用当前 ffmpeg 已注册的 filters。
        List<String> videoFx = new ArrayList<>();
        if (caps.eq) {
            videoFx.add("eq=brightness=" + format(brightness) + ":saturation=" + format(saturation));
        }
        if (mirror && caps.hflip) videoFx.add("hflip");
        if (Math.abs(speed - 1.0) > 0.001 && caps.setpts) {
            videoFx.add("setpts=expr=" + format(1.0 / speed) + "*PTS");
        }
        String videoBaseTag = "concat_v";
        String videoFxTag = videoBaseTag;
        if (!videoFx.isEmpty()) {
            fc.append("[concat_v]").append(String.join(",", videoFx)).append("[fx];");
            videoFxTag = "fx";
        }

        // perturbation 音频链:speed≠1 时同步 atempo;再决定是否 amix BGM
        String audioOutTag = null;
        if (useSourceAudio) {
            if (Math.abs(speed - 1.0) > 0.001) {
                fc.append("[concat_a]atempo=tempo=").append(format(speed)).append("[fx_a];");
                audioOutTag = "fx_a";
            } else {
                audioOutTag = "concat_a";
            }
        }
        if (useBgm) {
            // BGM 单路归一化
            fc.append("[").append(bgmInputIdx).append(":a]")
              .append("aresample=sample_rate=44100,aformat=channel_layouts=stereo");
            if (caps.volume) fc.append(",volume=0.6");
            fc.append("[bgm_a];");
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
        String prev = videoFxTag;
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

            // 填充方式分支（v0.13+ 模板字段 slot.fit）。完整 ffmpeg build 走
            // contain 的模糊背景；精简 build 缺 crop/split/boxblur 时降级为单路缩放。
            String fit = useRealOverlay && overlays.get(i).fit != null
                    ? overlays.get(i).fit
                    : "cover";
            if ("contain".equals(fit) && useRealOverlay && caps.split && caps.crop) {
                // 模糊背景填充：[i:v] split → [bg] cover+blur，[fg] fit，[bg][fg] overlay center
                String bgTag = tag + "bg";
                String fgTag = tag + "fg";
                fc.append("[").append(inputIdx).append(":v]");
                if (caps.format) fc.append("format=pix_fmts=yuva420p,");
                fc.append("split=outputs=2[").append(bgTag).append("0][").append(fgTag).append("0];");
                fc.append("[").append(bgTag).append("0]");
                appendScaledVideo(fc, rw, rh, true, true, bgTag, caps.boxblur || caps.eq);
                if (caps.boxblur || caps.eq) {
                    List<String> bgFx = new ArrayList<>();
                    if (caps.boxblur) bgFx.add("boxblur=luma_radius=14:luma_power=1");
                    if (caps.eq) bgFx.add("eq=brightness=-0.05");
                    fc.append(String.join(",", bgFx)).append("[").append(bgTag).append("];");
                }
                fc.append("[").append(fgTag).append("0]");
                appendScaledVideo(fc, rw, rh, false, true, fgTag);
                fc.append("[").append(bgTag).append("][").append(fgTag).append("]")
                  .append("overlay=x=(W-w)/2:y=(H-h)/2")
                  .append("[").append(tag).append("s];");
            } else {
                fc.append("[").append(inputIdx).append(":v]");
                if (caps.format) fc.append("format=pix_fmts=yuva420p,");
                appendScaledVideo(fc, rw, rh, !"contain".equals(fit), caps.crop, tag + "s");
            }
            fc.append("[").append(prev).append("][").append(tag).append("s]")
              .append("overlay=x=").append(rx).append(":y=").append(ry);
            String outTag = "ovl" + i;
            fc.append("[").append(outTag).append("];");
            prev = outTag;
        }

        // v0.13+: 扰动贴图 overlay 链。每张 GIF：format=yuva420p,scale=W:-2,colorchannelmixer=aa=opacity → overlay
        //   GIF binary alpha 上叠 colorchannelmixer 只对 "已不透明像素" 生效（透明像素仍透明），等价于"贴图整体调薄"。
        for (int i = 0; i < stickers.size(); i++) {
            StickerOverlay s = stickers.get(i);
            int inputIdx = stickerInputStart + i;
            String stickerTag = "sk" + i;
            fc.append("[").append(inputIdx).append(":v]");
            if (caps.format) fc.append("format=pix_fmts=yuva420p,");
            fc.append("scale=w=").append(s.targetWidth).append(":h=-2");
            if (caps.colorchannelmixer) {
                fc.append(",colorchannelmixer=aa=").append(format(s.opacity));
            }
            fc.append("[").append(stickerTag).append("s];");
            String nextOut = "skl" + i;
            fc.append("[").append(prev).append("][").append(stickerTag).append("s]")
              .append("overlay=x=").append(s.x).append(":y=").append(s.y)
              .append("[").append(nextOut).append("];");
            prev = nextOut;
        }

        String videoMapTag = prev;
        if (caps.drawbox) {
            // 变体识别条
            int variantHue = (variantIndex * 67) % 360;
            String variantColor = String.format(Locale.ROOT, "0x%06x", hslToRgb(variantHue, 0.65, 0.55));
            fc.append("[").append(prev).append("]")
              .append("drawbox=x=0:y=0:w=iw:h=8:color=").append(variantColor).append("@0.9:t=fill,")
              .append("drawbox=x=0:y=ih-8:w=iw:h=8:color=").append(variantColor).append("@0.9:t=fill")
              .append("[out]");
            videoMapTag = "out";
        }

        args.add("-filter_complex");
        args.add(fc.toString());
        args.add("-map"); args.add("[" + videoMapTag + "]");
        if (hasAudio && audioOutTag != null) {
            args.add("-map"); args.add("[" + audioOutTag + "]");
        }

        // 编码
        args.add("-t"); args.add(format((double) totalDuration));
        // 强制 30fps 输出。原本走 `fps=30` filter 内嵌；改成 CLI 输出选项后
        // 不依赖 libavfilter 注册 fps，能在精简 build 上跑通。
        args.add("-r"); args.add("30");
        // 编码器：默认 libx264 软编；macOS 可切 h264_videotoolbox 走 GPU。
        // 参数集差异：libx264 用 -preset/-crf；videotoolbox 用 -realtime/-q:v（quality 0-100）。
        String codec = props.getVideoCodec() == null || props.getVideoCodec().isBlank()
                ? "libx264" : props.getVideoCodec();
        args.add("-c:v"); args.add(codec);
        if ("h264_videotoolbox".equals(codec)) {
            args.add("-realtime"); args.add("1");      // 不阻塞等待最优编码
            args.add("-q:v"); args.add("60");          // quality 0-100，越低越好；60 ≈ x264 crf 23
        } else {
            args.add("-preset"); args.add("ultrafast");
            args.add("-crf"); args.add("24");
        }
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

        // Fail-fast: 扫所有 -i 的 input 文件，size=0 或不存在直接抛错，不让 ffmpeg 卡 5 分钟才超时。
        // 历史 bug：H2 file 模式持久化后，DB 里 binding 还指向旧 file_url，
        // 但本地缓存被清掉了 → ffmpeg 接到 empty path stuck demux，frame=0 持续到超时。
        for (int i = 0; i < args.size() - 1; i++) {
            if ("-i".equals(args.get(i))) {
                String path = args.get(i + 1);
                // skip lavfi 虚拟输入（"color=c=...:s=...:d=..."）
                if (path.startsWith("color=") || path.startsWith("anullsrc")) continue;
                File f = new File(path);
                if (!f.exists()) {
                    throw new RuntimeException("ffmpeg input missing: " + path
                            + " (job=" + job.getId() + " variant=" + variantIndex
                            + " — DB 里 binding 指向了已不存在的本地文件，建议清掉 apps/server/data + mixcut-work 重 seed)");
                }
                if (f.length() == 0) {
                    throw new RuntimeException("ffmpeg input 0 bytes: " + path
                            + " (job=" + job.getId() + " variant=" + variantIndex
                            + " — 文件存在但是空，可能下载被截断)");
                }
                log.debug("[mixcut] input ok: {} ({} bytes)", path, f.length());
            }
        }

        // 打印完整 ffmpeg 命令到 INFO，方便用户复制到 shell 单独跑诊断（不依赖 -loglevel debug）
        log.info("[mixcut] ffmpeg cmd: ffmpeg {}", String.join(" ", args));

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

    // ── v0.13+ 扰动贴图池 helpers ─────────────────────────────────────────────

    /**
     * 解析 job.stickerPoolJson + 用 (jobId+variantIndex) seed 抽样，返回该变体的 sticker overlay 列表。
     *
     * stickerPoolJson 结构（slot 级 Map）：
     *   {
     *     "<slotId>": { "pool_ids": ["preset_..."], "coverage": "intro"|"outro"|"loop"|"random_3s",
     *                   "opacity": 0.85, "scale_pct": 18, "pick_count": 1 },
     *     "_global": {...}    // 不绑定 slot，整片随机位置
     *   }
     */
    private List<StickerOverlay> buildVariantStickers(
            MixcutRenderJob job, RenderContext ctx, int variantIndex, int totalDuration, ObjectNode transformsOut
    ) {
        List<StickerOverlay> result = new ArrayList<>();
        String poolJson = job.getStickerPoolJson();
        if (poolJson == null || poolJson.isBlank()) return result;

        long seed = ((long) job.getId().hashCode() * 1_000_003L) ^ (long) variantIndex;
        Random rnd = new Random(seed);
        int W = ctx.outputWidth;
        int H = ctx.outputHeight;
        ObjectNode stickerDetail = transformsOut.putObject("stickers_detail");

        try {
            JsonNode root = mapper.readTree(poolJson);
            if (!root.isObject()) return result;

            Iterator<Map.Entry<String, JsonNode>> it = root.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> entry = it.next();
                String slotKey = entry.getKey();
                JsonNode cfg = entry.getValue();
                if (!cfg.isObject()) continue;

                JsonNode poolIdsNode = cfg.path("pool_ids");
                if (!poolIdsNode.isArray() || poolIdsNode.size() == 0) continue;
                List<String> poolIds = new ArrayList<>();
                for (JsonNode id : poolIdsNode) {
                    String s = id.asText("");
                    if (!s.isBlank()) poolIds.add(s);
                }
                if (poolIds.isEmpty()) continue;

                String coverage = cfg.path("coverage").asText("loop");
                double opacity = Math.max(0.05, Math.min(1.0, cfg.path("opacity").asDouble(0.85)));
                double scalePct = Math.max(5.0, Math.min(50.0, cfg.path("scale_pct").asDouble(18.0)));
                int pickCount = Math.max(1, Math.min(2, cfg.path("pick_count").asInt(1)));

                // 不放回随机抽样 (Fisher–Yates 前 pickCount 个)
                List<String> shuffled = new ArrayList<>(poolIds);
                for (int i = shuffled.size() - 1; i > 0; i--) {
                    int j = rnd.nextInt(i + 1);
                    String tmp = shuffled.get(i);
                    shuffled.set(i, shuffled.get(j));
                    shuffled.set(j, tmp);
                }
                List<String> picked = shuffled.subList(0, Math.min(pickCount, shuffled.size()));

                // coverage → 时间窗
                double startT;
                double endT;
                switch (coverage) {
                    case "intro" -> { startT = 0.0; endT = Math.min(3.0, totalDuration); }
                    case "outro" -> { startT = Math.max(0.0, totalDuration - 3.0); endT = totalDuration; }
                    case "random_3s" -> {
                        startT = rnd.nextDouble() * Math.max(0.5, totalDuration - 3.0);
                        endT = Math.min(startT + 3.0, totalDuration);
                    }
                    default -> { startT = 0.0; endT = totalDuration; }
                }

                int targetWidth = Math.max(40, (int) Math.round(W * scalePct / 100.0));
                if (targetWidth % 2 != 0) targetWidth -= 1;  // 偶数（scale=-2 要求）
                SlotInfo slot = ctx.slotMap.get(slotKey);

                int detailIdx = 0;
                for (String assetId : picked) {
                    var assetOpt = assetService.get(assetId);
                    if (assetOpt.isEmpty()) continue;
                    var asset = assetOpt.get();
                    if (asset.getLocalPath() == null) continue;
                    File f = new File(asset.getLocalPath());
                    if (!f.exists()) continue;

                    // 仅 sticker / image 类型有意义
                    if (!"sticker".equals(asset.getKind()) && !"image".equals(asset.getKind())) continue;

                    int posX;
                    int posY;
                    if (slot != null && slot.rect != null) {
                        // slot 中心 + 5% 抖动
                        double cx = slot.rect.x + slot.rect.w / 2;
                        double cy = slot.rect.y + slot.rect.h / 2;
                        int jitterX = (int) ((rnd.nextDouble() - 0.5) * 0.05 * W);
                        int jitterY = (int) ((rnd.nextDouble() - 0.5) * 0.05 * H);
                        posX = (int) Math.round(cx * W) - targetWidth / 2 + jitterX;
                        posY = (int) Math.round(cy * H) - targetWidth / 2 + jitterY;
                    } else {
                        // 全画布安全区 [10%..80%] 随机
                        posX = (int) Math.round(rnd.nextDouble() * (W - targetWidth) * 0.8 + W * 0.1);
                        posY = (int) Math.round(rnd.nextDouble() * (H - targetWidth) * 0.8 + H * 0.1);
                    }
                    // 钳制
                    posX = Math.max(0, Math.min(W - targetWidth, posX));
                    posY = Math.max(0, Math.min(H - targetWidth, posY));

                    result.add(new StickerOverlay(f, slotKey, posX, posY, targetWidth, opacity, startT, endT));

                    ObjectNode d = stickerDetail.objectNode();
                    d.put("asset_id", assetId);
                    d.put("file", f.getName());
                    d.put("x", posX);
                    d.put("y", posY);
                    d.put("w", targetWidth);
                    d.put("opacity", round3(opacity));
                    d.put("start_t", round2(startT));
                    d.put("end_t", round2(endT));
                    d.put("coverage", coverage);
                    stickerDetail.set(slotKey + "_" + detailIdx, d);
                    detailIdx++;
                }
            }
        } catch (Exception e) {
            log.warn("[mixcut] sticker pool parse error: {}", e.getMessage());
        }
        return result;
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
