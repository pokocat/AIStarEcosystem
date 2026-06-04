package com.aistareco.aep.dto;

import com.aistareco.aep.model.MixcutRenderJob;
import com.aistareco.aep.model.MixcutRenderOutput;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
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
        @JsonProperty("outputs") List<MixcutRenderOutputDto> outputs,
        @JsonProperty("canvas_snapshot") JsonNode canvasSnapshot,
        @JsonProperty("slots_snapshot") JsonNode slotsSnapshot,
        @JsonProperty("perturbation_overrides") JsonNode perturbationOverrides,
        @JsonProperty("source_phash") String sourcePhash,
        @JsonProperty("sticker_pool") JsonNode stickerPool,
        // v0.25+: 场景快照（按顺序）；让前端任务详情页能回放当时的场景结构，渲染器据此分段拼接
        @JsonProperty("scenes_snapshot") JsonNode scenesSnapshot,
        // v0.26+: 关联商品 id（来自 create 页 ?product_id=X）；分发抽屉用它反查商品自动填挂载
        @JsonProperty("product_id") String productId,
        // v0.30+: 任务血缘 —— 「重跑」入口 fork 出新 job 时填入原 jobId；直接创建的任务为空
        @JsonProperty("forked_from_job_id") String forkedFromJobId,
        // v0.48+: 来源实例 id（草稿）。生成任务从实例创建时填入，前端任务详情可深链回该实例继续编辑
        @JsonProperty("draft_id") String draftId
) {

    /**
     * v0.47-：老入口，不签 CDN URL。新代码请用 {@link #from(MixcutRenderJob, ObjectMapper, CdnUrlSigner)}。
     * 仅保留以避免 break 老 test / seeder 调用。
     */
    public static MixcutRenderJobDto from(MixcutRenderJob job, ObjectMapper mapper) {
        return from(job, mapper, CdnUrlSigner.NOOP);
    }

    /**
     * v0.47+：所有出 wire 的 CDN URL 字段过一遍 {@link CdnUrlSigner#maybeSign(String)} —
     * 命中 OSS/CDN 域的 URL 会被换成限时签名版（防流量盗刷）。
     */
    public static MixcutRenderJobDto from(MixcutRenderJob job, ObjectMapper mapper, CdnUrlSigner signer) {
        JsonNode bindings;
        try {
            bindings = job.getSlotBindingsJson() == null
                    ? NullNode.getInstance()
                    : mapper.readTree(job.getSlotBindingsJson());
        } catch (Exception e) {
            bindings = mapper.valueToTree(Map.of());
        }
        JsonNode canvasSnap = parseOrNull(job.getCanvasSnapshotJson(), mapper);
        JsonNode slotsSnap = parseOrNull(job.getSlotsSnapshotJson(), mapper);
        JsonNode pertOverrides = parseOrNull(job.getPerturbationOverridesJson(), mapper);
        JsonNode stickerPool = parseOrNull(job.getStickerPoolJson(), mapper);
        JsonNode scenesSnap = parseOrNull(job.getScenesSnapshotJson(), mapper);
        // v0.21+: 软删的 output 不进 DTO；前端「视频库」用户点删除后立即从列表消失。
        // 30 天后由 MixcutOutputCleanupScheduler 物理清理。
        List<MixcutRenderOutputDto> outs = (job.getOutputs() == null || job.getOutputs().isEmpty())
                ? null
                : job.getOutputs().stream()
                        .filter(o -> o.getDeletedAt() == null)
                        .map(o -> MixcutRenderOutputDto.from(o, mapper, signer))
                        .toList();
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
                outs,
                canvasSnap,
                slotsSnap,
                pertOverrides,
                job.getSourcePhash(),
                stickerPool,
                scenesSnap,
                job.getProductId(),
                job.getForkedFromJobId(),
                job.getDraftId()
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
            @JsonProperty("created_at") String createdAt,
            // v0.14+: CDN URL（发布链路真值源；缺失时回落 file_url）
            @JsonProperty("cdn_url") String cdnUrl,
            @JsonProperty("cdn_key") String cdnKey,
            @JsonProperty("cdn_thumbnail_url") String cdnThumbnailUrl,
            @JsonProperty("cdn_uploaded_at") String cdnUploadedAt,
            // v0.19+: 派发计数 + 最近派发时间（视频库不再隐藏已发布；以此字段提示）
            @JsonProperty("publish_count") int publishCount,
            @JsonProperty("last_published_at") String lastPublishedAt
    ) {
        /** v0.47-：老入口，不签 CDN URL。 */
        public static MixcutRenderOutputDto from(MixcutRenderOutput o, ObjectMapper mapper) {
            return from(o, mapper, CdnUrlSigner.NOOP);
        }

        /**
         * v0.47F+：cdnKey 为真值优先，DB cdnUrl 仅作 fallback。
         *
         * <p>设计：DB 存 OSS object key（与 driver / 域名 / key-prefix 无关），URL 是 driver
         * 决定的派生值。出 wire 时优先 {@code signer.signKey(cdnKey)} 实时构造，DB cdnUrl 仅
         * 在新代码没填 cdnKey 的过渡数据上用作 fallback。这样：
         * <ul>
         *   <li>driver 切换 local↔oss → 老数据自动适配新 driver</li>
         *   <li>CDN 域名换 → 只改 base-url 配置，下次出 wire 自动用新域名</li>
         *   <li>key-prefix 调整 → 老 row 的 cdnKey 仍是原始 key，publicUrlFor() 自动补新前缀</li>
         * </ul>
         *
         * <p>thumbnailUrl 同理：v0.47F+ 起 fileUrl 单独存的本地路径不签（{@link CdnUrlSigner#maybeSign}
         * 对相对路径透传），cdnThumbnailUrl 走 cdnKey + .thumb 派生。
         */
        public static MixcutRenderOutputDto from(MixcutRenderOutput o, ObjectMapper mapper, CdnUrlSigner signer) {
            JsonNode transforms;
            try {
                transforms = o.getAppliedTransformsJson() == null
                        ? NullNode.getInstance()
                        : mapper.readTree(o.getAppliedTransformsJson());
            } catch (Exception e) {
                transforms = NullNode.getInstance();
            }

            // v0.47F+: cdnKey 优先 —— 派生 + 签名一次到位
            // 老数据 cdnKey 缺失时降级到 maybeSign(cdnUrl) 路径，过渡期兼容读
            String cdnUrlWire = deriveSignedUrl(signer, o.getCdnKey(), o.getCdnUrl());
            String cdnThumbWire = deriveSignedUrl(signer, deriveThumbKey(o.getCdnKey()), o.getCdnThumbnailUrl());

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
                    o.getCreatedAt() == null ? null : o.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                    cdnUrlWire,
                    o.getCdnKey(),
                    cdnThumbWire,
                    o.getCdnUploadedAt() == null ? null : o.getCdnUploadedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                    o.getPublishCount(),
                    o.getLastPublishedAt() == null ? null : o.getLastPublishedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
            );
        }

        /**
         * v0.47F+ 派生策略：
         *   1. cdnKey 非空 → signer.signKey(cdnKey) → 派生 + 签
         *   2. cdnKey 缺失但 storedCdnUrl 在 → signer.maybeSign(storedCdnUrl) 兼容老数据
         *   3. 都为空 → null
         *
         * 任一步失败 (signer 异常 / NOOP / driver=local 等) signKey 返回 null → 自动走步骤 2。
         */
        private static String deriveSignedUrl(CdnUrlSigner signer, String cdnKey, String storedCdnUrl) {
            if (cdnKey != null && !cdnKey.isBlank()) {
                String fromKey = signer.signKey(cdnKey);
                if (fromKey != null && !fromKey.isBlank()) return fromKey;
                // signer 是 NOOP / 没有 uploader 时，退化到拿 storedCdnUrl
            }
            return signer.maybeSign(storedCdnUrl);
        }

        /**
         * v0.47F+：缩略图 key 命名约定 —— 视频 key 末尾追加 ".thumb.jpg"。
         * 注：当前 {@link com.aistareco.aep.service.mixcut.MixcutRenderingService} 落库时
         * cdnThumbnailUrl 是独立上传得到的 URL，本期暂不强约束缩略图 key 形式 —— null 时
         * 自然 fallback 到 storedCdnUrl 路径。等后续把缩略图也按规则命名 key 入库后再启用此推导。
         */
        private static String deriveThumbKey(String videoCdnKey) {
            // 暂留扩展点；返回 null 强制走 maybeSign(storedCdnThumbnailUrl) 路径
            return null;
        }
    }
}
