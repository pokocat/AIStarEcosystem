package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * 前端 POST /api/mixcut/drafts（新建）/ PUT /api/mixcut/drafts/{id}（更新）的请求体。
 * 对齐 apps/web-celebrity/.../mixcut-zone/types.ts MixcutDraftUpsert。
 *
 * id 可由前端预生成（与 job 同款约定）；PUT 时以 path 上的 id 为准。
 */
public record MixcutDraftUpsertRequest(
        @JsonProperty("id") String id,
        @JsonProperty("template_id") String templateId,
        @JsonProperty("template_name") String templateName,
        @JsonProperty("template_thumbnail") String templateThumbnail,
        @JsonProperty("name") String name,
        @JsonProperty("template_version") String templateVersion,
        @JsonProperty("slot_bindings") JsonNode slotBindings,
        @JsonProperty("canvas_snapshot") JsonNode canvasSnapshot,
        @JsonProperty("slots_snapshot") JsonNode slotsSnapshot,
        @JsonProperty("scenes_snapshot") JsonNode scenesSnapshot,
        @JsonProperty("perturbation_overrides") JsonNode perturbationOverrides,
        @JsonProperty("sticker_pool") JsonNode stickerPool,
        @JsonProperty("perturbation_profile") String perturbationProfile,
        @JsonProperty("output_variants") Integer outputVariants,
        @JsonProperty("product_id") String productId
) {
}
