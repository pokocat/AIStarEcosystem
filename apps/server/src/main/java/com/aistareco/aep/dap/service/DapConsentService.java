package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapDtos.RealAuthAgreementDto;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapConsent;
import com.aistareco.aep.dap.repository.DapConsentRepository;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/** 平台业务授权协议的服务端真源与不可变确认快照。 */
@Service
public class DapConsentService {

    public static final String VERSION = "real-avatar-v1.0-2026-08-03";
    public static final String TITLE = "真人数字形象授权及个人信息处理告知";
    public static final String SCOPE = "本人真人形象素材用于数字分身创建、存储，以及本人主动发起的内容生成";
    public static final int PERIOD_MONTHS = 24;
    public static final List<String> PLATFORMS = List.of("数字资产平台", "经本人主动授权接入的应用");
    public static final List<String> PROCESSORS = List.of("七牛云 Modelink", "七牛云认证供应商");
    private static final String SUMMARY = "确认本人刷脸核验、真人素材处理与数字分身使用范围；刷脸核验不等同于证件实名或公证。";
    private static final List<String> SECTIONS = List.of(
            "使用目的：创建并管理本人的真人数字形象，仅用于本人主动发起的创作与接入。",
            "处理信息：录制视频、关键帧与刷脸结果将用于活体核验、同人一致性比对和素材审核。",
            "第三方处理：核验素材会提交至七牛云 Modelink 及其认证供应商，平台仅以七牛真人组 active 状态作为技术核验证据。",
            "授权范围：不自动授权任意第三方或任意用途；接入其他应用须由本人再次主动操作。",
            "授权期限：自确认之日起 24 个月；到期、撤回或删除后停止新增使用，已依法完成的处理另按协议约定执行。",
            "撤回方式：可在授权登记中查看凭证；如需撤回授权或删除素材，请联系平台客服处理。"
    );
    private static final String AGREEMENT_TEXT = String.join("\n\n", TITLE, SUMMARY,
            String.join("\n", SECTIONS), "授权范围：" + SCOPE,
            "使用平台：" + String.join("、", PLATFORMS),
            "处理方：" + String.join("、", PROCESSORS), "授权期限：" + PERIOD_MONTHS + " 个月");
    private static final String HASH = sha256(String.join("\n", VERSION, TITLE, SUMMARY, SCOPE,
            String.join("|", PLATFORMS), String.join("|", PROCESSORS), AGREEMENT_TEXT));

    private final DapConsentRepository repo;
    private final DapSupport support;

    public DapConsentService(DapConsentRepository repo, DapSupport support) {
        this.repo = repo;
        this.support = support;
    }

    public RealAuthAgreementDto agreement() {
        return new RealAuthAgreementDto(VERSION, TITLE, SUMMARY, SECTIONS, SCOPE, PERIOD_MONTHS,
                PLATFORMS, PROCESSORS, HASH);
    }

    @Transactional
    public DapConsent accept(String userId, DapCapture capture, String version, Boolean accepted,
                             String clientIp, String userAgent) {
        if (!Boolean.TRUE.equals(accepted)) {
            throw BusinessException.badRequest("DAP_CONSENT_REQUIRED", "请先阅读并同意真人数字形象授权说明");
        }
        if (!VERSION.equals(version)) {
            throw BusinessException.badRequest("DAP_CONSENT_VERSION_CHANGED", "授权说明已更新，请重新阅读并确认");
        }
        return repo.findFirstByCaptureIdAndOwnerUserIdAndAgreementVersionOrderByAcceptedAtDesc(
                        capture.getId(), userId, VERSION)
                .orElseGet(() -> repo.save(DapConsent.builder()
                        .id(uniqueId())
                        .ownerUserId(userId)
                        .avatarId(capture.getAvatarId())
                        .captureId(capture.getId())
                        .agreementVersion(VERSION)
                        .agreementTitle(TITLE)
                        .agreementHash(HASH)
                        .agreementText(AGREEMENT_TEXT)
                        .scope(SCOPE)
                        .periodMonths(PERIOD_MONTHS)
                        .platforms(PLATFORMS)
                        .processors(PROCESSORS)
                        .clientIp(clamp(clientIp, 64))
                        .clientUserAgent(clamp(userAgent, 512))
                        .acceptedAt(Instant.now())
                        .createdAt(Instant.now())
                        .build()));
    }

    public DapConsent required(String userId, String consentId) {
        if (consentId == null || consentId.isBlank()) {
            throw BusinessException.badRequest("DAP_CONSENT_REQUIRED", "请先确认真人数字形象授权说明");
        }
        return repo.findByIdAndOwnerUserId(consentId, userId)
                .orElseThrow(() -> BusinessException.badRequest("DAP_CONSENT_REQUIRED", "授权确认记录不存在，请重新确认"));
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = support.newId("CONS");
            if (!repo.existsById(id)) return id;
        }
        return "CONS-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("协议摘要生成失败", e);
        }
    }

    private static String clamp(String value, int max) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        return v.length() <= max ? v : v.substring(0, max);
    }
}
