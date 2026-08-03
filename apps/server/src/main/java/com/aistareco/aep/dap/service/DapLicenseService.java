package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapDtos.LicenseDto;
import com.aistareco.aep.dap.dto.DapRequests.CreateLicenseRequest;
import com.aistareco.aep.dap.model.DapLicense;
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
                .filter(l -> status == null || status.isBlank() || status.equals(l.getStatus()))
                .map(l -> LicenseDto.from(l).toWire())
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

    /** 真人捕获核验通过后自动登记授权（未标注取得方式 → declared）。 */
    @Transactional
    public DapLicense autoCreateForCapture(String userId, String avatarId, String subjectName, int photoCount) {
        return autoCreateForCapture(userId, avatarId, subjectName, photoCount, null, null);
    }

    /**
     * 真人捕获核验通过后自动登记授权（v0.105 起带取得方式）。
     *
     * @param verifyMethod    liveness（通过刷脸认证取得）| declared（声明式登记）；null = declared
     * @param livenessGroupId 取得该授权的刷脸认证分组 id（verifyMethod=liveness 时）
     */
    @Transactional
    public DapLicense autoCreateForCapture(String userId, String avatarId, String subjectName, int photoCount,
                                           String verifyMethod, String livenessGroupId) {
        String method = verifyMethod == null || verifyMethod.isBlank() ? "declared" : verifyMethod;
        DapLicense existing = licenseRepo.findFirstByAvatarIdAndOwnerUserId(avatarId, userId).orElse(null);
        if (existing != null) {
            existing.setPhotoCount(Math.max(existing.getPhotoCount(), photoCount));
            existing.setStatus("active");
            // 已存在的授权也回填取得方式：一旦通过刷脸认证，凭证从声明式升级为可取证
            if ("liveness".equals(method)) {
                existing.setVerifyMethod("liveness");
                if (livenessGroupId != null) existing.setLivenessGroupId(livenessGroupId);
            } else if (existing.getVerifyMethod() == null) {
                existing.setVerifyMethod("declared");
            }
            licenseRepo.save(existing);
            return existing;
        }
        DapLicense l = DapLicense.builder()
                .id(uniqueId())
                .ownerUserId(userId)
                .subject(subjectName + "（本人）")
                .avatarId(avatarId)
                .scope("本人授权 · 数字分身生成与使用")
                .periodStart(Instant.now())
                .periodEnd(Instant.now().plus(730, ChronoUnit.DAYS))
                .platforms(List.of("全平台"))
                .status("active")
                .signedAt(Instant.now())
                .photoCount(photoCount)
                .verifyMethod(method)
                .livenessGroupId(livenessGroupId)
                .createdAt(Instant.now())
                .build();
        licenseRepo.save(l);
        return l;
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
                .map(l -> ("active".equals(l.getStatus()) && l.getPeriodEnd() != null
                        && l.getPeriodEnd().isBefore(Instant.now())) ? "expired" : l.getStatus())
                .orElse(null);
    }

    @Transactional
    public Map<String, Object> renew(String userId, String id) {
        DapLicense l = required(userId, id);
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
        if (l.getCertKey() == null) {
            byte[] html = renderCertificate(l).getBytes(StandardCharsets.UTF_8);
            FileStorageService.StoredFile stored = storage.store(html, "dap/cert", userId, "html", "text/html; charset=utf-8");
            l.setCertKey(stored.key());
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
        return """
                <!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
                <title>电子肖像授权凭证 %s</title>
                <style>
                  body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:#F4F6F8;margin:0;padding:40px;}
                  .card{max-width:640px;margin:0 auto;background:#fff;border:1px solid #E3E8EE;border-radius:16px;padding:40px 44px;}
                  h1{font-size:22px;margin:0 0 4px;} .sub{color:#7A8699;font-size:13px;margin-bottom:28px;}
                  .row{display:flex;border-bottom:1px solid #EEF1F5;padding:12px 0;font-size:14px;}
                  .row b{flex:0 0 110px;color:#7A8699;font-weight:600;}
                  .seal{margin-top:30px;display:inline-block;border:2px solid #D6453C;color:#D6453C;
                        border-radius:8px;padding:6px 14px;font-weight:700;transform:rotate(-6deg);}
                  .foot{margin-top:34px;color:#9AA4B2;font-size:12px;line-height:1.6;}
                </style></head><body><div class="card">
                <h1>电子肖像授权凭证</h1><div class="sub">数字人资产平台 · %s</div>
                <div class="row"><b>凭证编号</b><span>%s</span></div>
                <div class="row"><b>肖像权人</b><span>%s</span></div>
                <div class="row"><b>关联资产</b><span>%s</span></div>
                <div class="row"><b>授权范围</b><span>%s</span></div>
                <div class="row"><b>授权期限</b><span>%s</span></div>
                <div class="row"><b>使用平台</b><span>%s</span></div>
                <div class="row"><b>绑定素材</b><span>%d 份（加密存档）</span></div>
                <div class="row"><b>签署时间</b><span>%s</span></div>
                <span class="seal">已签署 · 生效中</span>
                <div class="foot">本凭证由数字人资产平台依据《数字人肖像合规规范》生成。原始授权素材已加密存档，
                与本凭证绑定；如需撤回授权或删除素材，请在 App「设置 → 隐私与数据」中发起申请。</div>
                </div></body></html>
                """.formatted(
                l.getId(), l.getId(), l.getId(),
                esc(l.getSubject()),
                l.getAvatarId() != null ? l.getAvatarId() : (l.getIpId() != null ? l.getIpId() : "—"),
                esc(l.getScope()),
                period,
                l.getPlatforms() == null || l.getPlatforms().isEmpty() ? "全平台" : String.join(" · ", l.getPlatforms()),
                l.getPhotoCount(),
                l.getSignedAt() != null ? fmt.format(l.getSignedAt()) : "—");
    }

    private static String esc(String s) {
        return s == null ? "—" : s.replace("<", "&lt;").replace(">", "&gt;");
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = support.newId("LIC");
            if (!licenseRepo.existsById(id)) return id;
        }
        return "LIC-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
