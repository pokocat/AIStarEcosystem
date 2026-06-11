package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarIpAsset;
import com.fasterxml.jackson.annotation.JsonInclude;

/** IP 资产 DTO（= TS StarIpAsset）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarIpAssetDto(
        String id,
        StarIpAsset.AssetType type,
        StarIpAsset.AssetStatus status,
        String techCompany,
        String volcanoProjectId,
        int filesCount,
        int requiredFiles,
        String uploadedAt,
        String activatedAt,
        String note
) {
    public static StarIpAssetDto from(StarIpAsset a) {
        return new StarIpAssetDto(
                a.getId(),
                a.getType(),
                a.getStatus(),
                a.getTechCompany(),
                a.getVolcanoProjectId(),
                a.getFilesCount(),
                a.getRequiredFiles(),
                a.getUploadedAt() != null ? a.getUploadedAt().toString() : null,
                a.getActivatedAt() != null ? a.getActivatedAt().toString() : null,
                a.getNote()
        );
    }
}
