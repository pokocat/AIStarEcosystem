package com.aistareco.aep.dto;

import com.aistareco.aep.model.MixcutDraft;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.format.DateTimeFormatter;

/**
 * 前端镜像：apps/web-celebrity/src/components/mixcut-zone/types.ts MixcutDraft。
 * 字段名 snake_case 对齐前端；快照 JSON 列出 wire 时还原为对象。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MixcutDraftDto(
        @JsonProperty("id") String id,
        @JsonProperty("user_id") String userId,
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
        @JsonProperty("output_variants") int outputVariants,
        @JsonProperty("product_id") String productId,
        @JsonProperty("status") String status,
        @JsonProperty("generated_job_count") int generatedJobCount,
        @JsonProperty("last_generated_at") String lastGeneratedAt,
        @JsonProperty("created_at") String createdAt,
        @JsonProperty("updated_at") String updatedAt
) {

    public static MixcutDraftDto from(MixcutDraft d, ObjectMapper mapper) {
        return new MixcutDraftDto(
                d.getId(),
                d.getUserId(),
                d.getTemplateId(),
                d.getTemplateName(),
                d.getTemplateThumbnail(),
                d.getName(),
                d.getTemplateVersion(),
                parseOrEmptyObject(d.getSlotBindingsJson(), mapper),
                parseOrNull(d.getCanvasSnapshotJson(), mapper),
                parseOrNull(d.getSlotsSnapshotJson(), mapper),
                parseOrNull(d.getScenesSnapshotJson(), mapper),
                parseOrNull(d.getPerturbationOverridesJson(), mapper),
                parseOrNull(d.getStickerPoolJson(), mapper),
                d.getPerturbationProfile(),
                d.getOutputVariants(),
                d.getProductId(),
                d.getStatus(),
                d.getGeneratedJobCount(),
                d.getLastGeneratedAt() == null ? null : d.getLastGeneratedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                d.getCreatedAt() == null ? null : d.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                d.getUpdatedAt() == null ? null : d.getUpdatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        );
    }

    private static JsonNode parseOrNull(String json, ObjectMapper mapper) {
        if (json == null || json.isBlank()) return null;
        try {
            return mapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private static JsonNode parseOrEmptyObject(String json, ObjectMapper mapper) {
        JsonNode n = parseOrNull(json, mapper);
        return n != null ? n : mapper.createObjectNode();
    }
}
