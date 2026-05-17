package com.aistareco.aep.dto;

import com.aistareco.aep.model.MixcutRenderJob;
import com.aistareco.aep.model.MixcutRenderOutput;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 前端镜像：apps/web-celebrity/src/components/mixcut-zone/types.ts RenderJob。
 * 字段名 snake_case 对齐 mixcut 原型；用 @JsonProperty 把 Java camelCase 映射出去。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MixcutRenderJobDto(
        @JsonProperty("id") String id,
        @JsonProperty("user_id") String userId,
        @JsonProperty("template_id") String templateId,
        @JsonProperty("template_name") String templateName,
        @JsonProperty("template_thumbnail") String templateThumbnail,
        @JsonProperty("slot_bindings") JsonNode slotBindings,
        @JsonProperty("perturbation_profile") String perturbationProfile,
        @JsonProperty("output_variants") int outputVariants,
        @JsonProperty("status") String status,
        @JsonProperty("progress") int progress,
        @JsonProperty("error_message") String errorMessage,
        @JsonProperty("created_at") String createdAt,
        @JsonProperty("completed_at") String completedAt,
        @JsonProperty("outputs") List<MixcutRenderOutputDto> outputs
) {

    public static MixcutRenderJobDto from(MixcutRenderJob job, ObjectMapper mapper) {
        JsonNode bindings;
        try {
            bindings = job.getSlotBindingsJson() == null
                    ? NullNode.getInstance()
                    : mapper.readTree(job.getSlotBindingsJson());
        } catch (Exception e) {
            bindings = mapper.valueToTree(Map.of());
        }
        List<MixcutRenderOutputDto> outs = (job.getOutputs() == null || job.getOutputs().isEmpty())
                ? null
                : job.getOutputs().stream().map(o -> MixcutRenderOutputDto.from(o, mapper)).toList();
        return new MixcutRenderJobDto(
                job.getId(),
                job.getUserId(),
                job.getTemplateId(),
                job.getTemplateName(),
                job.getTemplateThumbnail(),
                bindings,
                job.getPerturbationProfile(),
                job.getOutputVariants(),
                job.getStatus(),
                job.getProgress(),
                job.getErrorMessage(),
                job.getCreatedAt() == null ? null : job.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                job.getCompletedAt() == null ? null : job.getCompletedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                outs
        );
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MixcutRenderOutputDto(
            @JsonProperty("id") String id,
            @JsonProperty("job_id") String jobId,
            @JsonProperty("variant_index") int variantIndex,
            @JsonProperty("file_url") String fileUrl,
            @JsonProperty("thumbnail_url") String thumbnailUrl,
            @JsonProperty("file_size") long fileSize,
            @JsonProperty("duration") double duration,
            @JsonProperty("phash_signature") String phashSignature,
            @JsonProperty("phash_distance_to_source") int phashDistanceToSource,
            @JsonProperty("applied_transforms") JsonNode appliedTransforms,
            @JsonProperty("watermark_token") String watermarkToken,
            @JsonProperty("created_at") String createdAt
    ) {
        public static MixcutRenderOutputDto from(MixcutRenderOutput o, ObjectMapper mapper) {
            JsonNode transforms;
            try {
                transforms = o.getAppliedTransformsJson() == null
                        ? NullNode.getInstance()
                        : mapper.readTree(o.getAppliedTransformsJson());
            } catch (Exception e) {
                transforms = NullNode.getInstance();
            }
            return new MixcutRenderOutputDto(
                    o.getId(),
                    o.getJob() == null ? null : o.getJob().getId(),
                    o.getVariantIndex(),
                    o.getFileUrl(),
                    o.getThumbnailUrl(),
                    o.getFileSize(),
                    o.getDuration(),
                    o.getPhashSignature(),
                    o.getPhashDistanceToSource(),
                    transforms,
                    o.getWatermarkToken(),
                    o.getCreatedAt() == null ? null : o.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
            );
        }
    }
}
