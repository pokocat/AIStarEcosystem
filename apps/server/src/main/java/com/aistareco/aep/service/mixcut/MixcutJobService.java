package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.dto.MissingAssetItem;
import com.aistareco.aep.dto.MixcutCreateJobRequest;
import com.aistareco.aep.dto.MixcutRenderJobDto;
import com.aistareco.aep.dto.MixcutRerunJobRequest;
import com.aistareco.aep.model.MixcutAsset;
import com.aistareco.aep.model.MixcutRenderJob;
import com.aistareco.aep.model.MixcutRenderOutput;
import com.aistareco.aep.repository.MixcutAssetRepository;
import com.aistareco.aep.repository.MixcutRenderJobRepository;
import com.aistareco.aep.repository.MixcutRenderOutputRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.ProductService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class MixcutJobService {

    private static final Logger log = LoggerFactory.getLogger(MixcutJobService.class);

    /** PlatformConfig key for mixcut 单变体成本（积分）。default 30 / variant。 */
    public static final String MIXCUT_PER_VARIANT_COST_KEY = "mixcut.credit-per-variant";
    public static final long MIXCUT_PER_VARIANT_COST_DEFAULT = 30L;

    private final MixcutRenderJobRepository jobRepo;
    private final MixcutRenderOutputRepository outputRepo;
    private final MixcutAssetRepository assetRepo;
    // v0.48+: 从实例（草稿）生成时累计 generatedJobCount；best-effort，失败仅 log
    private final com.aistareco.aep.repository.MixcutDraftRepository draftRepo;
    private final ObjectMapper mapper;
    private final MixcutRenderingService rendering;
    private final com.aistareco.aep.service.CelebrityActionPricingService actionPricing;
    private final ProductService productService;
    private final CreditService creditService;
    private final PlatformConfigService platformConfig;
    // v0.47+：OSS / CDN URL 出 wire 前用 signer 加时效签名，防流量盗刷
    private final com.aistareco.aep.service.cdn.CdnUrlSigner cdnUrlSigner;

    public MixcutJobService(
            MixcutRenderJobRepository jobRepo,
            MixcutRenderOutputRepository outputRepo,
            MixcutAssetRepository assetRepo,
            com.aistareco.aep.repository.MixcutDraftRepository draftRepo,
            ObjectMapper mapper,
            MixcutRenderingService rendering,
            ProductService productService,
            CreditService creditService,
            PlatformConfigService platformConfig,
            com.aistareco.aep.service.CelebrityActionPricingService actionPricing,
            com.aistareco.aep.service.cdn.CdnUrlSigner cdnUrlSigner
    ) {
        this.jobRepo = jobRepo;
        this.outputRepo = outputRepo;
        this.assetRepo = assetRepo;
        this.draftRepo = draftRepo;
        this.mapper = mapper;
        this.rendering = rendering;
        this.productService = productService;
        this.actionPricing = actionPricing;
        this.creditService = creditService;
        this.platformConfig = platformConfig;
        this.cdnUrlSigner = cdnUrlSigner;
    }

    /**
     * 当前单变体成本（积分）。
     * v0.35：优先 CelebrityActionPricingService action="mixcut.generate"；
     *        缺失则回退到老 PlatformConfig key {@code mixcut.credit-per-variant}；
     *        再缺失回退到 MIXCUT_PER_VARIANT_COST_DEFAULT。
     */
    public long currentPerVariantCost() {
        Long fromAction = actionPricing.creditPriceOf(
                com.aistareco.aep.service.CelebrityActionPricingService.ACTION_MIXCUT_GENERATE);
        if (fromAction != null && fromAction > 0) return fromAction;
        long v = platformConfig.getLong(MIXCUT_PER_VARIANT_COST_KEY, MIXCUT_PER_VARIANT_COST_DEFAULT);
        return v > 0 ? v : MIXCUT_PER_VARIANT_COST_DEFAULT;
    }

    /** "anonymous" 等占位用户名不参与扣费。 */
    private static boolean billable(String userId) {
        return userId != null && !userId.isBlank() && !"anonymous".equals(userId);
    }

    /**
     * v0.21+: 软删指定 output。Principal 校验通过 + output 属于该用户任务。
     * 不删本地文件 / CDN —— 30 天后由 MixcutOutputCleanupScheduler 物理清理，期间可联系客服恢复。
     * 返回 true = 已置 deletedAt，false = 找不到或越权。
     */
    @Transactional
    public boolean softDeleteOutput(String outputId, String userId) {
        if (outputId == null || outputId.isBlank() || userId == null || userId.isBlank()) {
            return false;
        }
        return outputRepo.findById(outputId)
                .filter(o -> o.getJob() != null && userId.equals(o.getJob().getUserId()))
                .filter(o -> o.getDeletedAt() == null)
                .map(o -> {
                    o.setDeletedAt(OffsetDateTime.now());
                    outputRepo.save(o);
                    log.info("[mixcut] soft-deleted output {} (user={}, job={})",
                            outputId, userId, o.getJob().getId());
                    return true;
                })
                .orElse(false);
    }

    /** v0.50+: 生成下载专用 URL；仅 output 所属用户可取，点击时再签，避免页面长停后 URL 过期。 */
    @Transactional(readOnly = true)
    public Optional<String> getOutputDownloadUrl(String outputId, String userId) {
        if (!hasText(outputId) || !hasText(userId)) return Optional.empty();
        return outputRepo.findById(outputId)
                .filter(o -> o.getDeletedAt() == null)
                .filter(o -> o.getJob() != null && userId.equals(o.getJob().getUserId()))
                .map(o -> {
                    String filename = downloadFilename(o);
                    String url = null;
                    if (hasText(o.getCdnKey())) {
                        url = cdnUrlSigner.downloadUrlForKey(o.getCdnKey(), filename);
                    }
                    if (!hasText(url) && hasText(o.getCdnUrl())) {
                        url = cdnUrlSigner.downloadUrlForUrl(o.getCdnUrl(), filename);
                    }
                    if (!hasText(url)) {
                        url = o.getFileUrl();
                    }
                    return url;
                })
                .filter(MixcutJobService::hasText);
    }

    /** v0.13.0+: 取当前用户名下的任务列表（admin 跨用户列表见 AdminMixcutController）。 */
    @Transactional(readOnly = true)
    public List<MixcutRenderJobDto> listForUser(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        return jobRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(j -> MixcutRenderJobDto.from(j, mapper, cdnUrlSigner))
                .toList();
    }

    /** v0.13.0+: 取当前用户自有任务；他人 jobId 直接返回 empty（视同不存在）。 */
    @Transactional(readOnly = true)
    public Optional<MixcutRenderJobDto> getForUser(String id, String userId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        return jobRepo.findById(id)
                .filter(j -> userId.equals(j.getUserId()))
                .map(j -> MixcutRenderJobDto.from(j, mapper, cdnUrlSigner));
    }

    /**
     * 创建任务并 dispatch 异步 worker。返回的 DTO 状态固定为 "queued"。
     * v0.13.0+: principalUserId 优先于 req.userId（避免越权创建别人名下 job）。
     */
    @Transactional
    public MixcutRenderJobDto create(MixcutCreateJobRequest req, String principalUserId) {
        return createInternal(req, principalUserId, null);
    }

    /**
     * v0.30+: 由「重跑」入口调用，标记血缘指回原 jobId。其它行为与 create() 完全一致。
     */
    @Transactional
    public MixcutRenderJobDto createForked(MixcutCreateJobRequest req, String principalUserId, String forkedFromJobId) {
        return createInternal(req, principalUserId, forkedFromJobId);
    }

    private MixcutRenderJobDto createInternal(MixcutCreateJobRequest req, String principalUserId, String forkedFromJobId) {
        MixcutRenderJob job = new MixcutRenderJob();
        job.setId(req.id() != null && !req.id().isBlank() ? req.id() : ("job_" + shortUuid()));

        // userId 真值：principal > req.userId > "anonymous"（兼容老 dev 环境）
        String effectiveUserId = (principalUserId != null && !principalUserId.isBlank())
                ? principalUserId
                : (req.userId() != null && !req.userId().isBlank() ? req.userId() : "anonymous");
        job.setUserId(effectiveUserId);

        job.setTemplateId(req.templateId());
        job.setTemplateName(req.templateName());
        job.setTemplateThumbnail(req.templateThumbnail());

        String bindingsJson;
        try {
            bindingsJson = req.slotBindings() == null || req.slotBindings().isNull()
                    ? "{}"
                    : mapper.writeValueAsString(req.slotBindings());
        } catch (Exception e) {
            bindingsJson = "{}";
        }
        job.setSlotBindingsJson(bindingsJson);

        job.setCanvasSnapshotJson(serializeJson(req.canvasSnapshot()));
        job.setSlotsSnapshotJson(serializeJson(req.slotsSnapshot()));
        job.setPerturbationOverridesJson(serializeJson(req.perturbationOverrides()));
        job.setStickerPoolJson(serializeJson(req.stickerPool()));
        job.setScenesSnapshotJson(serializeJson(req.scenesSnapshot()));
        // v0.26+: 关联商品 id（可空）
        if (req.productId() != null && !req.productId().isBlank()) {
            job.setProductId(req.productId().trim());
        }

        job.setPerturbationProfile(safe(req.perturbationProfile(), "moderate"));
        int variants = req.outputVariants() != null && req.outputVariants() > 0 ? req.outputVariants() : 1;
        job.setOutputVariants(variants);
        job.setStatus("queued");
        job.setProgress(0);
        job.setCreatedAt(OffsetDateTime.now());
        // v0.30+: 血缘字段。null = 普通 create；非空 = 从原任务 rerun fork 出来的
        if (forkedFromJobId != null && !forkedFromJobId.isBlank()) {
            job.setForkedFromJobId(forkedFromJobId);
        }
        // v0.48+: 来源实例（草稿）血缘。从 create 页 / 草稿箱生成时带 draft_id
        if (req.draftId() != null && !req.draftId().isBlank()) {
            job.setDraftId(req.draftId().trim());
        }

        // v0.33+: 真扣费 —— hold(variants × perVariant)，PAYMENT_REQUIRED 直接抛出。
        // anonymous 用户跳过扣费（保留 dev/H2 lite 场景）。
        long perVariant = currentPerVariantCost();
        long totalCost = perVariant * variants;
        job.setCreditsPerVariant(perVariant);
        job.setCreditsHeld(billable(effectiveUserId) ? totalCost : 0L);

        if (billable(effectiveUserId) && totalCost > 0) {
            creditService.hold(
                    effectiveUserId,
                    totalCost,
                    "mixcut_job",
                    job.getId(),
                    "混剪生成 · " + variants + " 条变体 · 模板 " + safe(req.templateName(), req.templateId())
            );
        }

        jobRepo.save(job);
        log.info("[mixcut] queued job {} user={} template={} variants={} profile={}",
                job.getId(), job.getUserId(), job.getTemplateId(), job.getOutputVariants(), job.getPerturbationProfile());

        // v0.31：商品 +usageCount。商品库已收归 admin 写，普通用户不能往池里灌名字 →
        // 仅当任务带 productId 时 server 自己 bump；失败仅 log，不阻断任务创建。
        // 替代 v0.28 的前端 fire-and-forget /api/products/upsert-from-generation 调用。
        if (job.getProductId() != null && !job.getProductId().isBlank()) {
            try {
                productService.bumpUsageCountByProductId(job.getProductId());
            } catch (Exception e) {
                log.warn("[mixcut] bump product usageCount failed jobId={} productId={} err={}",
                        job.getId(), job.getProductId(), e.getMessage());
            }
        }

        // v0.48+: 从实例（草稿）生成 → 累计 generatedJobCount + lastGeneratedAt。best-effort，
        // 实例不存在 / 已删 / 保存失败只 log，不阻断任务创建。
        if (job.getDraftId() != null && !job.getDraftId().isBlank()) {
            try {
                draftRepo.findById(job.getDraftId())
                        .filter(d -> job.getUserId() == null || job.getUserId().equals(d.getUserId()))
                        .ifPresent(d -> {
                            d.setGeneratedJobCount(d.getGeneratedJobCount() + 1);
                            d.setLastGeneratedAt(OffsetDateTime.now());
                            draftRepo.save(d);
                        });
            } catch (Exception e) {
                log.warn("[mixcut] bump draft generatedJobCount failed jobId={} draftId={} err={}",
                        job.getId(), job.getDraftId(), e.getMessage());
            }
        }

        // 异步 dispatch 必须在事务 commit 之后；否则 worker 新事务里 SELECT 看不到这条 job。
        final String jobId = job.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    // log 让用户能确认 tx 真的 commit 了 + worker 已 enqueue 到 mixcutExecutor。
                    // 后续如果看不到 "[mixcut] worker picked up job=..."，说明池满 / 注解未生效。
                    log.info("[mixcut] dispatching renderAsync for {} (tx committed)", jobId);
                    rendering.renderAsync(jobId);
                }
            });
        } else {
            // dev/test 路径：没事务时直接派单（H2 lite scenarios）。
            log.info("[mixcut] dispatching renderAsync for {} (no active tx)", jobId);
            rendering.renderAsync(jobId);
        }

        return MixcutRenderJobDto.from(job, mapper, cdnUrlSigner);
    }

    /**
     * v0.30+: 基于原 job 的完整快照重跑，fork 出新 job。
     *
     * - 严格 owner 校验（404 不暴露他人 jobId 是否存在）
     * - 解析 slotBindingsJson，收集所有 asset_id 引用 → 比对 MixcutAsset 表存在性
     * - 缺素材 → throw MissingAssetsException（409 + missing_assets 详情）
     * - 通过 → 构造 MixcutCreateJobRequest（所有快照原样复用，仅 variants/profile 可被 overrides 覆盖）→ createForked()
     *
     * 不重算 source_phash（fork 出新 job → 渲染流水线自然算）；不改原 job 状态。
     */
    @Transactional
    public MixcutRenderJobDto rerun(String originalJobId, String principalUserId, MixcutRerunJobRequest overrides) {
        if (originalJobId == null || originalJobId.isBlank() || principalUserId == null || principalUserId.isBlank()) {
            throw BusinessException.notFound("MIXCUT_JOB_NOT_FOUND", "找不到要重跑的任务");
        }
        MixcutRenderJob original = jobRepo.findById(originalJobId)
                .filter(j -> principalUserId.equals(j.getUserId()))
                .orElseThrow(() -> BusinessException.notFound("MIXCUT_JOB_NOT_FOUND", "找不到要重跑的任务"));

        // 1) 解析 binding，收集所有 asset_id 引用 → 校验
        List<MissingAssetItem> missing = collectMissingAssets(original.getSlotBindingsJson());
        if (!missing.isEmpty()) {
            log.warn("[mixcut] rerun blocked job={} user={} missing_assets={}",
                    originalJobId, principalUserId, missing.size());
            throw new MissingAssetsException(missing);
        }

        // 2) 构造 create request：所有快照原样复用，仅可覆盖 variants / profile
        JsonNode bindings = parseJsonOrNull(original.getSlotBindingsJson());
        JsonNode canvasSnap = parseJsonOrNull(original.getCanvasSnapshotJson());
        JsonNode slotsSnap = parseJsonOrNull(original.getSlotsSnapshotJson());
        JsonNode pertOverrides = parseJsonOrNull(original.getPerturbationOverridesJson());
        JsonNode stickerPool = parseJsonOrNull(original.getStickerPoolJson());
        JsonNode scenesSnap = parseJsonOrNull(original.getScenesSnapshotJson());

        Integer effectiveVariants = (overrides != null && overrides.outputVariants() != null && overrides.outputVariants() > 0)
                ? overrides.outputVariants()
                : original.getOutputVariants();
        String effectiveProfile = (overrides != null && overrides.perturbationProfile() != null && !overrides.perturbationProfile().isBlank())
                ? overrides.perturbationProfile()
                : original.getPerturbationProfile();

        MixcutCreateJobRequest req = new MixcutCreateJobRequest(
                null,                                  // 新 jobId 由 createInternal 自动生成
                principalUserId,                       // userId 真值已被 createInternal 覆盖为 principal
                original.getTemplateId(),
                original.getTemplateName(),
                original.getTemplateThumbnail(),
                bindings,
                effectiveProfile,
                effectiveVariants,
                "queued",
                0,
                null,                                  // createdAt 在 createInternal 内重置
                canvasSnap,
                slotsSnap,
                pertOverrides,
                stickerPool,
                scenesSnap,
                original.getProductId(),
                original.getDraftId()    // v0.48+: 保留实例血缘 —— 重跑出的任务仍指回同一实例
        );

        log.info("[mixcut] rerun fork job={} variants={} profile={} forkedFrom={}",
                "<auto>", effectiveVariants, effectiveProfile, originalJobId);
        return createForked(req, principalUserId, originalJobId);
    }

    /**
     * v0.48+: 给定 slot_bindings JsonNode 做缺素材校验（供 MixcutDraftService「从实例生成」复用）。
     * 序列化后委派给字符串版；解析失败视作无引用（不阻挡生成）。
     */
    public List<MissingAssetItem> collectMissingAssets(JsonNode slotBindings) {
        if (slotBindings == null || slotBindings.isNull()) return List.of();
        try {
            return collectMissingAssets(mapper.writeValueAsString(slotBindings));
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * 遍历 slot_bindings，对 source ∈ {upload, library} 且带 asset_id 的条目做存在性校验。
     * 仅 user-uploaded / library 引用走 asset 表；picgen / input / fixed 不涉及 asset，跳过。
     */
    private List<MissingAssetItem> collectMissingAssets(String slotBindingsJson) {
        if (slotBindingsJson == null || slotBindingsJson.isBlank()) return List.of();
        JsonNode root;
        try {
            root = mapper.readTree(slotBindingsJson);
        } catch (IOException e) {
            log.warn("[mixcut] rerun bindings parse failed: {}", e.getMessage());
            return List.of();
        }
        if (root == null || !root.isObject()) return List.of();

        // assetId → (slotId, source, kind) 反向索引；同一 asset 被多 slot 引用时只校验一次
        Map<String, MissingAssetItem> assetRefs = new java.util.LinkedHashMap<>();
        Iterator<Map.Entry<String, JsonNode>> it = root.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            String slotId = e.getKey();
            JsonNode b = e.getValue();
            if (b == null || !b.isObject()) continue;
            String source = b.path("source").asText("");
            if (!"upload".equals(source) && !"library".equals(source)) continue;
            String assetId = b.path("asset_id").asText("");
            if (assetId.isBlank()) continue;
            assetRefs.putIfAbsent(assetId, new MissingAssetItem(
                    slotId,
                    assetId,
                    source,
                    blankToNull(b.path("kind").asText(""))
            ));
        }
        if (assetRefs.isEmpty()) return List.of();

        Set<String> requestedIds = new HashSet<>(assetRefs.keySet());
        List<MixcutAsset> found = assetRepo.findAllById(requestedIds);
        Set<String> foundIds = new HashSet<>();
        for (MixcutAsset a : found) foundIds.add(a.getId());

        List<MissingAssetItem> missing = new ArrayList<>();
        for (Map.Entry<String, MissingAssetItem> e : assetRefs.entrySet()) {
            if (!foundIds.contains(e.getKey())) missing.add(e.getValue());
        }
        return missing;
    }

    private JsonNode parseJsonOrNull(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return mapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    private static String downloadFilename(MixcutRenderOutput output) {
        String jobId = output.getJob() == null ? "job" : safeFilePart(output.getJob().getId());
        int variant = Math.max(1, output.getVariantIndex() + 1);
        return "mixcut-" + jobId + "-v" + variant + ".mp4";
    }

    private static String safeFilePart(String value) {
        if (value == null || value.isBlank()) return "output";
        return value.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    /**
     * v0.13.0+: 仅当任务属于 principalUserId 时允许更新进度。
     * （worker 内部从 RenderingService 直接走 repo 不走本方法，所以不会被这层挡住。）
     */
    @Transactional
    public Optional<MixcutRenderJobDto> updateProgressForUser(String id, Integer progress, String status, String userId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        return jobRepo.findById(id)
                .filter(j -> userId.equals(j.getUserId()))
                .map(job -> {
                    if (progress != null) job.setProgress(Math.max(0, Math.min(100, progress)));
                    if (status != null && !status.isBlank()) job.setStatus(status);
                    jobRepo.save(job);
                    return MixcutRenderJobDto.from(job, mapper, cdnUrlSigner);
                });
    }

    private static String shortUuid() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private static String safe(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private String serializeJson(com.fasterxml.jackson.databind.JsonNode node) {
        if (node == null || node.isNull()) return null;
        try {
            return mapper.writeValueAsString(node);
        } catch (Exception e) {
            log.warn("[mixcut] serialize snapshot failed: {}", e.getMessage());
            return null;
        }
    }
}
