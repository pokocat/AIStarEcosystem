package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.dto.EndpointCapabilityDto;
import com.aistareco.aep.dto.MaterialVideoModelsDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CelebrityActionPricingService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.ProductService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 带货视频生成任务编排 —— 提交（扣费 + 异步派发）/ 查询 / 列表 / wire 映射。
 *
 * 真扣费：CreditService hold（提交时）→ worker 出片 commit / 失败 release（不可变账本约束，CLAUDE.md §4.2）。
 * 单价走 CelebrityActionPricingService action="material.video-generate"（admin 可配；默认 30/条）。
 *
 * 输出统一为 MaterialVideo 形状 JsonNode（前端 material-ops MaterialVideo），状态映射：
 *   queued/submitting/generating → rendering；succeeded → ready；failed → failed。
 */
@Service
public class MaterialVideoJobService {

    private static final Logger log = LoggerFactory.getLogger(MaterialVideoJobService.class);

    static final long VIDEO_UNIT_COST_DEFAULT = 30L;
    static final String CREDIT_REF_TYPE = "material_video_job";

    /**
     * 子产品分区（{@link MaterialVideoJob#getApp()}）——本表被带货线（明星带货 · 素材运营）与
     * 短剧线（AI 短剧 · 分镜出片 / 整集出片）共用，提交与查询必须显式带 app，否则同一用户在
     * 带货素材库里会看到短剧分镜视频（反之亦然）。
     */
    public static final String APP_CELEBRITY = "celebrity";
    public static final String APP_DRAMA = "drama";

    private final MaterialVideoJobRepository jobRepo;
    private final MaterialVideoModelClient modelClient;
    private final MaterialVideoWorker worker;
    private final CreditService creditService;
    private final CelebrityActionPricingService actionPricing;
    private final ProductService productService;
    private final AiModelInvocationService invocation;
    private final CdnUrlSigner signer;
    private final ObjectMapper om;

    public MaterialVideoJobService(MaterialVideoJobRepository jobRepo,
                                   MaterialVideoModelClient modelClient,
                                   MaterialVideoWorker worker,
                                   CreditService creditService,
                                   CelebrityActionPricingService actionPricing,
                                   ProductService productService,
                                   AiModelInvocationService invocation,
                                   ObjectMapper om,
                                   CdnUrlSigner signer) {
        this.jobRepo = jobRepo;
        this.modelClient = modelClient;
        this.worker = worker;
        this.creditService = creditService;
        this.actionPricing = actionPricing;
        this.productService = productService;
        this.invocation = invocation;
        this.signer = signer;
        this.om = om;
    }

    // ── 模型候选出 wire ───────────────────────────────────────────────────────
    /**
     * 带货线「生成模型」下拉：启用候选 × 启用端点 + capability + 单价 + 有效时长区间
     * （= 协议硬边界 ∩ candidate.maxDurationSec，服务端算好，前端不猜协议）。
     * 默认 binding 存在但无 candidate 行时合成一条默认项 —— 配置了视频能力时列表恒非空。
     */
    @Transactional(readOnly = true)
    public MaterialVideoModelsDto listModels() {
        List<MaterialVideoModelsDto.VideoModelOptionDto> out = new ArrayList<>();
        for (AiModelInvocationService.ResolvedEndpoint r : invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION)) {
            if (!r.candidate().isEnabled() || !r.endpoint().isEnabled()) continue;
            // 缺 baseUrl / 有效 apiKey 的端点提交时必吃 VIDEO_NOT_CONFIGURED —— 不作为可用模型出 wire，
            // 否则前端会放开报价与提交、用户走到最后一步才失败。
            if (!modelClient.isEndpointReady(r.endpoint())) continue;
            out.add(toModelOption(r.endpoint(), r.candidate(), r.isDefault()));
        }
        if (out.isEmpty()) {
            invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION)
                    .filter(modelClient::isEndpointReady)
                    .ifPresent(ep -> out.add(toModelOption(ep, null, true)));
        }
        return new MaterialVideoModelsDto(out);
    }

    private MaterialVideoModelsDto.VideoModelOptionDto toModelOption(
            AiModelEndpoint endpoint, com.aistareco.aep.model.AiAppEndpointCandidate candidate, boolean isDefault) {
        long cost = candidate != null && candidate.getCreditCostOverride() != null
                ? Math.max(0L, candidate.getCreditCostOverride()) : videoUnitCost();
        MaterialVideoModelClient.DurationBounds bounds =
                MaterialVideoModelClient.intersect(modelClient.protocolDurationBounds(endpoint), candidate);
        return new MaterialVideoModelsDto.VideoModelOptionDto(
                endpoint.getId(),
                endpoint.getName(),
                isDefault,
                candidate != null ? EndpointCapabilityDto.from(candidate) : null,
                cost,
                AiModelInvocationService.videoBillingUnit(endpoint, candidate),
                bounds.minSec(),
                bounds.maxSec(),
                candidate != null);
    }

    /** 默认视频端点的有效时长区间；视频能力未配置时返回 null（起稿等旁路消费方自行回落默认值）。 */
    @Transactional(readOnly = true)
    public MaterialVideoModelClient.DurationBounds defaultDurationBounds() {
        return invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, null)
                .map(r -> MaterialVideoModelClient.intersect(
                        modelClient.protocolDurationBounds(r.endpoint()), r.candidate()))
                .orElse(null);
    }

    // ── 提交 ─────────────────────────────────────────────────────────────────
    /** 在任务落库 / hold 积分前校验所选端点与时长（必填 >0 + 有效区间，见 modelClient.validateRequest）。 */
    public void validateRequest(String endpointId, int durationSec) {
        modelClient.validateRequest(endpointId, durationSec);
    }

    /**
     * 提交一批生成任务（body = { items: [ {script_id, product_id, name, kind, parent_video_id,
     * prompt, variant_config, duration_sec, aspect_ratio} ... ] }）。
     *
     * 失败快：未配置视频大模型 → 抛 VIDEO_NOT_CONFIGURED（不创建任务 / 不扣费）。
     * 返回创建出的任务卡（MaterialVideo 形状，status=rendering）。
     *
     * @param app 子产品分区（{@link #APP_CELEBRITY} / {@link #APP_DRAMA}）；决定这批任务归哪个
     *            应用的资产列表，调用方必须显式传（跨应用可见性靠它隔离）。
     */
    @Transactional
    public List<JsonNode> submit(JsonNode body, String userId, String app) {
        List<JsonNode> items = new ArrayList<>();
        JsonNode arr = body != null ? body.get("items") : null;
        if (arr != null && arr.isArray()) arr.forEach(items::add);
        if (items.isEmpty()) return List.of();

        // 失败快：未配 token 直接抛明确错误（不静默兜底，对齐 MaterialAiService）。
        modelClient.ensureConfigured();

        boolean billable = billable(userId);

        // 第一阶段：整批解析为不可变计划（端点白名单 / Key / 时长必填与有效区间 / 单价含
        // PER_SECOND 展开与 VIDEO_PRICE_OVERFLOW）——任何 hold 之前完成全部校验与报价，
        // 批内任一非法 → 整批无任务、无冻结、不提前占钱包锁（@Transactional 回滚只是最后防线）。
        // 单价优先级：内部调用方 item.credit_cost（如短剧独立定价）> 候选模型 override > 带货线默认价。
        record PlannedItem(JsonNode item, long unit) {}
        List<PlannedItem> planned = new ArrayList<>();
        for (JsonNode item : items) {
            String endpointId = endpointIdOf(item);
            int durationSec = item.path("duration_sec").asInt(0);
            modelClient.validateRequest(endpointId, durationSec);
            planned.add(new PlannedItem(item, itemUnitCost(item, endpointId, durationSec)));
        }

        // 第二阶段：逐 item 落库 + hold（金额 = 第一阶段算好的 unit，报价与冻结同源）。
        List<MaterialVideoJob> created = new ArrayList<>();
        for (PlannedItem p : planned) {
            MaterialVideoJob job = buildJob(p.item(), userId, app);
            if (billable && p.unit() > 0) {
                // 余额不足 → CreditService 抛 402（PAYMENT_REQUIRED），整批回滚（同事务）。
                String label = orDefault(text(p.item(), "credit_label"), "带货视频生成");
                creditService.hold(userId, p.unit(), CREDIT_REF_TYPE, job.getId(),
                        label + " · " + safe(job.getName(), "视频"));
                job.setCreditsHeld(p.unit());
            }
            jobRepo.save(job);
            created.add(job);
            bumpProduct(job.getProductId());
        }

        // 异步派发必须在事务 commit 之后（worker 新事务才看得到这些行）。
        List<String> ids = created.stream().map(MaterialVideoJob::getId).toList();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() {
                    ids.forEach(worker::generateAsync);
                }
            });
        } else {
            ids.forEach(worker::generateAsync);
        }

        log.info("[material-video] submitted {} job(s) user={} app={} billable={}",
                created.size(), userId, normalizeApp(app), billable);
        return created.stream().map(this::toCard).toList();
    }

    // ── 查询 ─────────────────────────────────────────────────────────────────
    /** 单个任务的进度 / 结果；归属人 + 子产品分区双重校验（别的应用的任务一律当不存在）。 */
    @Transactional(readOnly = true)
    public JsonNode getJob(String id, String userId, String app) {
        if (id == null || userId == null) return null;
        String scope = normalizeApp(app);
        return jobRepo.findById(id)
                .filter(j -> userId.equals(j.getOwnerUserId()))
                .filter(j -> scope.equals(appOf(j)))
                .map(this::toCard)
                .orElse(null);
    }

    /** 管理端按 externalTaskId 对账恢复误判失败任务；不重提上游。 */
    public JsonNode reconcileSucceeded(String id) {
        return toCard(worker.reconcileSucceeded(id));
    }

    /** 列出当前用户在指定子产品下的生成任务（可按 scriptId / productId 过滤），新→旧。 */
    @Transactional(readOnly = true)
    public List<JsonNode> listJobs(String userId, String scriptId, String productId, String app) {
        if (userId == null || userId.isBlank()) return List.of();
        String scope = normalizeApp(app);
        List<MaterialVideoJob> rows;
        if (scriptId != null && !scriptId.isBlank()) {
            rows = jobRepo.findScopedByScript(userId, scope, scriptId);
        } else if (productId != null && !productId.isBlank()) {
            rows = jobRepo.findScopedByProduct(userId, scope, productId);
        } else {
            rows = jobRepo.findScoped(userId, scope);
        }
        return rows.stream().map(this::toCard).toList();
    }

    // ── 内部 ─────────────────────────────────────────────────────────────────

    /** 未显式传 app 时按带货线处理（本表的原始归属），杜绝 null 分区行。 */
    static String normalizeApp(String app) {
        return app != null && !app.isBlank() ? app : APP_CELEBRITY;
    }

    /** 行的实际分区：老数据 app 为 null（回填前）时按 kind 前缀推断，读路径不漏也不串。 */
    static String appOf(MaterialVideoJob job) {
        if (job.getApp() != null && !job.getApp().isBlank()) return job.getApp();
        String kind = job.getKind();
        return kind != null && kind.startsWith("drama-") ? APP_DRAMA : APP_CELEBRITY;
    }

    private MaterialVideoJob buildJob(JsonNode item, String userId, String app) {
        String id = "mvj_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String kind = orDefault(text(item, "kind"), "baseline");
        int durationSec = item.path("duration_sec").asInt(0);
        String aspect = orDefault(text(item, "aspect_ratio"), "9:16");
        OffsetDateTime now = OffsetDateTime.now();

        // payload：MaterialVideo 形状快照，回显用（toCard 在此基础上覆盖 live 字段）。
        ObjectNode payload = om.createObjectNode();
        payload.put("id", id);
        payload.put("script_id", text(item, "script_id"));
        if (text(item, "product_id") != null) payload.put("product_id", text(item, "product_id"));
        payload.put("kind", kind);
        payload.put("name", orDefault(text(item, "name"), kind.equals("variant") ? "派生视频" : "基线视频"));
        if (text(item, "parent_video_id") != null) payload.put("parent_video_id", text(item, "parent_video_id"));
        payload.put("duration_sec", durationSec);
        payload.put("aspect_ratio", aspect);
        JsonNode vc = item.get("variant_config");
        if (vc != null && vc.isObject()) payload.set("variant_config", vc);
        payload.put("cover_color", pickColor(id));
        payload.put("created_at", now.toString());

        return MaterialVideoJob.builder()
                .id(id)
                .ownerUserId(userId)
                .app(normalizeApp(app))
                .scriptId(text(item, "script_id"))
                .productId(text(item, "product_id"))
                .name(orDefault(text(item, "name"), kind.equals("variant") ? "派生视频" : "基线视频"))
                .kind(kind)
                .parentVideoId(text(item, "parent_video_id"))
                .prompt(text(item, "prompt"))
                .variantConfigJson(vc != null ? write(vc) : null)
                .payloadJson(write(payload))
                .durationSec(durationSec)
                .aspectRatio(aspect)
                .status("queued")
                .progress(0)
                .creditsHeld(0L)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    /** MaterialVideoJob → MaterialVideo 形状 JsonNode（回显）。 */
    JsonNode toCard(MaterialVideoJob job) {
        ObjectNode card;
        try {
            JsonNode base = job.getPayloadJson() != null ? om.readTree(job.getPayloadJson()) : om.createObjectNode();
            card = base.isObject() ? (ObjectNode) base : om.createObjectNode();
        } catch (Exception e) {
            card = om.createObjectNode();
        }
        card.put("id", job.getId());
        card.put("script_id", nz(job.getScriptId()));
        if (job.getProductId() != null) card.put("product_id", job.getProductId());
        card.put("kind", orDefault(job.getKind(), "baseline"));
        card.put("name", orDefault(job.getName(), "视频"));
        if (job.getParentVideoId() != null) card.put("parent_video_id", job.getParentVideoId());
        card.put("status", wireStatus(job.getStatus()));
        card.put("duration_sec", job.getDurationSec());
        card.put("aspect_ratio", orDefault(job.getAspectRatio(), "9:16"));
        if (!card.has("variant_config") && job.getVariantConfigJson() != null) {
            try { card.set("variant_config", om.readTree(job.getVariantConfigJson())); } catch (Exception ignore) { /* */ }
        }
        card.putNull("metrics");
        if (!card.has("cover_color")) card.put("cover_color", pickColor(job.getId()));
        card.put("created_at", job.getCreatedAt() != null ? job.getCreatedAt().toString() : null);
        card.put("generated_at", "succeeded".equals(job.getStatus()) && job.getCompletedAt() != null
                ? job.getCompletedAt().toString() : null);
        card.putNull("render_cost_sec");
        card.put("model", orDefault(job.getModelUsed(), "ai-video"));
        card.put("progress_pct", job.getProgress());
        card.put("stage", stageLabel(job.getStatus()));
        // 资产 URL 出 wire 经 signer（OSS 域才签，local /cdn 相对路径不匹配 base → 原样返回，dev 零影响）。
        // C-1 范围选择：last_frame 走 cdnKey 真值派生（§4.7.4，不过期）+ fallback 旧 lastFrameUrl；
        // video/thumbnail 只做 maybeSign 兜底（顺手偿还 §4.7.6 URL 时效欠债，不做完整 URL→key 迁移）。
        if (job.getVideoUrl() != null) card.put("video_url", signer.maybeSign(job.getVideoUrl()));
        if (job.getThumbnailUrl() != null) card.put("thumbnail_url", signer.maybeSign(job.getThumbnailUrl()));
        String lastFrame = job.getLastFrameCdnKey() != null && !job.getLastFrameCdnKey().isBlank()
                ? signer.signKey(job.getLastFrameCdnKey()) : null;
        if (lastFrame == null && job.getLastFrameUrl() != null) {
            lastFrame = signer.maybeSign(job.getLastFrameUrl());
        }
        if (lastFrame != null) card.put("last_frame_url", lastFrame);
        if (job.getErrorMessage() != null) card.put("error_message", job.getErrorMessage());
        if (job.getExternalTaskId() != null) card.put("external_task_id", job.getExternalTaskId());
        return card;
    }

    private static String wireStatus(String jobStatus) {
        if (jobStatus == null) return "rendering";
        return switch (jobStatus) {
            case "succeeded" -> "ready";
            case "failed" -> "failed";
            default -> "rendering"; // queued / submitting / generating
        };
    }

    private static String stageLabel(String jobStatus) {
        if (jobStatus == null) return "处理中";
        return switch (jobStatus) {
            case "queued" -> "已入队";
            case "submitting" -> "提交生成请求";
            case "generating" -> "AI 生成中";
            case "succeeded" -> "已完成";
            case "failed" -> "生成失败";
            default -> "处理中";
        };
    }

    /** 单条视频单价：调用方在 item 里显式传 credit_cost（≥0）则用它（app 维度独立定价，解耦本带货线），否则回落带货线定价。 */
    private long itemUnitCost(JsonNode item, String endpointId, int durationSec) {
        long override = item.path("credit_cost").asLong(-1L);
        if (override >= 0) return override;
        Long modelOverride = modelClient.resolveCreditCostOverride(endpointId, durationSec);
        if (modelOverride != null) return modelOverride;
        return videoUnitCost();
    }

    private static String endpointIdOf(JsonNode item) {
        JsonNode vc = item == null ? null : item.get("variant_config");
        return text(vc, "endpoint_id");
    }

    private long videoUnitCost() {
        Long p = actionPricing.creditPriceOf(CelebrityActionPricingService.ACTION_VIDEO_GENERATE);
        return p != null && p > 0 ? p : VIDEO_UNIT_COST_DEFAULT;
    }

    private static boolean billable(String userId) {
        return userId != null && !userId.isBlank() && !"anonymous".equals(userId);
    }

    private void bumpProduct(String productId) {
        if (productId == null || productId.isBlank()) return;
        try {
            productService.bumpUsageCountByProductId(productId);
        } catch (Exception ignored) {
            /* 商品不存在时静默，不阻塞任务创建 */
        }
    }

    private static final String[] PALETTE = {"#7c5cff", "#ff5b8a", "#22b59a", "#f0a83a", "#5b3fe0", "#ff8a5b"};
    private static String pickColor(String id) {
        int h = id == null ? 0 : Math.abs(id.hashCode());
        return PALETTE[h % PALETTE.length];
    }

    private String write(JsonNode node) {
        try { return om.writeValueAsString(node); } catch (Exception e) { return "{}"; }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }

    private static String safe(String v, String d) {
        return (v == null || v.isBlank()) ? d : v;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
