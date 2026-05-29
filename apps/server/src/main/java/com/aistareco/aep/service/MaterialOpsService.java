package com.aistareco.aep.service;

import com.aistareco.aep.model.MaterialScript;
import com.aistareco.aep.model.MaterialVideo;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.repository.MaterialScriptRepository;
import com.aistareco.aep.repository.MaterialVideoRepository;
import com.aistareco.aep.repository.MaterialViralHitRepository;
import com.aistareco.aep.repository.ProductRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 素材运营领域服务。脚本 / 视频 / 爆款以「关键列 + JSON payload」存储，出 wire 时
 * 直接回放 payload（前端 ScriptAsset / MaterialVideo / ViralHit 形状）。
 * productId 关联到商品库 —— 引用商品时 bump usageCount，实现数据集成。
 */
@Service
@Transactional
public class MaterialOpsService {

    private final MaterialScriptRepository scriptRepo;
    private final MaterialVideoRepository videoRepo;
    private final MaterialViralHitRepository viralRepo;
    private final ProductService productService;
    private final ProductRepository productRepo;
    private final MaterialAiService materialAi;
    private final CreditService creditService;
    private final CelebrityActionPricingService actionPricing;
    private final ObjectMapper om;

    public MaterialOpsService(MaterialScriptRepository scriptRepo,
                              MaterialVideoRepository videoRepo,
                              MaterialViralHitRepository viralRepo,
                              ProductService productService,
                              ProductRepository productRepo,
                              MaterialAiService materialAi,
                              CreditService creditService,
                              CelebrityActionPricingService actionPricing,
                              ObjectMapper om) {
        this.scriptRepo = scriptRepo;
        this.videoRepo = videoRepo;
        this.viralRepo = viralRepo;
        this.productService = productService;
        this.productRepo = productRepo;
        this.materialAi = materialAi;
        this.creditService = creditService;
        this.actionPricing = actionPricing;
        this.om = om;
    }

    // ── 脚本 ─────────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<JsonNode> listScripts(String userId) {
        List<JsonNode> out = new ArrayList<>();
        for (MaterialScript s : scriptRepo.findVisibleTo(userId)) out.add(parse(s.getPayloadJson()));
        return out;
    }

    /** 按 id 取脚本，并做归属校验：私有脚本仅本人可见，他人取到视为不存在。 */
    @Transactional(readOnly = true)
    public JsonNode getScript(String id, String userId) {
        MaterialScript s = scriptRepo.findById(id).orElse(null);
        if (s == null) return null;
        if (s.getOwnerUserId() != null && !s.getOwnerUserId().equals(userId)) return null; // 别人的私有脚本
        return parse(s.getPayloadJson());
    }

    public JsonNode saveScript(JsonNode body, String userId) {
        String id = text(body, "id");
        if (id == null || id.isBlank()) throw new IllegalArgumentException("script id required");
        String productId = text(body, "product_id");
        String kind = orDefault(text(body, "kind"), "my_script");
        MaterialScript existing = scriptRepo.findById(id).orElse(null);
        // 已存在的私有脚本只能本人改；他人改视为不存在（防越权覆盖）。
        if (existing != null && existing.getOwnerUserId() != null
                && !existing.getOwnerUserId().equals(userId)) {
            throw new IllegalStateException("script not owned by current user");
        }
        // 个人脚本归当前用户；共享类型（template/viral_clone/ai_seed）保持共享(null)。
        String ownerUserId = "my_script".equals(kind) ? userId : null;
        MaterialScript row = MaterialScript.builder()
                .id(id)
                .productId(productId)
                .kind(kind)
                .tier(orDefault(text(body, "tier"), "D"))
                .category(text(body, "category"))
                .hookType(text(body, "hook_type"))
                .durationSec(body.path("duration_sec").asInt(0))
                .ord(existing != null ? existing.getOrd() : 0)
                .ownerUserId(ownerUserId)
                .payloadJson(write(body))
                .build();
        scriptRepo.save(row);
        if (existing == null && productId != null) bumpProduct(productId);
        return parse(row.getPayloadJson());
    }

    // ── 视频 ─────────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<JsonNode> listVideos(String productId, String userId) {
        List<MaterialVideo> rows = (productId != null && !productId.isBlank())
                ? videoRepo.findVisibleToByProduct(userId, productId)
                : videoRepo.findVisibleTo(userId);
        List<JsonNode> out = new ArrayList<>();
        for (MaterialVideo v : rows) out.add(parse(v.getPayloadJson()));
        return out;
    }

    public void addVideos(List<JsonNode> videos, String userId) {
        if (videos == null) return;
        for (JsonNode v : videos) {
            String id = text(v, "id");
            if (id == null || id.isBlank()) continue;
            String productId = text(v, "product_id");
            videoRepo.save(MaterialVideo.builder()
                    .id(id)
                    .scriptId(text(v, "script_id"))
                    .productId(productId)
                    .kind(text(v, "kind"))
                    .status(orDefault(text(v, "status"), "ready"))
                    .parentVideoId(text(v, "parent_video_id"))
                    .ord(-1) // 新生成的排在前
                    .ownerUserId(userId) // 用户生成的视频归本人
                    .payloadJson(write(v))
                    .build());
            if (productId != null) bumpProduct(productId);
        }
    }

    /** 删视频：只能删自己生成的；共享演示视频（owner=null）与他人视频不允许删。 */
    public void deleteVideo(String id, String userId) {
        MaterialVideo v = videoRepo.findById(id).orElse(null);
        if (v == null) return;
        if (v.getOwnerUserId() == null || !v.getOwnerUserId().equals(userId)) {
            throw new IllegalStateException("video not owned by current user");
        }
        videoRepo.deleteById(id);
    }

    // ── AI 起稿 / 变量抽取（接真 LLM，失败降级，见 MaterialAiService） ──────────────
    /**
     * AI 起脚本候选（不落库，仅返回；用户选用并保存时才走 saveScript）。
     * 上下文优先取库内 Product（权威卖点）；库里没有则用请求里带的字段构造临时上下文。
     *
     * 计费（后端可配置）：单价取 CelebrityActionPricingService action="material.script-draft"
     * （admin → 平台与配置 → 引擎价格 → 动作单价；默认 0 = 不计费）。单价 > 0 时按
     * 单价 × 稿数 走 CreditService hold → 成功 commit / 失败 release 三段式（不可变账本约束）。
     * 余额不足 → CreditService 抛 402，明确报错。anonymous 用户不计费（dev/H2 lite）。
     *
     * NOT_SUPPORTED：挂起外层事务，让 hold / commit / release 各自独立成事务（立即落账），
     * 且 LLM 的 HTTP 调用不占用 DB 连接（避免长事务）。
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public List<JsonNode> draftScripts(JsonNode body, String userId) {
        String productId = text(body, "product_id");
        Product product = productId != null ? productRepo.findById(productId).orElse(null) : null;
        if (product == null) {
            product = new Product();
            product.setId(productId);
            product.setName(orDefault(text(body, "product_name"), "商品"));
            product.setCategory(orDefault(text(body, "category"), "通用"));
            product.setSellingPoints(text(body, "selling_points"));
        }
        String tone = orDefault(text(body, "tone"), "情感故事");
        List<String> audience = strList(body.get("audience"));
        int durationSec = body.path("duration_sec").asInt(38);
        int count = Math.max(1, Math.min(body.path("count").asInt(3), 5));

        long unit = scriptDraftUnitCost();
        long cost = unit * count;
        boolean charge = billable(userId) && cost > 0;
        String ref = "material-draft-" + (userId == null ? "anon" : userId) + "-" + System.nanoTime();
        String desc = "AI 起稿 · " + count + " 稿 · " + orDefault(product.getName(), "商品");

        if (charge) {
            // 余额不足在此抛 402（PAYMENT_REQUIRED），明确报错，不会进入 AI 调用。
            creditService.hold(userId, cost, "material_script_draft", ref, desc);
        }
        try {
            List<JsonNode> out = materialAi.draftScripts(product, tone, audience, durationSec, count);
            if (charge) creditService.commitHold("material_script_draft", ref, cost, desc);
            return out;
        } catch (RuntimeException e) {
            // AI 未配置 / 调用失败 / 解析失败 → 退还冻结，向上抛明确错误（不扣费）。
            if (charge) {
                try {
                    creditService.releaseHold("material_script_draft", ref, "AI 起稿失败回滚");
                } catch (Exception ignore) {
                    /* 退款失败仅 log，不掩盖原始错误 */
                }
            }
            throw e;
        }
    }

    /** AI 起稿单价（积分/单稿）；未配置或 0 → 0（不计费）。 */
    private long scriptDraftUnitCost() {
        Long p = actionPricing.creditPriceOf(CelebrityActionPricingService.ACTION_SCRIPT_DRAFT);
        return p != null && p > 0 ? p : 0L;
    }

    /** "anonymous" 等占位用户名不参与扣费（与 mixcut 同口径）。 */
    private static boolean billable(String userId) {
        return userId != null && !userId.isBlank() && !"anonymous".equals(userId);
    }

    /**
     * 从脚本抽取可替换变量（owner 校验：私有脚本仅本人）。
     * 找不到 / 无权访问 → 返回空列表（前端用正则兜底，不泄露存在性）。
     * NOT_SUPPORTED：LLM 的 HTTP 调用不占用 DB 连接（脚本只读一次，autocommit 即可）。
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public List<JsonNode> extractVariables(String scriptId, String userId) {
        JsonNode script = getScript(scriptId, userId);
        if (script == null) return new ArrayList<>();
        return materialAi.extractVariables(script.get("blocks"));
    }

    // ── 爆款雷达 ───────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<JsonNode> listViralHits() {
        List<JsonNode> out = new ArrayList<>();
        viralRepo.findAllByOrderByScoreDesc().forEach(h -> out.add(parse(h.getPayloadJson())));
        return out;
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    private void bumpProduct(String productId) {
        try {
            productService.bumpUsageCountByProductId(productId);
        } catch (Exception ignored) {
            // 商品不存在 / 方法签名差异时静默，不阻塞素材落库。
        }
    }

    private JsonNode parse(String json) {
        try {
            return om.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException("bad material payload json", e);
        }
    }

    private String write(JsonNode node) {
        try {
            return om.writeValueAsString(node);
        } catch (Exception e) {
            throw new RuntimeException("cannot serialize material payload", e);
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }

    private static List<String> strList(JsonNode arr) {
        List<String> out = new ArrayList<>();
        if (arr != null && arr.isArray()) {
            arr.forEach(x -> {
                String t = x.asText("").strip();
                if (!t.isBlank()) out.add(t);
            });
        }
        return out;
    }
}
