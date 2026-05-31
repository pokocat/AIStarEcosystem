package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.dto.AiAvatarLicenseGrantDto;
import com.aistareco.aep.aiavatar.dto.AiAvatarRequests;
import com.aistareco.aep.aiavatar.model.AiAvatarLicenseGrant;
import com.aistareco.aep.aiavatar.model.AiAvatarLicenseStatus;
import com.aistareco.aep.aiavatar.repository.AiAvatarLicenseGrantRepository;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 真人肖像授权服务（任务书 §3 LicenseGrant / §7 真人授权管理）。
 * 定稿 / 衍生前校验：真人路径必须有 ACTIVE 且未过期的授权。
 */
@Service
public class AiAvatarLicenseService {

    private final AiAvatarLicenseGrantRepository licenseRepo;

    public AiAvatarLicenseService(AiAvatarLicenseGrantRepository licenseRepo) {
        this.licenseRepo = licenseRepo;
    }

    public AiAvatarLicenseGrant sign(String userId, String avatarId, AiAvatarRequests.SignLicense in) {
        if (in.signatureName() == null || in.signatureName().isBlank()) {
            throw BusinessException.badRequest("AIAVATAR_LICENSE_SIGNATURE_REQUIRED", "签署人必填");
        }
        OffsetDateTime from = parse(in.validFrom(), OffsetDateTime.now());
        OffsetDateTime to = parse(in.validTo(), OffsetDateTime.now().plusYears(1));
        AiAvatarLicenseGrant g = AiAvatarLicenseGrant.builder()
                .id(UUID.randomUUID().toString())
                .avatarId(avatarId)
                .ownerUserId(userId)
                .subjectName(in.subjectName())
                .scope(in.scope())
                .platforms(in.platforms() == null ? List.of() : in.platforms())
                .validFrom(from)
                .validTo(to)
                .status(AiAvatarLicenseStatus.ACTIVE)
                .agreementText(in.agreementText())
                .signatureName(in.signatureName())
                .signedAt(OffsetDateTime.now())
                .boundAssetIds(in.boundAssetIds() == null ? List.of() : in.boundAssetIds())
                .createdAt(OffsetDateTime.now())
                .build();
        // 凭证下载 URL（简化：指向授权详情打印路由；真实可生成 PDF）
        g.setCredentialUrl("/api/me/aiavatar/licenses/" + g.getId() + "/credential");
        return licenseRepo.save(g);
    }

    public List<AiAvatarLicenseGrantDto> listForAvatar(String avatarId) {
        return licenseRepo.findByAvatarIdOrderByCreatedAtDesc(avatarId)
                .stream().map(AiAvatarLicenseGrantDto::from).toList();
    }

    public List<AiAvatarLicenseGrantDto> listForUser(String userId) {
        return licenseRepo.findByOwnerUserIdOrderByCreatedAtDesc(userId)
                .stream().map(AiAvatarLicenseGrantDto::from).toList();
    }

    public AiAvatarLicenseGrant requireOwned(String id, String userId) {
        return licenseRepo.findByIdAndOwnerUserId(id, userId)
                .orElseThrow(() -> BusinessException.notFound("AIAVATAR_LICENSE_NOT_FOUND", "授权不存在"));
    }

    public AiAvatarLicenseGrant revoke(String id, String userId) {
        AiAvatarLicenseGrant g = requireOwned(id, userId);
        g.setStatus(AiAvatarLicenseStatus.REVOKED);
        return licenseRepo.save(g);
    }

    /** 校验某 avatar 是否持有有效授权（真人路径定稿 / 衍生前置）。 */
    public boolean hasActiveLicense(String avatarId) {
        OffsetDateTime now = OffsetDateTime.now();
        return licenseRepo.findByAvatarIdOrderByCreatedAtDesc(avatarId).stream()
                .anyMatch(g -> g.getStatus() == AiAvatarLicenseStatus.ACTIVE
                        && (g.getValidTo() == null || g.getValidTo().isAfter(now)));
    }

    private OffsetDateTime parse(String iso, OffsetDateTime def) {
        if (iso == null || iso.isBlank()) return def;
        try {
            return OffsetDateTime.parse(iso);
        } catch (Exception e) {
            try {
                return java.time.LocalDate.parse(iso).atStartOfDay().atOffset(java.time.ZoneOffset.UTC);
            } catch (Exception e2) {
                return def;
            }
        }
    }
}
