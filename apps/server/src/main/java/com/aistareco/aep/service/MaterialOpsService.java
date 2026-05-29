package com.aistareco.aep.service;

import com.aistareco.aep.model.MaterialScript;
import com.aistareco.aep.model.MaterialVideo;
import com.aistareco.aep.repository.MaterialScriptRepository;
import com.aistareco.aep.repository.MaterialVideoRepository;
import com.aistareco.aep.repository.MaterialViralHitRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
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
    private final ObjectMapper om;

    public MaterialOpsService(MaterialScriptRepository scriptRepo,
                              MaterialVideoRepository videoRepo,
                              MaterialViralHitRepository viralRepo,
                              ProductService productService,
                              ObjectMapper om) {
        this.scriptRepo = scriptRepo;
        this.videoRepo = videoRepo;
        this.viralRepo = viralRepo;
        this.productService = productService;
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
}
