package com.aistareco.aep.aiavatar.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * 资产详情聚合（任务书 §7 资产详情：图集/3D/视频/版本时间线/授权信息 Tab）。
 * 由 service 组装 avatar + 版本时间线 + 资产 + 素材 + 授权 + 近期任务。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAvatarDetailDto(
        AiAvatarDto avatar,
        List<AiAvatarVersionDto> versions,
        List<AiAvatarAssetDto> assets,
        List<AiAvatarSourceMaterialDto> sourceMaterials,
        List<AiAvatarLicenseGrantDto> licenses,
        List<AiAvatarRefineEditDto> refineEdits,
        List<AiAvatarJobDto> recentJobs,
        List<String> allowedNextStatus
) {}
