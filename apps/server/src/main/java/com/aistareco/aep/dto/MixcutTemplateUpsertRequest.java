package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/**
 * 模板「保存」请求体。前端把整个 Template 对象 POST/PUT 过来，
 * canvas / scenes / quality_gate 这些嵌套结构用 JsonNode 透传，避免重复定义。
 *
 * owner_user_id 由 controller 从认证上下文注入；前端不需要传。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MixcutTemplateUpsertRequest(
        @JsonProperty("template_id") String templateId,
        @JsonProperty("name") String name,
        @JsonProperty("version") String version,
        @JsonProperty("canvas") JsonNode canvas,
        @JsonProperty("scenes") JsonNode scenes,
        @JsonProperty("perturbation_profile") String perturbationProfile,
        @JsonProperty("output_variants_default") int outputVariantsDefault,
        @JsonProperty("quality_gate") JsonNode qualityGate,
        @JsonProperty("metadata") MetadataIn metadata
) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MetadataIn(
            @JsonProperty("category") String category,
            @JsonProperty("tags") List<String> tags,
            @JsonProperty("thumbnail_url") String thumbnailUrl,
            @JsonProperty("required_tier") String requiredTier,
            @JsonProperty("cover_video_url") String coverVideoUrl
    ) {}
}
