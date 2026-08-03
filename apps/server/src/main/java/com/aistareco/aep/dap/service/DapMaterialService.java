package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapDtos.MaterialDto;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapMaterial;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapMaterialRepository;
import com.aistareco.aep.dap.service.modelink.ModelinkGateway.AssetState;
import com.aistareco.aep.dap.service.modelink.ModelinkService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 素材送审（v0.105）—— 把本地资产推给七牛 modelink 做合规审核，并把审核结论回落到本地。
 *
 * <p>两条来源：
 * <ul>
 *   <li><b>真人捕获素材</b>（refType=capture）：{@code captures/{id}/verify} 通过后由
 *       {@link DapCaptureService} best-effort 调用 —— 必须挂在**已 active 的 liveness 分组**下；</li>
 *   <li><b>数字人定妆图</b>（refType=avatar）：用户主动送审，走平台 aigc 默认组
 *       （createAsset 不传 group_id）—— 本地不建 aigc 分组行，避免维护一份会异步 pending 的空壳。</li>
 * </ul>
 *
 * <p>幂等：同一 ref + 同一 sourceKey 已有非 failed 行 → 跳过；failed 后允许重交（建新行）。
 * §4.7.4：DB 真值是 {@code sourceKey}，送审时才由 signedUrl 派生一次可拉取 URL，不落库 URL。
 */
@Service
public class DapMaterialService {

    private static final Logger log = LoggerFactory.getLogger(DapMaterialService.class);

    /** 本地非终态（轮询器需要继续收敛的状态）。 */
    public static final List<String> PENDING_STATUSES = List.of("pending", "reviewing");

    private final DapMaterialRepository materialRepo;
    private final DapAvatarRepository avatarRepo;
    private final DapCaptureRepository captureRepo;
    private final DapRealAuthService realAuth;
    private final ModelinkService modelink;
    private final FileStorageService storage;
    private final DapSupport support;

    public DapMaterialService(DapMaterialRepository materialRepo,
                              DapAvatarRepository avatarRepo,
                              DapCaptureRepository captureRepo,
                              DapRealAuthService realAuth,
                              ModelinkService modelink,
                              FileStorageService storage,
                              DapSupport support) {
        this.materialRepo = materialRepo;
        this.avatarRepo = avatarRepo;
        this.captureRepo = captureRepo;
        this.realAuth = realAuth;
        this.modelink = modelink;
        this.storage = storage;
        this.support = support;
    }

    // ── 查询 ───────────────────────────────────────────────────

    public List<MaterialDto> listByRef(String userId, String refType, String refId) {
        if (refType == null || refType.isBlank() || refId == null || refId.isBlank()) {
            throw BusinessException.badRequest("DAP_MATERIAL_REF_REQUIRED", "缺少查询条件（refType + refId）");
        }
        return materialRepo.findByRefTypeAndRefIdAndOwnerUserIdOrderByCreatedAtDesc(refType, refId, userId)
                .stream().map(MaterialDto::from).toList();
    }

    /** 该数字人定妆图最新一条送审记录（详情页 moderation 用；无则 null）。 */
    public DapMaterial latestForAvatar(String userId, String avatarId) {
        List<DapMaterial> rows = materialRepo
                .findByRefTypeAndRefIdAndOwnerUserIdOrderByCreatedAtDesc("avatar", avatarId, userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    // ── 送审 ───────────────────────────────────────────────────

    /**
     * 真人捕获素材送审（动作素材 + 关键帧）。挂在该次捕获已 active 的 liveness 分组下。
     * 由 verify 以 best-effort 方式调用：这里抛错不应阻断核验主链路（调用方负责 catch）。
     */
    @Transactional
    public List<MaterialDto> submitForCapture(String userId, DapCapture capture, DapMaterialGroup group) {
        List<MaterialDto> out = new ArrayList<>();
        Map<String, String> targets = new LinkedHashMap<>(); // sourceKey → 素材名后缀
        if (capture.getFootageKey() != null && !capture.getFootageKey().isBlank()) {
            targets.put(capture.getFootageKey(), "footage");
        }
        if (capture.getFrameKey() != null && !capture.getFrameKey().isBlank()
                && !capture.getFrameKey().equals(capture.getFootageKey())) {
            targets.put(capture.getFrameKey(), "frame");
        }
        for (Map.Entry<String, String> e : targets.entrySet()) {
            String key = e.getKey();
            boolean isFootage = "footage".equals(e.getValue());
            String type = isFootage ? typeOfContentType(capture.getFootageContentType(), key) : "image";
            DapMaterial existing = findReusable(userId, "capture", capture.getId(), key);
            if (existing != null) {
                out.add(MaterialDto.from(existing));
                continue;
            }
            out.add(MaterialDto.from(submit(userId, "capture", capture.getId(), type,
                    "capture-" + capture.getId() + "-" + e.getValue(), key,
                    group == null ? null : group.getId(),
                    group == null ? null : group.getQgroupid())));
        }
        return out;
    }

    /**
     * 手动重交某次捕获的素材（正常路径由 verify 自动送审；这里用于失败后重交）。
     * 仍要求该次捕获有 active 的刷脸认证分组 —— 真人素材必须挂在生效授权分组下。
     */
    @Transactional
    public List<MaterialDto> resubmitForCapture(String userId, String captureId) {
        DapCapture c = captureRepo.findByIdAndOwnerUserId(captureId, userId)
                .orElseThrow(() -> BusinessException.notFound("DAP_CAPTURE_NOT_FOUND", "捕获会话不存在或无权访问"));
        DapMaterialGroup g = realAuth.requireActiveSession(userId, c);
        return submitForCapture(userId, c, g);
    }

    /** 数字人定妆图送审（走平台 aigc 默认组）。已有非 failed 记录 → 幂等返回。 */
    @Transactional
    public MaterialDto submitAvatarModeration(String userId, String avatarId) {
        DapAvatar a = avatarRepo.findByIdAndOwnerUserId(avatarId, userId)
                .filter(x -> x.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("DAP_AVATAR_NOT_FOUND", "数字人不存在或无权访问"));
        if (a.getImageKey() == null || a.getImageKey().isBlank()) {
            throw BusinessException.badRequest("DAP_NO_IMAGE", "该数字人还没有定妆形象，先完成创建再送审");
        }
        DapMaterial existing = findReusable(userId, "avatar", avatarId, a.getImageKey());
        if (existing != null) return MaterialDto.from(existing);
        // aigc 素材不传 group_id → 平台按 (uid, aigc, model) 落默认组
        return MaterialDto.from(submit(userId, "avatar", avatarId, "image",
                "avatar-" + avatarId, a.getImageKey(), null, null));
    }

    private DapMaterial submit(String userId, String refType, String refId, String type,
                               String name, String sourceKey, String localGroupId, String qgroupid) {
        String url = storage.signedUrl(sourceKey);
        if (url == null || url.isBlank()) {
            throw BusinessException.badRequest("DAP_MATERIAL_NO_SOURCE", "素材文件不可访问，无法送审");
        }
        String model = modelink.boundModel();
        boolean mock = modelink.isMockMode();
        AssetState st = modelink.createAsset(type, clamp(name, 64), model, url, qgroupid);

        Instant now = Instant.now();
        DapMaterial m = DapMaterial.builder()
                .id(uniqueId())
                .ownerUserId(userId)
                .groupId(localGroupId)
                .qassetid(st.qassetid())
                .type(type)
                .name(clamp(name, 64))
                .model(model)
                .sourceKey(sourceKey)
                .status(mapStatus(st.status(), "pending"))
                .failReason(st.failReason())
                .refType(refType)
                .refId(refId)
                .mock(mock)
                .createdAt(now)
                .updatedAt(now)
                .build();
        materialRepo.save(m);
        log.info("[dap-material] submitted id={} ref={}:{} type={} qassetid={} mock={}",
                m.getId(), refType, refId, type, m.getQassetid(), mock);
        return m;
    }

    // ── 远端状态收敛 ───────────────────────────────────────────

    /** 向上游刷新一次素材审核状态并落库（终态直接返回）。 */
    @Transactional
    public void refresh(DapMaterial m) {
        if (m == null || isTerminal(m.getStatus()) || m.getQassetid() == null) return;
        AssetState st = modelink.getAsset(m.getQassetid());
        m.setStatus(mapStatus(st.status(), m.getStatus()));
        if (st.failReason() != null && !st.failReason().isBlank()) m.setFailReason(st.failReason());
        m.setUpdatedAt(Instant.now());
        materialRepo.save(m);
        if ("failed".equals(m.getStatus())) {
            log.warn("[dap-material] rejected id={} ref={}:{} reason={}",
                    m.getId(), m.getRefType(), m.getRefId(), m.getFailReason());
        }
    }

    // ── helpers ───────────────────────────────────────────────

    /** 同 ref + 同源文件的非 failed 记录（幂等复用；failed 允许重交）。 */
    private DapMaterial findReusable(String userId, String refType, String refId, String sourceKey) {
        return materialRepo.findByRefTypeAndRefIdAndOwnerUserIdOrderByCreatedAtDesc(refType, refId, userId)
                .stream()
                .filter(m -> sourceKey.equals(m.getSourceKey()) && !"failed".equals(m.getStatus()))
                .findFirst().orElse(null);
    }

    static String mapStatus(String remote, String fallback) {
        if (remote == null) return fallback;
        return switch (remote.toLowerCase(Locale.ROOT)) {
            case "pending" -> "pending";
            case "reviewing" -> "reviewing";
            case "approved" -> "approved";
            case "failed", "rejected" -> "failed";
            default -> fallback;
        };
    }

    static boolean isTerminal(String status) {
        return "approved".equals(status) || "failed".equals(status);
    }

    /** contentType 优先，缺失时按扩展名兜底；既不是图片也不是音频 → 视为视频。 */
    static String typeOfContentType(String contentType, String key) {
        String ct = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (ct.startsWith("image/")) return "image";
        if (ct.startsWith("audio/")) return "audio";
        if (ct.startsWith("video/")) return "video";
        String k = key == null ? "" : key.toLowerCase(Locale.ROOT);
        if (k.endsWith(".png") || k.endsWith(".jpg") || k.endsWith(".jpeg") || k.endsWith(".webp")) return "image";
        if (k.endsWith(".mp3") || k.endsWith(".wav") || k.endsWith(".m4a")) return "audio";
        return "video";
    }

    private static String clamp(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = support.newId("MAT");
            if (!materialRepo.existsById(id)) return id;
        }
        return "MAT-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
