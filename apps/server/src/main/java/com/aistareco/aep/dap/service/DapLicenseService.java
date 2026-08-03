package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapDtos.LicenseDto;
import com.aistareco.aep.dap.dto.DapRequests.CreateLicenseRequest;
import com.aistareco.aep.dap.model.DapConsent;
import com.aistareco.aep.dap.model.DapLicense;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapLicenseRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 真人肖像电子授权：登记 / 续签 / 凭证下载（HTML 凭证，存档于统一文件门面）。 */
@Service
public class DapLicenseService {

    private static final int CERTIFICATE_VERSION = 2;

    private final DapLicenseRepository licenseRepo;
    private final FileStorageService storage;
    private final DapSupport support;

    public DapLicenseService(DapLicenseRepository licenseRepo, FileStorageService storage, DapSupport support) {
        this.licenseRepo = licenseRepo;
        this.storage = storage;
        this.support = support;
    }

    public List<Map<String, Object>> list(String userId, String status) {
        refreshExpiry(userId);
        return licenseRepo.findByOwnerUserIdOrderByCreatedAtDesc(userId).stream()
                .map(LicenseDto::from)
                .filter(l -> status == null || status.isBlank() || status.equals(l.status()))
                .map(LicenseDto::toWire)
                .toList();
    }

    public Map<String, Object> get(String userId, String id) {
        return LicenseDto.from(required(userId, id)).toWire();
    }

    public DapLicense required(String userId, String id) {
        return licenseRepo.findByIdAndOwnerUserId(id, userId)
                .orElseThrow(() -> BusinessException.notFound("DAP_LICENSE_NOT_FOUND", "授权不存在或无权访问"));
    }

    @Transactional
    public Map<String, Object> create(String userId, CreateLicenseRequest req) {
        if (req.subject() == null || req.subject().isBlank()) {
            throw BusinessException.badRequest("DAP_LICENSE_SUBJECT_REQUIRED", "缺少肖像权人");
        }
        if (req.avatarId() != null && !req.avatarId().isBlank()) {
            throw BusinessException.badRequest("DAP_REAL_AUTH_REQUIRED",
                    "真人形象不能通过声明式接口直接授权，请完成当前协议确认与本人刷脸核验");
        }
        int years = req.years() == null || req.years() <= 0 ? 2 : Math.min(50, req.years());
        DapLicense l = DapLicense.builder()
                .id(uniqueId())
                .ownerUserId(userId)
                .subject(req.subject().trim())
                .avatarId(req.avatarId())
                .scope(req.scope() == null || req.scope().isBlank() ? "本人授权 · 全平台" : req.scope())
                .periodStart(Instant.now())
                .periodEnd(Instant.now().plus(365L * years, ChronoUnit.DAYS))
                .platforms(req.platforms() == null || req.platforms().isEmpty() ? List.of("全平台") : req.platforms())
                .status("active")
                .signedAt(Instant.now())
                .photoCount(0)
                .createdAt(Instant.now())
                .build();
        licenseRepo.save(l);
        return LicenseDto.from(l).toWire();
    }

    /**
     * 真人刷脸核验通过后登记授权：业务协议确认与七牛技术核验必须同时入证据链。
     */
    @Transactional
    public DapLicense autoCreateForCapture(String userId, String avatarId, String subjectName, int photoCount,
                                           DapConsent consent, DapMaterialGroup group, Instant verifiedAt) {
        if (consent == null || group == null || !"active".equals(group.getStatus())) {
            throw BusinessException.badRequest("DAP_AUTH_EVIDENCE_REQUIRED", "真人授权证据不完整，请重新完成本人确认");
        }
        Instant verified = verifiedAt == null ? Instant.now() : verifiedAt;
        DapLicense l = licenseRepo.findFirstByAvatarIdAndOwnerUserId(avatarId, userId).orElse(null);
        if (l != null && consent.getId().equals(l.getConsentId()) && group.getId().equals(l.getLivenessGroupId())
                && hasCompleteLivenessEvidence(l)) {
            if (photoCount > l.getPhotoCount()) {
                l.setPhotoCount(photoCount);
                return licenseRepo.save(l);
            }
            return l;
        }
        if (l == null) {
            l = DapLicense.builder()
                    .id(uniqueId())
                    .ownerUserId(userId)
                    .subject(subjectName + "（本人）")
                    .avatarId(avatarId)
                    .createdAt(Instant.now())
                    .build();
        }
        l.setPhotoCount(Math.max(l.getPhotoCount(), photoCount));
        l.setScope(consent.getScope());
        l.setPeriodStart(consent.getAcceptedAt());
        l.setPeriodEnd(consent.getAcceptedAt().atZone(ZoneId.of("Asia/Shanghai"))
                .plusMonths(consent.getPeriodMonths()).toInstant());
        l.setPlatforms(consent.getPlatforms());
        l.setStatus("active");
        l.setSignedAt(consent.getAcceptedAt());
        l.setVerifyMethod("liveness");
        l.setLivenessGroupId(group.getId());
        l.setConsentId(consent.getId());
        l.setAgreementVersion(consent.getAgreementVersion());
        l.setAgreementHash(consent.getAgreementHash());
        l.setConsentedAt(consent.getAcceptedAt());
        l.setVerificationProvider("qiniu_modelink");
        l.setVerificationReference(group.getQgroupid());
        l.setVerifiedAt(verified);
        // 证据升级后旧凭证不得继续复用；下次下载按当前模板重新生成。
        l.setCertKey(null);
        l.setCertificateVersion(0);
        return licenseRepo.save(l);
    }

    /**
     * IP 容器授权登记（设计 §02：六类资产里只有真人肖像人物与 IP 需要 LIC；
     * 场景 / 产品 / 风格是轻资产只记来源）。
     */
    @Transactional
    public Map<String, Object> createForIp(String userId, String ipId, String subject, String scope,
                                           Integer years, List<String> platforms) {
        int y = years == null || years <= 0 ? 2 : Math.min(50, years);
        DapLicense l = DapLicense.builder()
                .id(uniqueId())
                .ownerUserId(userId)
                .subject(subject == null || subject.isBlank() ? "IP 品牌授权" : subject.trim())
                .ipId(ipId)
                .scope(scope == null || scope.isBlank() ? "品牌商用 / 全平台" : scope.trim())
                .periodStart(Instant.now())
                .periodEnd(Instant.now().plus(365L * y, ChronoUnit.DAYS))
                .platforms(platforms == null || platforms.isEmpty() ? List.of("全平台") : platforms)
                .status("active")
                .signedAt(Instant.now())
                .photoCount(0)
                .createdAt(Instant.now())
                .build();
        licenseRepo.save(l);
        return LicenseDto.from(l).toWire();
    }

    /** 授权状态（active | pending | expired）；不存在返回 null。到期即时判定，不依赖懒刷新。 */
    public String statusOf(String userId, String licenseId) {
        if (licenseId == null || licenseId.isBlank()) return null;
        return licenseRepo.findByIdAndOwnerUserId(licenseId, userId)
                .map(l -> {
                    if ("liveness".equals(l.getVerifyMethod()) && !hasCompleteLivenessEvidence(l)) {
                        return "pending";
                    }
                    return ("active".equals(l.getStatus()) && l.getPeriodEnd() != null
                            && l.getPeriodEnd().isBefore(Instant.now())) ? "expired" : l.getStatus();
                })
                .orElse(null);
    }

    @Transactional
    public Map<String, Object> renew(String userId, String id) {
        DapLicense l = required(userId, id);
        if ("liveness".equals(l.getVerifyMethod()) && !hasCompleteLivenessEvidence(l)) {
            throw BusinessException.badRequest("DAP_CONSENT_REQUIRED", "请先补充确认当前真人数字形象授权说明");
        }
        Instant base = l.getPeriodEnd() != null && l.getPeriodEnd().isAfter(Instant.now())
                ? l.getPeriodEnd() : Instant.now();
        if (l.getPeriodStart() == null) l.setPeriodStart(Instant.now());
        l.setPeriodEnd(base.plus(365, ChronoUnit.DAYS));
        l.setStatus("active");
        l.setSignedAt(Instant.now());
        licenseRepo.save(l);
        return LicenseDto.from(l).toWire();
    }

    /** 凭证下载：首次生成 HTML 凭证文件并缓存 key。 */
    @Transactional
    public Map<String, Object> certificate(String userId, String id) {
        DapLicense l = required(userId, id);
        if (l.getCertKey() == null || l.getCertificateVersion() < CERTIFICATE_VERSION) {
            byte[] html = renderCertificate(l).getBytes(StandardCharsets.UTF_8);
            FileStorageService.StoredFile stored = storage.store(html, "dap/cert", userId, "html", "text/html; charset=utf-8");
            l.setCertKey(stored.key());
            l.setCertificateVersion(CERTIFICATE_VERSION);
            licenseRepo.save(l);
        }
        return Map.of("certificateUrl", storage.signedUrl(l.getCertKey()));
    }

    /** 过期检查（懒触发）。 */
    private void refreshExpiry(String userId) {
        Instant now = Instant.now();
        List<DapLicense> dirty = new ArrayList<>();
        for (DapLicense l : licenseRepo.findByOwnerUserIdOrderByCreatedAtDesc(userId)) {
            if ("active".equals(l.getStatus()) && l.getPeriodEnd() != null && l.getPeriodEnd().isBefore(now)) {
                l.setStatus("expired");
                dirty.add(l);
            }
        }
        if (!dirty.isEmpty()) licenseRepo.saveAll(dirty);
    }

    private String renderCertificate(DapLicense l) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy 年 M 月 d 日").withZone(ZoneId.of("Asia/Shanghai"));
        String period = (l.getPeriodStart() != null && l.getPeriodEnd() != null)
                ? fmt.format(l.getPeriodStart()) + " 至 " + fmt.format(l.getPeriodEnd()) : "—";
        boolean liveness = "liveness".equals(l.getVerifyMethod());
        String evidence = liveness && l.getConsentId() != null
                ? "平台授权确认 + 七牛云 Modelink 本人刷脸核验"
                : "平台声明式登记";
        String evidenceRef = liveness
                ? "平台记录 " + esc(l.getConsentId()) + " · 七牛记录 " + esc(l.getVerificationReference())
                : "未接入第三方刷脸核验";
        return """
                <!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>真人数字形象授权确认凭证 %s</title>
                <style>
                  *{box-sizing:border-box}body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;
                    background:#F3F1EC;color:#222;margin:0;padding:24px 14px;}
                  .card{max-width:680px;margin:0 auto;background:#FFFEFA;border:1px solid #D9D4C8;
                    border-radius:14px;padding:34px 36px;box-shadow:0 12px 36px rgba(42,38,31,.07)}
                  .eyebrow{font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;color:#8C7761}
                  h1{font:600 26px/1.25 Georgia,"Songti SC",serif;margin:8px 0 5px}
                  .sub{color:#7C756B;font-size:13px;margin-bottom:26px}.section{margin-top:24px}
                  .section h2{font-size:12px;letter-spacing:.08em;color:#8C7761;margin:0 0 8px}
                  .row{display:grid;grid-template-columns:118px 1fr;border-bottom:1px solid #ECE8DF;padding:11px 0;font-size:14px;gap:12px}
                  .row b{color:#817A70;font-weight:500}.row span{overflow-wrap:anywhere}
                  .evidence{background:#F5F1E8;border:1px solid #DED6C6;border-radius:10px;padding:15px 16px;line-height:1.65;font-size:13px}
                  .seal{margin-top:28px;display:inline-block;border:1.5px solid #74533A;color:#74533A;
                    border-radius:6px;padding:7px 13px;font-weight:650;letter-spacing:.04em}
                  .foot{margin-top:28px;color:#8C857B;font-size:12px;line-height:1.7}
                  @media(max-width:520px){.card{padding:27px 20px}.row{grid-template-columns:1fr;gap:4px}h1{font-size:23px}}
                </style></head><body><div class="card">
                <div class="eyebrow">ATELIER LEDGER · CERTIFICATE V%d</div>
                <h1>真人数字形象授权确认凭证</h1><div class="sub">数字资产平台 · %s</div>
                <div class="section"><h2>授权信息</h2>
                <div class="row"><b>凭证编号</b><span>%s</span></div>
                <div class="row"><b>肖像权人</b><span>%s</span></div>
                <div class="row"><b>关联资产</b><span>%s</span></div>
                <div class="row"><b>授权范围</b><span>%s</span></div>
                <div class="row"><b>授权期限</b><span>%s</span></div>
                <div class="row"><b>使用平台</b><span>%s</span></div>
                <div class="row"><b>确认时间</b><span>%s</span></div></div>
                <div class="section"><h2>证据记录</h2><div class="evidence"><strong>%s</strong><br>%s<br>
                协议版本：%s<br>协议摘要：%s<br>核验完成：%s<br>绑定素材：%d 份</div></div>
                <span class="seal">%s</span>
                <div class="foot">本凭证记录平台业务授权确认与第三方技术核验结果。刷脸核验用于活体与同人一致性确认，
                不等同于居民身份证实名认证、公证或对任意第三方的概括授权。如需撤回授权或删除素材，请联系平台客服处理。</div>
                </div></body></html>
                """.formatted(
                l.getId(), CERTIFICATE_VERSION, l.getId(), l.getId(),
                esc(l.getSubject()),
                l.getAvatarId() != null ? l.getAvatarId() : (l.getIpId() != null ? l.getIpId() : "—"),
                esc(l.getScope()),
                period,
                l.getPlatforms() == null || l.getPlatforms().isEmpty() ? "全平台" : esc(String.join(" · ", l.getPlatforms())),
                l.getConsentedAt() != null ? fmt.format(l.getConsentedAt()) : (l.getSignedAt() != null ? fmt.format(l.getSignedAt()) : "—"),
                evidence, evidenceRef,
                esc(l.getAgreementVersion()), esc(l.getAgreementHash()),
                l.getVerifiedAt() != null ? fmt.format(l.getVerifiedAt()) : "—", l.getPhotoCount(),
                "active".equals(statusOf(l.getOwnerUserId(), l.getId())) ? "授权证据完整 · 生效中" : "当前不生效");
    }

    private static String esc(String s) {
        return s == null ? "—" : s.replace("&", "&amp;").replace("\"", "&quot;")
                .replace("<", "&lt;").replace(">", "&gt;");
    }

    private static boolean hasCompleteLivenessEvidence(DapLicense l) {
        return l.getConsentId() != null && !l.getConsentId().isBlank()
                && l.getAgreementVersion() != null && !l.getAgreementVersion().isBlank()
                && l.getAgreementHash() != null && !l.getAgreementHash().isBlank()
                && l.getVerificationReference() != null && !l.getVerificationReference().isBlank()
                && l.getVerifiedAt() != null;
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = support.newId("LIC");
            if (!licenseRepo.existsById(id)) return id;
        }
        return "LIC-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
