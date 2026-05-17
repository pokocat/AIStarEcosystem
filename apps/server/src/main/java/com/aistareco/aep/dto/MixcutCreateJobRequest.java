package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * 前端 POST /api/mixcut/jobs 的请求体。
 * 对齐 apps/web-celebrity/.../mixcut-zone/types.ts RenderJob 提交字段；
 * 后端 id 可由前端预生成，亦可由后端补齐。
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
        @JsonProperty("created_at") String createdAt
) {
}
