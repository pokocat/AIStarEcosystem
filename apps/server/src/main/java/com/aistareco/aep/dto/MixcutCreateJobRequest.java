package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * 前端 POST /api/mixcut/jobs 的请求体。
 * 对齐 apps/web-celebrity/.../mixcut-zone/types.ts RenderJob 提交字段；
 * 后端 id 可由前端预生成，亦可由后端补齐。
 *
 * v0.13+: 加 sticker_pool 字段（扰动贴图池），结构见 MixcutRenderJob.stickerPoolJson 注释。
 */
public record MixcutCreateJobRequest(
        @JsonProperty("id") String id,
        @JsonProperty("user_id") String userId,
        @JsonProperty("template_id") String templateId,
        @JsonProperty("template_name") String templateName,
        @JsonProperty("template_thumbnail") String templateThumbnail,
        @JsonProperty("slot_bindings") JsonNode slotBindings,
        @JsonProperty("perturbation_profile") String perturbationProfile,
        @JsonProperty("output_variants") Integer outputVariants,
        @JsonProperty("status") String status,
        @JsonProperty("progress") Integer progress,
        @JsonProperty("created_at") String createdAt,
        // v0.10: 模板快照与扰动总开关
        @JsonProperty("canvas_snapshot") JsonNode canvasSnapshot,
        @JsonProperty("slots_snapshot") JsonNode slotsSnapshot,
        @JsonProperty("perturbation_overrides") JsonNode perturbationOverrides,
        // v0.13+: 扰动贴图池
        @JsonProperty("sticker_pool") JsonNode stickerPool,
        // v0.25+: 场景快照（按顺序）。让渲染器按场景串行拼接而不是硬编 2 段。
        @JsonProperty("scenes_snapshot") JsonNode scenesSnapshot,
        // v0.26+: 关联商品 id（来自 create 页 ?product_id=X）；分发抽屉用它反查 Product
        @JsonProperty("product_id") String productId
) {
}
