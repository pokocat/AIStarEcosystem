package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapRequests.SupplementLicenseRequest;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapConsent;
import com.aistareco.aep.dap.model.DapLicense;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

/** 历史真人授权补协议：复用已有 active 技术核验证据，只补平台业务授权快照。 */
@Service
public class DapLicenseSupplementService {

    private final DapLicenseService licenses;
    private final DapMaterialGroupRepository groups;
    private final DapCaptureRepository captures;
    private final DapConsentService consents;

    public DapLicenseSupplementService(DapLicenseService licenses,
                                       DapMaterialGroupRepository groups,
                                       DapCaptureRepository captures,
                                       DapConsentService consents) {
        this.licenses = licenses;
        this.groups = groups;
        this.captures = captures;
        this.consents = consents;
    }

    @Transactional
    public Map<String, Object> supplement(String userId, String licenseId, SupplementLicenseRequest req,
                                          String clientIp, String userAgent) {
        DapLicense license = licenses.required(userId, licenseId);
        if (!"liveness".equals(license.getVerifyMethod()) || license.getAvatarId() == null) {
            throw BusinessException.badRequest("DAP_SUPPLEMENT_NOT_APPLICABLE", "该授权不需要补充真人协议确认");
        }
        DapMaterialGroup group = license.getLivenessGroupId() == null ? null
                : groups.findByIdAndOwnerUserId(license.getLivenessGroupId(), userId).orElse(null);
        if (group == null || !"active".equals(group.getStatus()) || group.getRecycledAt() != null
                || group.getQgroupid() == null || group.getQgroupid().isBlank()) {
            throw new BusinessException(HttpStatus.CONFLICT, "DAP_LIVENESS_REAUTH_REQUIRED",
                    "历史核验记录已不可用，请重新完成本人刷脸确认");
        }
        DapCapture capture = group.getCaptureId() == null ? null
                : captures.findByIdAndOwnerUserId(group.getCaptureId(), userId).orElse(null);
        if (capture == null) {
            throw new BusinessException(HttpStatus.CONFLICT, "DAP_LIVENESS_REAUTH_REQUIRED",
                    "历史核验缺少关联素材，请重新完成本人刷脸确认");
        }
        DapConsent consent = consents.accept(userId, capture,
                req == null ? null : req.agreementVersion(),
                req == null ? null : req.agreementAccepted(), clientIp, userAgent);
        group.setConsentId(consent.getId());
        group.setUpdatedAt(Instant.now());
        groups.save(group);
        licenses.autoCreateForCapture(userId, license.getAvatarId(), strip本人(license.getSubject()),
                Math.max(license.getPhotoCount(), 1), consent, group,
                license.getVerifiedAt() == null ? Instant.now() : license.getVerifiedAt());
        return licenses.get(userId, licenseId);
    }

    private static String strip本人(String subject) {
        if (subject == null || subject.isBlank()) return "本人";
        return subject.replace("（本人）", "").trim();
    }
}
