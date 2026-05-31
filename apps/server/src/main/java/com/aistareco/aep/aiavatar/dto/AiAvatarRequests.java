package com.aistareco.aep.aiavatar.dto;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarCreationMode;
import com.aistareco.aep.aiavatar.model.AiAvatarRefineKind;
import com.aistareco.aep.aiavatar.model.AiAvatarTemplateCategory;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/** AiAvatar领域全部请求体 record 集中处（避免每个小 record 单独建文件）。 */
public final class AiAvatarRequests {

    private AiAvatarRequests() {}

    /** 新建AiAvatar（创建选择 / 素材授权填写）。 */
    public record CreateAvatar(
            AiAvatarCreationMode mode,
            String name,
            String persona,
            String styleCategory,
            List<String> tags
    ) {}

    /** 更新AiAvatar元信息。 */
    public record UpdateAvatar(
            String name,
            String persona,
            String styleCategory,
            List<String> tags
    ) {}

    /** 「另存为新AiAvatar」。 */
    public record ForkAvatar(String name) {}

    /** 上传文案 / 人设素材（照片走 multipart 上传接口）。 */
    public record AddSourceText(String text, String kind) {}

    /**
     * 通用异步生成任务入口（打样 / 草稿迭代 / 外观精调 / 模板出图 / 衍生）。
     * capability 决定走哪个 Provider；params 承载滑块 / 强度 / 标准构图 / 风格等自由字段。
     */
    public record SubmitJob(
            AiAvatarCapability capability,
            String prompt,
            String baseAssetId,
            String referenceAssetId,
            String maskAssetId,
            String templateId,
            Integer variants,
            JsonNode params,
            String note
    ) {}

    /**
     * 几何微调（真实形变在前端 canvas 完成）：客户端把形变后图片作为 asset 上传，
     * 这里记录 RefineEdit + 滑块参数，并生成新版本。
     */
    public record GeometryRefine(
            String afterAssetId,
            String beforeAssetId,
            JsonNode params,
            String note
    ) {}

    /** 记录一次本地（同步）精调，kind 决定语义。 */
    public record RecordRefine(
            AiAvatarRefineKind kind,
            String afterAssetId,
            String beforeAssetId,
            JsonNode params,
            String note
    ) {}

    /** 电子肖像授权签署。 */
    public record SignLicense(
            String subjectName,
            String scope,
            List<String> platforms,
            String validFrom,
            String validTo,
            String signatureName,
            List<String> boundAssetIds,
            String agreementText
    ) {}

    /** 定稿确认（锁定版本，置 finalized_2d，冻结草稿链路）。 */
    public record Finalize(
            String versionId,
            List<String> confirmedAssetIds,
            String note
    ) {}

    /** 衍生 3D / 视频。kinds 取 ["img23d"] / ["img2video"] / 两者。 */
    public record Derive(
            List<AiAvatarCapability> capabilities,
            String baseAssetId,
            Integer videoDurationSec,
            JsonNode params
    ) {}

    /** 模板新增 / 更新（admin）。 */
    public record TemplateUpsert(
            String name,
            AiAvatarTemplateCategory category,
            String description,
            String thumbnailUrl,
            JsonNode params,
            AiAvatarCapability capability,
            Boolean official,
            Boolean enabled
    ) {}

    /** 任务进度更新（worker / 内部）。 */
    public record UpdateJobProgress(Integer progress, String status) {}
}
