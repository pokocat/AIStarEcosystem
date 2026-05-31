package com.aistareco.aep.aiavatar.dto;

import com.aistareco.aep.aiavatar.model.AiAvatarLicenseGrant;
import com.aistareco.aep.aiavatar.model.AiAvatarLicenseStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * 前端镜像：packages/types/src/ai-avatar.ts {@code AiAvatarLicenseGrant}（真人授权管理）。
 * agreementText 不下发明文（合规），只回 hasAgreement 标记 + 凭证 URL。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAvatarLicenseGrantDto(
        String id,
        String avatarId,
        String subjectName,
        String scope,
        List<String> platforms,
        String validFrom,
        String validTo,
        AiAvatarLicenseStatus status,
        String statusLabel,
        boolean hasAgreement,
        String signatureName,
        String signedAt,
        List<String> boundAssetIds,
        String credentialUrl,
        String createdAt
) {
    public static AiAvatarLicenseGrantDto from(AiAvatarLicenseGrant g) {
        return new AiAvatarLicenseGrantDto(
                g.getId(),
                g.getAvatarId(),
                g.getSubjectName(),
                g.getScope(),
                g.getPlatforms() == null ? List.of() : g.getPlatforms(),
                AiAvatarJson.fmt(g.getValidFrom()),
                AiAvatarJson.fmt(g.getValidTo()),
                g.getStatus(),
                g.getStatus() == null ? null : g.getStatus().label(),
                g.getAgreementText() != null && !g.getAgreementText().isBlank(),
                g.getSignatureName(),
                AiAvatarJson.fmt(g.getSignedAt()),
                g.getBoundAssetIds() == null ? List.of() : g.getBoundAssetIds(),
                g.getCredentialUrl(),
                AiAvatarJson.fmt(g.getCreatedAt())
        );
    }
}
