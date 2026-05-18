package com.aistareco.aep.dto;

import com.aistareco.aep.model.MixcutTemplate;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;

import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;

/**
 * 前端镜像：apps/web-celebrity/src/components/mixcut-zone/types.ts Template。
 * 字段名 snake_case 对齐前端；用 @JsonProperty 映射 Java camelCase。
 *
 * 注意：是嵌套结构（canvas / scenes / quality_gate / metadata），
 * 这里 metadata 用专门的 MetadataDto，canvas / scenes / quality_gate 用 JsonNode 透传，
 * 避免重复定义已经在前端有的类型。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MixcutTemplateDto(
        @JsonProperty("template_id") String templateId,
        @JsonProperty("name") String name,
        @JsonProperty("version") String version,
        @JsonProperty("canvas") JsonNode canvas,
        @JsonProperty("scenes") JsonNode scenes,
        @JsonProperty("perturbation_profile") String perturbationProfile,
        @JsonProperty("output_variants_default") int outputVariantsDefault,
        @JsonProperty("quality_gate") JsonNode qualityGate,
        @JsonProperty("metadata") MetadataDto metadata,
        @JsonProperty("is_factory") boolean isFactory,
        @JsonProperty("owner_user_id") String ownerUserId,
        @JsonProperty("created_at") String createdAt,
        @JsonProperty("updated_at") String updatedAt
) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MetadataDto(
            @JsonProperty("category") String category,
            @JsonProperty("tags") List<String> tags,
            @JsonProperty("thumbnail_url") String thumbnailUrl,
            @JsonProperty("required_tier") String requiredTier,
            @JsonProperty("cover_video_url") String coverVideoUrl
    ) {}

    public static MixcutTemplateDto from(MixcutTemplate t, ObjectMapper mapper) {
        JsonNode canvas;
        JsonNode scenes;
        JsonNode qualityGate;
        try {
            canvas = mapper.readTree(t.getCanvasJson());
            scenes = mapper.readTree(t.getScenesJson());
            qualityGate = mapper.readTree(t.getQualityGateJson());
        } catch (Exception e) {
            canvas = NullNode.getInstance();
            scenes = mapper.createArrayNode();
            qualityGate = NullNode.getInstance();
        }
        List<String> tags = (t.getTagsCsv() == null || t.getTagsCsv().isBlank())
                ? List.of()
                : Arrays.stream(t.getTagsCsv().split(","))
                        .map(String::trim).filter(s -> !s.isEmpty()).toList();
        var metadata = new MetadataDto(
                t.getCategory(),
                tags,
                t.getThumbnailUrl(),
                t.getRequiredTier(),
                t.getCoverVideoUrl()
        );
        return new MixcutTemplateDto(
                t.getTemplateId(),
                t.getName(),
                t.getVersion(),
                canvas,
                scenes,
                t.getPerturbationProfile(),
                t.getOutputVariantsDefault(),
                qualityGate,
                metadata,
                t.isFactory(),
                t.getOwnerUserId(),
                t.getCreatedAt() == null ? null
                        : t.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                t.getUpdatedAt() == null ? null
                        : t.getUpdatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        );
    }
}
