package com.aistareco.aep.dto;

import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 发布任务读 DTO。
 *
 * Mirror packages/types/src/publish-job.ts PublishJob 字段；
 * platformId / platformName 是冗余展示字段（与 Platform.id 对齐）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PublishJobDto(
        String id,
        String userId,
        String projectId,
        String socialAccountId,
        String platformId,
        String platformName,
        String status,
        int progress,
        String videoUrl,
        String title,
        String description,
        List<String> tags,
        String coverUrl,
        /** 抖音商品挂载链接；非抖音 / 非带货视频留空。 */
        String productLink,
        /** 抖音商品挂载文案。 */
        String productTitle,
        String externalTaskId,
        String externalUrl,
        String errorCode,
        String errorMessage,
        Long creditsSpent,
        /**
         * status=awaiting_user 时存在；其他状态为 null。
         * 字段结构 mirror InteractionRequired in packages/types。
         */
        Map<String, Object> interactionRequired,
        Instant scheduledAt,
        Instant createdAt,
        Instant updatedAt
) {
    private static final ObjectMapper OM = new ObjectMapper();

    /**
     * signer 必传：videoUrl/coverUrl 落库即是 TTL 签名 URL（AEP_CDN_SIGNED_URL_TTL_SECONDS，
     * 默认 3600s），读路径不重签会在签名过期后直接 403（AGENTS.md §4.7.7 教训，v0.83 dispatch
     * 路径已修，本次补齐读路径）。signer.maybeSign 对已过期签名同样有效，driver=local 的相对
     * 路径原样返回。
     */
    public static PublishJobDto from(PublishJob j, CdnUrlSigner signer) {
        return new PublishJobDto(
                j.getId(),
                j.getUserId(),
                j.getProjectId(),
                j.getSocialAccountId(),
                j.getPlatformId() != null ? j.getPlatformId() : (j.getPlatform() != null ? j.getPlatform().wire() : null),
                j.getPlatformName(),
                j.getStatus() != null ? j.getStatus().wire() : null,
                j.getProgress(),
                signer.maybeSign(j.getVideoUrl()),
                j.getTitle(),
                j.getDescription(),
                j.getTags() != null ? j.getTags() : List.of(),
                signer.maybeSign(j.getCoverUrl()),
                j.getProductLink(),
                j.getProductTitle(),
                j.getExternalTaskId(),
                j.getExternalUrl(),
                j.getErrorCode(),
                j.getErrorMessage(),
                j.getCreditsSpent(),
                parseInteraction(j.getInteractionRequiredJson()),
                j.getScheduledAt(),
                j.getCreatedAt(),
                j.getUpdatedAt()
        );
    }

    private static Map<String, Object> parseInteraction(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return OM.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            // Bad JSON in DB shouldn't crash the read path — log via caller side
            // would be better, but DTOs are static so swallow + return null.
            return null;
        }
    }
}
