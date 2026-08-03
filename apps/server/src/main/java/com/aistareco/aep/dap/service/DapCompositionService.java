package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapAssetDtos.ComposeOptionsDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.CompositionDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.CompositionOutputDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.CompositionSourceDto;
import com.aistareco.aep.dap.dto.DapAssetRequests.CreateCompositionRequest;
import com.aistareco.aep.dap.dto.DapDtos.JobDto;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapComposition;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.model.DapProduct;
import com.aistareco.aep.dap.model.DapScene;
import com.aistareco.aep.dap.model.DapStyle;
import com.aistareco.aep.dap.repository.DapCompositionOutputRepository;
import com.aistareco.aep.dap.repository.DapCompositionRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 跨资产合成：人物 × 场景 × 产品 → 成片。
 *
 * 出片前做**授权核对**（真人复刻人物必须有生效 LIC；归属 IP 的资产看 IP 授权），
 * 结论写进 {@code licenseNote} 快照；产物入库后回流登记为该 IP 的衍生物，
 * 并给每个用到的资产写一条 {@link com.aistareco.aep.dap.model.DapAssetUsage} 双向引用。
 */
@Service
public class DapCompositionService {

    public static final List<String> RATIOS = List.of("9:16", "1:1", "16:9");
    private static final int MIN_COUNT = 1;
    private static final int MAX_COUNT = 8;
    private static final int DEFAULT_COUNT = 4;

    private final DapCompositionRepository compRepo;
    private final DapCompositionOutputRepository outputRepo;
    private final DapAssetService assets;
    private final DapAvatarService avatarService;
    private final DapLicenseService licenseService;
    private final DapJobService jobService;
    private final DapPricingService pricing;
    private final DapMultimodalClient multimodal;
    private final FileStorageService storage;
    private final DapSupport support;

    public DapCompositionService(DapCompositionRepository compRepo,
                                 DapCompositionOutputRepository outputRepo,
                                 DapAssetService assets,
                                 DapAvatarService avatarService,
                                 DapLicenseService licenseService,
                                 DapJobService jobService,
                                 DapPricingService pricing,
                                 DapMultimodalClient multimodal,
                                 FileStorageService storage,
                                 DapSupport support) {
        this.compRepo = compRepo;
        this.outputRepo = outputRepo;
        this.assets = assets;
        this.avatarService = avatarService;
        this.licenseService = licenseService;
        this.jobService = jobService;
        this.pricing = pricing;
        this.multimodal = multimodal;
        this.storage = storage;
        this.support = support;
    }

    // ── 出片设置选项 ────────────────────────────────────────────

    public ComposeOptionsDto options(String userId) {
        return new ComposeOptionsDto(pricing.compose(), MIN_COUNT, MAX_COUNT, DEFAULT_COUNT,
                RATIOS, assets.listStyles(userId));
    }

    // ── 查询 ──────────────────────────────────────────────────

    public List<CompositionDto> list(String userId, String ipId) {
        List<DapComposition> rows = (ipId == null || ipId.isBlank())
                ? compRepo.findTop50ByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                : compRepo.findByOwnerUserIdAndIpIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId, ipId);
        return rows.stream().map(c -> toDto(userId, c)).toList();
    }

    public CompositionDto get(String userId, String id) {
        return toDto(userId, required(userId, id));
    }

    public DapComposition required(String userId, String id) {
        return compRepo.findByIdAndOwnerUserId(id, userId)
                .filter(c -> c.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("DAP_COMPOSITION_NOT_FOUND", "合成记录不存在或无权访问"));
    }

    public CompositionDto toDto(String userId, DapComposition c) {
        List<CompositionOutputDto> outputs = outputRepo.findByCompositionIdOrderByIdxAsc(c.getId()).stream()
                .map(o -> CompositionOutputDto.from(o, storage::signedUrl))
                .toList();
        return CompositionDto.from(c, support.relativeZh(c.getCreatedAt()), outputs, sourcesOf(userId, c));
    }

    private List<CompositionSourceDto> sourcesOf(String userId, DapComposition c) {
        List<CompositionSourceDto> out = new ArrayList<>();
        try {
            DapAvatar a = avatarService.required(userId, c.getAvatarId());
            out.add(new CompositionSourceDto("character", a.getId() + " · v" + a.getVersions(), a.getName(),
                    a.getImageKey() != null ? storage.signedUrl(a.getImageKey()) : null));
        } catch (BusinessException ignored) {
            // 源资产已被删除 —— 结果页不因此报错，只是少一行来源
        }
        try {
            DapScene s = assets.requiredScene(userId, c.getSceneId());
            out.add(new CompositionSourceDto("scene", s.getId(), s.getName(),
                    s.getImageKey() != null ? storage.signedUrl(s.getImageKey()) : null));
        } catch (BusinessException ignored) { /* 同上 */ }
        if (c.getProductId() != null) {
            try {
                DapProduct p = assets.requiredProduct(userId, c.getProductId());
                out.add(new CompositionSourceDto("product", p.getId(), p.getName(),
                        p.getImageKey() != null ? storage.signedUrl(p.getImageKey()) : null));
            } catch (BusinessException ignored) { /* 同上 */ }
        }
        if (c.getStyleId() != null) {
            try {
                DapStyle st = assets.requiredStyle(userId, c.getStyleId());
                out.add(new CompositionSourceDto("style", st.getId(), st.getName(),
                        st.getCoverKey() != null ? storage.signedUrl(st.getCoverKey()) : null));
            } catch (BusinessException ignored) { /* 同上 */ }
        }
        return out;
    }

    // ── 提交合成 ───────────────────────────────────────────────

    @Transactional
    public Map<String, Object> create(String userId, CreateCompositionRequest req) {
        if (req == null || req.avatarId() == null || req.avatarId().isBlank()) {
            throw BusinessException.badRequest("DAP_COMPOSE_CHARACTER_REQUIRED", "请选择要出镜的人物");
        }
        if (req.sceneId() == null || req.sceneId().isBlank()) {
            throw BusinessException.badRequest("DAP_COMPOSE_SCENE_REQUIRED", "请选择场景");
        }
        DapAvatar avatar = avatarService.required(userId, req.avatarId());
        if (avatar.getImageKey() == null) {
            throw BusinessException.badRequest("DAP_NO_IMAGE", "该人物还没有定妆形象，先完成创建再合成");
        }
        DapScene scene = assets.requiredScene(userId, req.sceneId());
        if (scene.getImageKey() == null) {
            throw BusinessException.badRequest("DAP_SCENE_NO_IMAGE", "该场景还没有图片，等生成完成后再合成");
        }
        DapProduct product = (req.productId() == null || req.productId().isBlank())
                ? null : assets.requiredProduct(userId, req.productId());
        DapStyle style = (req.styleId() == null || req.styleId().isBlank())
                ? null : assets.requiredStyle(userId, req.styleId());

        String ratio = RATIOS.contains(req.ratio()) ? req.ratio() : "9:16";
        int count = req.count() == null ? DEFAULT_COUNT : Math.max(MIN_COUNT, Math.min(MAX_COUNT, req.count()));
        String licenseNote = checkLicense(userId, avatar, scene, product);
        String ipId = firstNonNull(avatar.getIpId(), product == null ? null : product.getIpId(), scene.getIpId());

        Instant now = Instant.now();
        DapComposition c = DapComposition.builder()
                .id(uniqueId())
                .ownerUserId(userId)
                .avatarId(avatar.getId())
                .sceneId(scene.getId())
                .productId(product == null ? null : product.getId())
                .styleId(style == null ? null : style.getId())
                .ipId(ipId)
                .ratio(ratio)
                .count(count)
                .status("running")
                .licenseNote(licenseNote)
                .promptEn(DapAssetService.blankToNull(req.extraPrompt()))
                .createdAt(now)
                .build();
        compRepo.save(c);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("compositionId", c.getId());
        payload.put("avatarId", avatar.getId());
        payload.put("sceneId", scene.getId());
        if (product != null) payload.put("productId", product.getId());
        if (style != null) payload.put("styleId", style.getId());
        payload.put("ratio", ratio);
        payload.put("count", count);
        if (c.getPromptEn() != null) payload.put("extraPrompt", c.getPromptEn());

        long cost = pricing.compose() * count;
        DapJob job = jobService.submitAsset(userId, c.getId(), avatar.getName() + " × " + scene.getName(),
                DapJob.T_COMPOSE, "跨资产合成", engineName(), cost,
                "约 " + Math.max(1, count / 2) + " 分钟", payload);
        c.setJobId(job.getId());
        c.setCost(cost);
        compRepo.save(c);

        return Map.of("composition", toDto(userId, c), "job", JobDto.from(job, support::hm).toWire());
    }

    /**
     * 授权核对（出片前给用户看的那句话）。
     * 真人复刻人物必须有生效 LIC —— 缺失 / 过期直接拒绝出片（不建单、不扣费）；
     * AI 原创人物与轻资产（场景 / 产品 / 风格）无需授权，只在结论里说明来源。
     */
    private String checkLicense(String userId, DapAvatar avatar, DapScene scene, DapProduct product) {
        List<String> parts = new ArrayList<>();
        if ("real".equals(avatar.getPath())) {
            String status = licenseService.statusOf(userId, avatar.getLicenseId());
            if (!"active".equals(status)) {
                throw new BusinessException(org.springframework.http.HttpStatus.FORBIDDEN,
                        "DAP_LICENSE_REQUIRED",
                        "「" + avatar.getName() + "」是真人复刻形象，需要生效中的肖像授权才能出片。"
                                + (status == null ? "该形象尚未登记授权。" : "当前授权状态：" + zhStatus(status) + "。"));
            }
            parts.add("人物 " + avatar.getLicenseId() + " 有效");
        } else {
            parts.add("人物为 AI 原创，无需肖像授权");
        }
        parts.add("shot".equals(scene.getSource()) ? "场景为自有实拍" : "场景为 AI 生成");
        if (product != null) {
            parts.add(product.isBrandAuthorized()
                    ? ("产品已获品牌方授权"
                       + (product.getBrandLicenseUntil() == null ? "" : "（至 " + product.getBrandLicenseUntil() + "）"))
                    : "产品未登记品牌方授权，请确认商用范围");
        }
        boolean commercial = !"real".equals(avatar.getPath()) || avatar.getLicenseId() != null;
        return "已核对授权：" + String.join("，", parts) + (commercial ? "，可商用。" : "。");
    }

    private static String zhStatus(String s) {
        return switch (s == null ? "" : s) {
            case "active" -> "生效中";
            case "pending" -> "待补确认";
            case "expired" -> "已过期";
            default -> s;
        };
    }

    private String engineName() {
        return multimodal.isConfigured() ? "云端图像引擎" : "占位引擎";
    }

    private static String firstNonNull(String... vs) {
        for (String v : vs) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = support.newId("CP");
            if (!compRepo.existsById(id)) return id;
        }
        return "CP-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
