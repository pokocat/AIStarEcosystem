package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.CelebrityActionPricingService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.ProductService;
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

    private final MaterialVideoJobRepository jobRepo;
    private final MaterialVideoModelClient modelClient;
    private final MaterialVideoWorker worker;
    private final CreditService creditService;
    private final CelebrityActionPricingService actionPricing;
    private final ProductService productService;
    private final ObjectMapper om;

    public MaterialVideoJobService(MaterialVideoJobRepository jobRepo,
                                   MaterialVideoModelClient modelClient,
                                   MaterialVideoWorker worker,
                                   CreditService creditService,
                                   CelebrityActionPricingService actionPricing,
                                   ProductService productService,
                                   ObjectMapper om) {
        this.jobRepo = jobRepo;
        this.modelClient = modelClient;
        this.worker = worker;
        this.creditService = creditService;
        this.actionPricing = actionPricing;
        this.productService = productService;
        this.om = om;
    }

    // ── 提交 ─────────────────────────────────────────────────────────────────
    /**
     * 提交一批生成任务（body = { items: [ {script_id, product_id, name, kind, parent_video_id,
     * prompt, variant_config, duration_sec, aspect_ratio} ... ] }）。
     *
     * 失败快：未配置视频大模型 → 抛 VIDEO_NOT_CONFIGURED（不创建任务 / 不扣费）。
     * 返回创建出的任务卡（MaterialVideo 形状，status=rendering）。
     */
    @Transactional
    public List<JsonNode> submit(JsonNode body, String userId) {
        List<JsonNode> items = new ArrayList<>();
        JsonNode arr = body != null ? body.get("items") : null;
        if (arr != null && arr.isArray()) arr.forEach(items::add);
        if (items.isEmpty()) return List.of();

        // 失败快：未配 token 直接抛明确错误（不静默兜底，对齐 MaterialAiService）。
        modelClient.ensureConfigured();

        long unit = videoUnitCost();
        boolean charge = billable(userId) && unit > 0;

        List<MaterialVideoJob> created = new ArrayList<>();
        for (JsonNode item : items) {
            MaterialVideoJob job = buildJob(item, userId);
            if (charge) {
                // 余额不足 → CreditService 抛 402（PAYMENT_REQUIRED），整批回滚（同事务）。
                creditService.hold(userId, unit, CREDIT_REF_TYPE, job.getId(),
                        "带货视频生成 · " + safe(job.getName(), "视频"));
                job.setCreditsHeld(unit);
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

        log.info("[material-video] submitted {} job(s) user={} charge={} unit={}", created.size(), userId, charge, unit);
        return created.stream().map(this::toCard).toList();
    }

    // ── 查询 ─────────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public JsonNode getJob(String id, String userId) {
        if (id == null || userId == null) return null;
        return jobRepo.findById(id)
                .filter(j -> userId.equals(j.getOwnerUserId()))
                .map(this::toCard)
                .orElse(null);
    }

    /** 列出当前用户的生成任务（可按 scriptId / productId 过滤），新→旧。 */
    @Transactional(readOnly = true)
    public List<JsonNode> listJobs(String userId, String scriptId, String productId) {
        if (userId == null || userId.isBlank()) return List.of();
        List<MaterialVideoJob> rows;
        if (scriptId != null && !scriptId.isBlank()) {
            rows = jobRepo.findByOwnerUserIdAndScriptIdOrderByCreatedAtDesc(userId, scriptId);
        } else if (productId != null && !productId.isBlank()) {
            rows = jobRepo.findByOwnerUserIdAndProductIdOrderByCreatedAtDesc(userId, productId);
        } else {
            rows = jobRepo.findByOwnerUserIdOrderByCreatedAtDesc(userId);
        }
        return rows.stream().map(this::toCard).toList();
    }

    // ── 内部 ─────────────────────────────────────────────────────────────────

    private MaterialVideoJob buildJob(JsonNode item, String userId) {
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
        if (job.getVideoUrl() != null) card.put("video_url", job.getVideoUrl());
        if (job.getThumbnailUrl() != null) card.put("thumbnail_url", job.getThumbnailUrl());
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
