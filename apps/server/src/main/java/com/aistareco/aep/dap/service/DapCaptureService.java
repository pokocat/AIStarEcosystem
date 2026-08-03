package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapDtos.CaptureDto;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 真人捕获：录制 / 上传动作素材 → ffmpeg 抽关键帧（i2i 身份输入）→ 身份核验 → 自动登记授权。
 * 素材为图片时直接作为关键帧；为视频时用本机 ffmpeg 抽第 1 秒帧（无 ffmpeg 则跳过抽帧，
 * 后续生成自动退化为文生图并打 mock 提示）。
 */
@Service
public class DapCaptureService {

    private static final Logger log = LoggerFactory.getLogger(DapCaptureService.class);

    private final DapCaptureRepository captureRepo;
    private final DapMaterialGroupRepository groupRepo;
    private final DapAvatarService avatarService;
    private final DapLicenseService licenseService;
    private final DapRealAuthService realAuthService;
    private final DapConsentService consentService;
    private final DapMaterialService materialService;
    private final FileStorageService storage;
    private final DapSupport support;

    public DapCaptureService(DapCaptureRepository captureRepo,
                             DapMaterialGroupRepository groupRepo,
                             DapAvatarService avatarService,
                             DapLicenseService licenseService,
                             DapRealAuthService realAuthService,
                             DapConsentService consentService,
                             DapMaterialService materialService,
                             FileStorageService storage,
                             DapSupport support) {
        this.captureRepo = captureRepo;
        this.groupRepo = groupRepo;
        this.avatarService = avatarService;
        this.licenseService = licenseService;
        this.realAuthService = realAuthService;
        this.consentService = consentService;
        this.materialService = materialService;
        this.storage = storage;
        this.support = support;
    }

    @Transactional
    public CaptureDto create(String userId, String avatarId) {
        if (avatarId != null && !avatarId.isBlank()) {
            avatarService.required(userId, avatarId); // 归属校验
        }
        DapCapture c = DapCapture.builder()
                .id(uniqueId())
                .ownerUserId(userId)
                .avatarId(avatarId)
                .status("created")
                .createdAt(Instant.now())
                .build();
        captureRepo.save(c);
        return toDto(c);
    }

    @Transactional
    public CaptureDto uploadFootage(String userId, String captureId, MultipartFile file) {
        DapCapture c = required(userId, captureId);
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("DAP_NO_FILE", "未收到素材文件");
        }
        FileStorageService.StoredFile stored = storage.store(file, "dap/capture", userId);
        c.setFootageKey(stored.key());
        c.setFootageContentType(stored.contentType());
        c.setBytes(stored.bytes());
        c.setStatus("footage_uploaded");

        String ct = stored.contentType() == null ? "" : stored.contentType();
        if (ct.startsWith("image/")) {
            c.setFrameKey(stored.key()); // 图片素材直接作关键帧
        } else {
            extractFrame(userId, c);
        }
        captureRepo.save(c);
        return toDto(c);
    }

    /** 出 wire：附带真人授权会话状态（无会话 → authStatus="none"）。 */
    private CaptureDto toDto(DapCapture c) {
        String authStatus = c.getAuthGroupId() == null ? null
                : groupRepo.findById(c.getAuthGroupId()).map(DapMaterialGroup::getStatus).orElse(null);
        return CaptureDto.from(c, storage::signedUrl, authStatus);
    }

    /**
     * 身份核验（v0.105 起接真实刷脸认证）：必须先有 <b>active</b> 的真人授权会话
     * （{@code POST /api/v1/real-auth/sessions} → 刷脸 → 平台判定 active），否则 409
     * {@code DAP_AUTH_NOT_COMPLETED}。
     *
     * <p>此前这里是「素材存在即视为通过」的假核验（无条件 verified + 自动发授权），
     * 与 §8.0「生产禁止静默降级 / 不得伪造业务产物」冲突，本版替换。
     *
     * <p>核验通过后：标 verified → 登记 / 回填电子授权（verifyMethod=liveness）→
     * best-effort 把捕获素材送审（失败只 WARN，不阻断核验与授权）。
     */
    @Transactional
    public Map<String, Object> verify(String userId, String captureId) {
        DapCapture c = required(userId, captureId);
        if (c.getFootageKey() == null) {
            throw BusinessException.badRequest("DAP_NO_FOOTAGE", "请先录制或上传素材");
        }
        // 未配置 modelink 且不允许降级的场景，在 real-auth/sessions 阶段就已 503；此处只判会话结果
        DapMaterialGroup group = realAuthService.requireActiveSession(userId, c);
        var consent = consentService.required(userId, group.getConsentId());
        boolean firstVerification = !"verified".equals(c.getStatus());

        Instant verifiedAt = firstVerification || c.getVerifiedAt() == null ? Instant.now() : c.getVerifiedAt();
        c.setStatus("verified");
        c.setVerifiedAt(verifiedAt);
        captureRepo.save(c);

        // 自动登记授权（绑定资产时）
        String licenseId = null;
        if (c.getAvatarId() != null) {
            DapAvatar a = avatarService.required(userId, c.getAvatarId());
            var lic = licenseService.autoCreateForCapture(userId, a.getId(), a.getName(), 1,
                    consent, group, verifiedAt);
            a.setLicenseId(lic.getId());
            avatarService.save(a);
            licenseId = lic.getId();
        }

        // 素材送审：合规旁路，失败不回滚核验 / 授权（可在「素材送审」里手动重交）
        if (firstVerification) {
            try {
                materialService.submitForCapture(userId, c, group);
            } catch (RuntimeException e) {
                log.warn("[dap] 捕获素材送审失败 capture={}: {}", c.getId(), e.getMessage());
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("passed", true);
        out.put("captureId", c.getId());
        out.put("authSessionId", group.getId());
        if (licenseId != null) out.put("licenseId", licenseId);
        return out;
    }

    public DapCapture required(String userId, String captureId) {
        return captureRepo.findByIdAndOwnerUserId(captureId, userId)
                .orElseThrow(() -> BusinessException.notFound("DAP_CAPTURE_NOT_FOUND", "捕获会话不存在或无权访问"));
    }

    /** ffmpeg 抽帧（best-effort；失败不阻断）。 */
    private void extractFrame(String userId, DapCapture c) {
        try {
            Path src = storage.openForRead(c.getFootageKey());
            Path out = Files.createTempFile("dap-frame-", ".png");
            Process proc = new ProcessBuilder("ffmpeg", "-y", "-i", src.toString(),
                    "-ss", "00:00:01", "-frames:v", "1", out.toString())
                    .redirectErrorStream(true).start();
            boolean ok = proc.waitFor(60, TimeUnit.SECONDS) && proc.exitValue() == 0 && Files.size(out) > 0;
            if (ok) {
                FileStorageService.StoredFile frame = storage.storeExisting(out, "dap/capture", userId, "png", "image/png", true);
                c.setFrameKey(frame.key());
            } else {
                Files.deleteIfExists(out);
                log.warn("[dap] 抽帧失败（ffmpeg 退出异常）capture={}", c.getId());
            }
            // 时长探测（可选）
            try {
                Process probe = new ProcessBuilder("ffprobe", "-v", "error", "-show_entries",
                        "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", src.toString())
                        .redirectErrorStream(true).start();
                if (probe.waitFor(20, TimeUnit.SECONDS) && probe.exitValue() == 0) {
                    String outStr = new String(probe.getInputStream().readAllBytes()).trim();
                    c.setDurationSec(Double.parseDouble(outStr.lines().findFirst().orElse("0")));
                }
            } catch (Exception ignore) { /* 无 ffprobe 时跳过 */ }
        } catch (IOException | InterruptedException | RuntimeException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("[dap] 抽帧不可用 capture={}: {}", c.getId(), e.getMessage());
        }
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = support.newId("CAP");
            if (!captureRepo.existsById(id)) return id;
        }
        return "CAP-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
