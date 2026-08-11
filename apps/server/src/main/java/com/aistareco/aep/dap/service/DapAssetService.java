package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapAssetDtos.AssetSummaryDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.AssetTypeTileDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.AssetUsageDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.IpDetailDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.IpDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.IpMembersDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.ProductDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.RecentAssetDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.SceneDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.StyleDto;
import com.aistareco.aep.dap.dto.DapAssetRequests.CreateIpRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.CreateProductRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.CreateSceneRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.CreateStyleRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.IpLicenseRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.IpMemberRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.PatchIpRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.PatchProductRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.PatchSceneRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.PatchStyleRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.ProductAngleRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.SceneVariantRequest;
import com.aistareco.aep.dap.dto.DapDtos.JobDto;
import com.aistareco.aep.dap.model.DapAssetIp;
import com.aistareco.aep.dap.model.DapAssetUsage;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.model.DapProduct;
import com.aistareco.aep.dap.model.DapScene;
import com.aistareco.aep.dap.model.DapStyle;
import com.aistareco.aep.dap.model.DapVoice;
import com.aistareco.aep.dap.repository.DapAssetIpRepository;
import com.aistareco.aep.dap.repository.DapAssetUsageRepository;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapProductRepository;
import com.aistareco.aep.dap.repository.DapSceneRepository;
import com.aistareco.aep.dap.repository.DapStyleRepository;
import com.aistareco.aep.dap.repository.DapVoiceRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 数字资产平台 · 六类资产的登记 / 检索 / 容器关系 / 引用台账。
 *
 * 设计口径（真源 docs 设计稿「从数字人平台扩展为数字资产平台」）：
 *  · 六类共用一套登记语言，前缀区分：DH- 人物 / IP- 品牌 / SC- 场景 / PD- 产品 / VO- 声音 / ST- 风格；
 *  · 只有「真人肖像人物」与「IP」需要授权登记（LIC）；场景 / 产品 / 风格是轻资产只记来源；
 *  · IP 是容器：人物 / 场景 / 产品 / 声音挂在它下面，合成产物回流为它的衍生物并双向记引用。
 *
 * 文件一律经 {@link FileStorageService}（DB 存 key、出 wire 派生签名 URL，§4.7）。
 */
@Service
public class DapAssetService {

    /** 六类资产的登记前缀（与前端 ASSET_TYPES 字典同形同值）。 */
    public static final List<String[]> TYPE_DEFS = List.of(
            new String[]{"character", "人物", "DH-"},
            new String[]{"ip", "IP", "IP-"},
            new String[]{"scene", "场景", "SC-"},
            new String[]{"product", "产品", "PD-"},
            new String[]{"voice", "声音", "VO-"},
            new String[]{"style", "风格", "ST-"});

    private static final long UPLOAD_MAX_BYTES = 30L * 1024 * 1024;
    private static final List<String> DEFAULT_VARIANT_LABELS = List.of("午后", "夜晚");
    private static final List<String> DEFAULT_ANGLE_LABELS = List.of("45°", "背面", "细节");

    private final DapAssetIpRepository ipRepo;
    private final DapSceneRepository sceneRepo;
    private final DapProductRepository productRepo;
    private final DapStyleRepository styleRepo;
    private final DapAssetUsageRepository usageRepo;
    private final DapAvatarRepository avatarRepo;
    private final DapVoiceRepository voiceRepo;
    private final DapAvatarService avatarService;
    private final DapLicenseService licenseService;
    private final DapJobService jobService;
    private final DapPricingService pricing;
    private final DapMultimodalClient multimodal;
    private final FileStorageService storage;
    private final DapSupport support;

    public DapAssetService(DapAssetIpRepository ipRepo,
                           DapSceneRepository sceneRepo,
                           DapProductRepository productRepo,
                           DapStyleRepository styleRepo,
                           DapAssetUsageRepository usageRepo,
                           DapAvatarRepository avatarRepo,
                           DapVoiceRepository voiceRepo,
                           DapAvatarService avatarService,
                           DapLicenseService licenseService,
                           DapJobService jobService,
                           DapPricingService pricing,
                           DapMultimodalClient multimodal,
                           FileStorageService storage,
                           DapSupport support) {
        this.ipRepo = ipRepo;
        this.sceneRepo = sceneRepo;
        this.productRepo = productRepo;
        this.styleRepo = styleRepo;
        this.usageRepo = usageRepo;
        this.avatarRepo = avatarRepo;
        this.voiceRepo = voiceRepo;
        this.avatarService = avatarService;
        this.licenseService = licenseService;
        this.jobService = jobService;
        this.pricing = pricing;
        this.multimodal = multimodal;
        this.storage = storage;
        this.support = support;
    }

    private String engineName() {
        return multimodal.isConfigured() ? "云端图像引擎" : "占位引擎";
    }

    // ── 资产总览 ───────────────────────────────────────────────

    public AssetSummaryDto summary(String userId) {
        List<DapAvatar> avatars = avatarRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId);
        List<DapAssetIp> ips = ipRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId);
        List<DapScene> scenes = sceneRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId);
        List<DapProduct> products = productRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId);
        List<DapVoice> voices = voiceRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId);
        List<DapStyle> styles = styleRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUseCountDescUpdatedAtDesc(userId);

        List<AssetTypeTileDto> tiles = List.of(
                tile("character", avatars.size()),
                tile("ip", ips.size()),
                tile("scene", scenes.size()),
                tile("product", products.size()),
                tile("voice", voices.size()),
                tile("style", styles.size()));
        long total = tiles.stream().mapToLong(AssetTypeTileDto::count).sum();

        long bytes = avatars.stream().mapToLong(DapAvatar::getImageBytes).sum()
                + sceneRepo.sumBytesByOwner(userId)
                + productRepo.sumBytesByOwner(userId);

        // 最近更新：跨类型合流后按时间倒序取前 8（人物 / 场景 / 产品 —— 有图可看的三类）
        record Row(Instant at, RecentAssetDto dto) {}
        List<Row> rows = new ArrayList<>();
        avatars.forEach(a -> rows.add(new Row(a.getUpdatedAt(), new RecentAssetDto(
                "character", "人物", a.getId(), a.getName(), support.relativeZh(a.getUpdatedAt()),
                a.getImageKey() != null ? storage.signedUrl(a.getImageKey()) : null))));
        scenes.forEach(s -> rows.add(new Row(s.getUpdatedAt(), new RecentAssetDto(
                "scene", "场景", s.getId(), s.getName(), support.relativeZh(s.getUpdatedAt()),
                s.getImageKey() != null ? storage.signedUrl(s.getImageKey()) : null))));
        products.forEach(p -> rows.add(new Row(p.getUpdatedAt(), new RecentAssetDto(
                "product", "产品", p.getId(), p.getName(), support.relativeZh(p.getUpdatedAt()),
                p.getImageKey() != null ? storage.signedUrl(p.getImageKey()) : null))));
        List<RecentAssetDto> recent = rows.stream()
                .sorted(Comparator.comparing((Row r) -> r.at() == null ? Instant.EPOCH : r.at()).reversed())
                .limit(8)
                .map(Row::dto)
                .toList();

        return new AssetSummaryDto(total, bytes, sizeLabel(bytes), tiles, recent);
    }

    private static AssetTypeTileDto tile(String key, long count) {
        String[] def = TYPE_DEFS.stream().filter(d -> d[0].equals(key)).findFirst()
                .orElse(new String[]{key, key, ""});
        return new AssetTypeTileDto(def[0], def[1], def[2], count);
    }

    /** 人类可读体积：0 → "0 B"；&lt;1MB → KB；&lt;1GB → MB；否则 GB（一位小数）。 */
    static String sizeLabel(long bytes) {
        if (bytes <= 0) return "0 B";
        double kb = bytes / 1024d;
        if (kb < 1024) return Math.max(1, Math.round(kb)) + " KB";
        double mb = kb / 1024d;
        if (mb < 1024) return String.format("%.1f MB", mb);
        return String.format("%.1f GB", mb / 1024d);
    }

    // ── IP 容器 ────────────────────────────────────────────────

    public List<IpDto> listIps(String userId) {
        return ipRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId).stream()
                .map(ip -> toIpDto(userId, ip))
                .toList();
    }

    public DapAssetIp requiredIp(String userId, String id) {
        return ipRepo.findByIdAndOwnerUserId(id, userId)
                .filter(x -> x.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("DAP_IP_NOT_FOUND", "IP 不存在或无权访问"));
    }

    public IpDto toIpDto(String userId, DapAssetIp ip) {
        List<DapAvatar> chars = charactersOf(userId, ip.getId());
        IpMembersDto members = new IpMembersDto(
                chars.size(),
                sceneRepo.countByOwnerUserIdAndIpIdAndDeletedAtIsNull(userId, ip.getId()),
                productRepo.countByOwnerUserIdAndIpIdAndDeletedAtIsNull(userId, ip.getId()),
                chars.stream().filter(a -> a.getVoiceName() != null && !a.getVoiceName().isBlank()).count());
        long works = usageRepo.countByOwnerUserIdAndAssetTypeAndAssetId(userId, "ip", ip.getId());
        String coverFallback = chars.stream()
                .map(DapAvatar::getImageKey)
                .filter(k -> k != null)
                .findFirst()
                .map(storage::signedUrl)
                .orElse(null);
        String licStatus = ip.getLicenseId() == null ? null : licenseService.statusOf(userId, ip.getLicenseId());
        return IpDto.from(ip, support.relativeZh(ip.getUpdatedAt()), members, works, licStatus,
                coverFallback, storage::signedUrl);
    }

    private List<DapAvatar> charactersOf(String userId, String ipId) {
        return avatarRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId).stream()
                .filter(a -> ipId.equals(a.getIpId()))
                .toList();
    }

    /** IP 详情：容器视图（下挂四类成员 + 作品 + 授权）。作品由调用方补齐（避免服务间循环依赖）。 */
    public IpDetailDto ipDetail(String userId, String id, List<com.aistareco.aep.dap.dto.DapAssetDtos.CompositionDto> works) {
        DapAssetIp ip = requiredIp(userId, id);
        List<DapAvatar> chars = charactersOf(userId, id);
        List<Map<String, Object>> voices = new ArrayList<>();
        for (DapVoice v : voiceRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)) {
            if (v.getAvatarId() != null && chars.stream().anyMatch(c -> c.getId().equals(v.getAvatarId()))) {
                voices.add(com.aistareco.aep.dap.dto.DapDtos.VoiceDto.from(v, storage::signedUrl).toWire());
            }
        }
        Map<String, Object> license = ip.getLicenseId() == null ? null
                : licenseService.get(userId, ip.getLicenseId());
        return new IpDetailDto(
                toIpDto(userId, ip),
                chars.stream().map(avatarService::toDto).toList(),
                sceneRepo.findByOwnerUserIdAndIpIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId, id).stream()
                        .map(s -> toSceneDto(userId, s)).toList(),
                productRepo.findByOwnerUserIdAndIpIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId, id).stream()
                        .map(p -> toProductDto(userId, p)).toList(),
                voices,
                works,
                license);
    }

    @Transactional
    public IpDto createIp(String userId, CreateIpRequest req) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw BusinessException.badRequest("DAP_IP_NAME_REQUIRED", "请填写 IP 名称");
        }
        Instant now = Instant.now();
        DapAssetIp ip = DapAssetIp.builder()
                .id(uniqueId("IP", ipRepo::existsById))
                .ownerUserId(userId)
                .name(req.name().trim())
                .tagline(req.tagline())
                .summary(req.summary())
                .status("ready")
                .hue(200 + (int) (Math.abs(req.name().hashCode()) % 140))
                .versions(1)
                .createdAt(now)
                .updatedAt(now)
                .build();
        ipRepo.save(ip);
        return toIpDto(userId, ip);
    }

    @Transactional
    public IpDto patchIp(String userId, String id, PatchIpRequest req) {
        DapAssetIp ip = requiredIp(userId, id);
        if (req.name() != null && !req.name().isBlank()) ip.setName(req.name().trim());
        if (req.tagline() != null) ip.setTagline(req.tagline());
        if (req.summary() != null) ip.setSummary(req.summary());
        if (req.status() != null && !req.status().isBlank()) ip.setStatus(req.status());
        ip.setUpdatedAt(Instant.now());
        ipRepo.save(ip);
        return toIpDto(userId, ip);
    }

    @Transactional
    public void deleteIp(String userId, String id) {
        DapAssetIp ip = requiredIp(userId, id);
        // 解绑成员（成员本身不删 —— IP 只是容器）
        charactersOf(userId, id).forEach(a -> { a.setIpId(null); avatarRepo.save(a); });
        sceneRepo.findByOwnerUserIdAndIpIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId, id)
                .forEach(s -> { s.setIpId(null); sceneRepo.save(s); });
        productRepo.findByOwnerUserIdAndIpIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId, id)
                .forEach(p -> { p.setIpId(null); productRepo.save(p); });
        ip.setDeletedAt(Instant.now());
        ipRepo.save(ip);
    }

    /** 关联 / 取消关联成员资产（attach 缺省为 true）。 */
    @Transactional
    public IpDetailDto member(String userId, String ipId, IpMemberRequest req,
                              List<com.aistareco.aep.dap.dto.DapAssetDtos.CompositionDto> works) {
        requiredIp(userId, ipId);
        boolean attach = req.attach() == null || req.attach();
        String target = attach ? ipId : null;
        String type = req.assetType() == null ? "" : req.assetType();
        String assetId = req.assetId();
        if (assetId == null || assetId.isBlank()) {
            throw BusinessException.badRequest("DAP_ASSET_REQUIRED", "请选择要关联的资产");
        }
        switch (type) {
            case "character" -> {
                DapAvatar a = avatarService.required(userId, assetId);
                a.setIpId(target);
                a.setUpdatedAt(Instant.now());
                avatarRepo.save(a);
            }
            case "scene" -> {
                DapScene s = requiredScene(userId, assetId);
                s.setIpId(target);
                s.setUpdatedAt(Instant.now());
                sceneRepo.save(s);
            }
            case "product" -> {
                DapProduct p = requiredProduct(userId, assetId);
                p.setIpId(target);
                p.setUpdatedAt(Instant.now());
                productRepo.save(p);
            }
            // 声音跟随其绑定的人物进 IP（VO- 没有独立 ipId 列），此处显式拒绝避免静默无效
            case "voice" -> throw BusinessException.badRequest("DAP_VOICE_FOLLOWS_CHARACTER",
                    "声音随其绑定的人物一起归入 IP，请先把对应人物关联到本 IP");
            default -> throw BusinessException.badRequest("DAP_BAD_ASSET_TYPE", "未知资产类型：" + type);
        }
        return ipDetail(userId, ipId, works);
    }

    /** 登记 / 续签 IP 授权（设计 §02：IP 与真人肖像才有 LIC）。 */
    @Transactional
    public Map<String, Object> upsertIpLicense(String userId, String ipId, IpLicenseRequest req) {
        DapAssetIp ip = requiredIp(userId, ipId);
        Map<String, Object> lic;
        if (ip.getLicenseId() != null) {
            lic = licenseService.renew(userId, ip.getLicenseId());
        } else {
            String subject = req != null && req.subject() != null && !req.subject().isBlank()
                    ? req.subject().trim() : ip.getName();
            String scope = req != null && req.scope() != null && !req.scope().isBlank()
                    ? req.scope().trim() : "品牌商用 / 全平台";
            Integer years = req == null ? null : req.years();
            List<String> platforms = req == null || req.platforms() == null || req.platforms().isEmpty()
                    ? List.of("全平台") : req.platforms();
            lic = licenseService.createForIp(userId, ipId, subject, scope, years, platforms);
            ip.setLicenseId(String.valueOf(lic.get("id")));
            ip.setUpdatedAt(Instant.now());
            ipRepo.save(ip);
        }
        return lic;
    }

    // ── 场景 ──────────────────────────────────────────────────

    public List<SceneDto> listScenes(String userId, String source, String space, String ipId, String q) {
        return sceneRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId).stream()
                .filter(s -> source == null || source.isBlank() || source.equals(s.getSource()))
                .filter(s -> space == null || space.isBlank() || space.equals(s.getSpace()))
                .filter(s -> ipId == null || ipId.isBlank() || ipId.equals(s.getIpId()))
                .filter(s -> matches(q, s.getName(), s.getId(), s.getDescription()))
                .map(s -> toSceneDto(userId, s))
                .toList();
    }

    public DapScene requiredScene(String userId, String id) {
        return sceneRepo.findByIdAndOwnerUserId(id, userId)
                .filter(s -> s.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("DAP_SCENE_NOT_FOUND", "场景不存在或无权访问"));
    }

    public SceneDto sceneDto(String userId, String id) {
        return toSceneDto(userId, requiredScene(userId, id));
    }

    public SceneDto toSceneDto(String userId, DapScene s) {
        long uses = usageRepo.countByOwnerUserIdAndAssetTypeAndAssetId(userId, "scene", s.getId());
        return SceneDto.from(s, support.relativeZh(s.getUpdatedAt()), uses, storage::signedUrl);
    }

    /** 实拍上传入库（轻资产，只记来源，不扣费）。 */
    @Transactional
    public SceneDto uploadScene(String userId, MultipartFile file, String name, String description,
                                String space, String light, String ipId) {
        requireImage(file);
        FileStorageService.StoredFile stored = storage.store(file, "dap/scene", userId);
        int[] wh = dimensionsOf(file);
        Instant now = Instant.now();
        DapScene s = DapScene.builder()
                .id(uniqueId("SC", sceneRepo::existsById))
                .ownerUserId(userId)
                .name(blankTo(name, "未命名场景"))
                .description(description)
                .source("shot")
                .space(blankTo(space, "indoor"))
                .light(light)
                .width(wh[0]).height(wh[1])
                .imageKey(stored.key())
                .ipId(blankToNull(ipId))
                .status("ready")
                .bytes(stored.bytes())
                .hue(190 + (int) (Math.abs(blankTo(name, "s").hashCode()) % 60))
                .createdAt(now).updatedAt(now)
                .build();
        sceneRepo.save(s);
        return toSceneDto(userId, s);
    }

    /** AI 生成场景（异步任务 + 扣费）。返回占位场景行 + 任务。 */
    @Transactional
    public Map<String, Object> generateScene(String userId, CreateSceneRequest req) {
        String prompt = req == null ? null : firstNonBlank(req.prompt(), req.description());
        if (prompt == null) {
            throw BusinessException.badRequest("DAP_SCENE_PROMPT_REQUIRED", "请描述要生成的场景");
        }
        Instant now = Instant.now();
        DapScene s = DapScene.builder()
                .id(uniqueId("SC", sceneRepo::existsById))
                .ownerUserId(userId)
                .name(blankTo(req.name(), truncate(prompt, 12)))
                .description(req.description())
                .source("ai")
                .space(blankTo(req.space(), "indoor"))
                .light(req.light())
                .ipId(blankToNull(req.ipId()))
                .status("running")
                .promptEn(prompt)
                .hue(190 + (int) (Math.abs(prompt.hashCode()) % 60))
                .createdAt(now).updatedAt(now)
                .build();
        sceneRepo.save(s);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sceneId", s.getId());
        payload.put("prompt", prompt);
        payload.put("ratio", blankTo(req.ratio(), "16:10"));
        DapJob job = jobService.submitAsset(userId, s.getId(), s.getName(), DapJob.T_SCENE_GEN,
                "场景生成", engineName(), pricing.sceneGenerate(), "约 40 秒", payload);
        s.setJobId(job.getId());
        sceneRepo.save(s);
        return Map.of("scene", toSceneDto(userId, s), "job", JobDto.from(job, support::hm).toWire());
    }

    @Transactional
    public SceneDto patchScene(String userId, String id, PatchSceneRequest req) {
        DapScene s = requiredScene(userId, id);
        if (req.name() != null && !req.name().isBlank()) s.setName(req.name().trim());
        if (req.description() != null) s.setDescription(req.description());
        if (req.space() != null && !req.space().isBlank()) s.setSpace(req.space());
        if (req.light() != null) s.setLight(req.light());
        if (req.ipId() != null) s.setIpId(blankToNull(req.ipId()));
        s.setUpdatedAt(Instant.now());
        sceneRepo.save(s);
        return toSceneDto(userId, s);
    }

    @Transactional
    public void deleteScene(String userId, String id) {
        DapScene s = requiredScene(userId, id);
        s.setDeletedAt(Instant.now());
        sceneRepo.save(s);
    }

    /** 生成光线变体（按张扣费；labels 为空用默认「午后 / 夜晚」）。 */
    @Transactional
    public Map<String, Object> sceneVariants(String userId, String id, SceneVariantRequest req) {
        DapScene s = requiredScene(userId, id);
        if (s.getImageKey() == null) {
            throw BusinessException.badRequest("DAP_SCENE_NO_IMAGE", "场景还没有主图，先上传或等待生成完成");
        }
        List<String> labels = req == null || req.labels() == null || req.labels().isEmpty()
                ? DEFAULT_VARIANT_LABELS : req.labels().stream().filter(l -> l != null && !l.isBlank()).limit(6).toList();
        if (labels.isEmpty()) {
            throw BusinessException.badRequest("DAP_VARIANT_REQUIRED", "请至少选择一个光线变体");
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sceneId", s.getId());
        payload.put("labels", labels);
        DapJob job = jobService.submitAsset(userId, s.getId(), s.getName(), DapJob.T_SCENE_VARIANT,
                "场景光线变体", engineName(), pricing.sceneVariant() * labels.size(),
                "约 " + (labels.size() * 30) + " 秒", payload);
        return Map.of("job", JobDto.from(job, support::hm).toWire());
    }

    // ── 产品 ──────────────────────────────────────────────────

    public List<ProductDto> listProducts(String userId, String category, String ipId, String q) {
        return productRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId).stream()
                .filter(p -> category == null || category.isBlank() || category.equals(p.getCategory()))
                .filter(p -> ipId == null || ipId.isBlank() || ipId.equals(p.getIpId()))
                .filter(p -> matches(q, p.getName(), p.getId(), p.getCategory()))
                .map(p -> toProductDto(userId, p))
                .toList();
    }

    public DapProduct requiredProduct(String userId, String id) {
        return productRepo.findByIdAndOwnerUserId(id, userId)
                .filter(p -> p.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("DAP_PRODUCT_NOT_FOUND", "产品不存在或无权访问"));
    }

    public ProductDto productDto(String userId, String id) {
        return toProductDto(userId, requiredProduct(userId, id));
    }

    public ProductDto toProductDto(String userId, DapProduct p) {
        long uses = usageRepo.countByOwnerUserIdAndAssetTypeAndAssetId(userId, "product", p.getId());
        return ProductDto.from(p, support.relativeZh(p.getUpdatedAt()), uses, storage::signedUrl);
    }

    @Transactional
    public ProductDto uploadProduct(String userId, MultipartFile file, String name, String category,
                                    String description, String ipId, Boolean brandAuthorized,
                                    String brandLicenseUntil) {
        requireImage(file);
        FileStorageService.StoredFile stored = storage.store(file, "dap/product", userId);
        int[] wh = dimensionsOf(file);
        Instant now = Instant.now();
        Map<String, Object> angles = new LinkedHashMap<>();
        angles.put("items", new ArrayList<>(List.of(angleItem("正面", stored.key(),
                com.aistareco.aep.dap.dto.DapAssetDtos.specOf(wh[0], wh[1]) + " · 原图"))));
        DapProduct p = DapProduct.builder()
                .id(uniqueId("PD", productRepo::existsById))
                .ownerUserId(userId)
                .name(blankTo(name, "未命名产品"))
                .category(category)
                .description(description)
                .source("shot")
                .ipId(blankToNull(ipId))
                .brandAuthorized(Boolean.TRUE.equals(brandAuthorized))
                .brandLicenseUntil(blankToNull(brandLicenseUntil))
                .imageKey(stored.key())
                .anglesJson(angles)
                .status("ready")
                .bytes(stored.bytes())
                .hue(20 + (int) (Math.abs(blankTo(name, "p").hashCode()) % 60))
                .createdAt(now).updatedAt(now)
                .build();
        productRepo.save(p);
        return toProductDto(userId, p);
    }

    @Transactional
    public Map<String, Object> generateProduct(String userId, CreateProductRequest req) {
        String prompt = req == null ? null : firstNonBlank(req.prompt(), req.description(), req.name());
        if (prompt == null) {
            throw BusinessException.badRequest("DAP_PRODUCT_PROMPT_REQUIRED", "请描述要生成的产品");
        }
        Instant now = Instant.now();
        DapProduct p = DapProduct.builder()
                .id(uniqueId("PD", productRepo::existsById))
                .ownerUserId(userId)
                .name(blankTo(req.name(), truncate(prompt, 12)))
                .category(req.category())
                .description(req.description())
                .source("ai")
                .ipId(blankToNull(req.ipId()))
                .brandAuthorized(Boolean.TRUE.equals(req.brandAuthorized()))
                .brandLicenseUntil(blankToNull(req.brandLicenseUntil()))
                .status("running")
                .promptEn(prompt)
                .hue(20 + (int) (Math.abs(prompt.hashCode()) % 60))
                .createdAt(now).updatedAt(now)
                .build();
        productRepo.save(p);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("productId", p.getId());
        payload.put("prompt", prompt);
        if (p.getCategory() != null) payload.put("category", p.getCategory());
        DapJob job = jobService.submitAsset(userId, p.getId(), p.getName(), DapJob.T_PRODUCT_GEN,
                "产品图生成", engineName(), pricing.productGenerate(), "约 40 秒", payload);
        p.setJobId(job.getId());
        productRepo.save(p);
        return Map.of("product", toProductDto(userId, p), "job", JobDto.from(job, support::hm).toWire());
    }

    @Transactional
    public ProductDto patchProduct(String userId, String id, PatchProductRequest req) {
        DapProduct p = requiredProduct(userId, id);
        if (req.name() != null && !req.name().isBlank()) p.setName(req.name().trim());
        if (req.category() != null) p.setCategory(req.category());
        if (req.description() != null) p.setDescription(req.description());
        if (req.ipId() != null) p.setIpId(blankToNull(req.ipId()));
        if (req.brandAuthorized() != null) p.setBrandAuthorized(req.brandAuthorized());
        if (req.brandLicenseUntil() != null) p.setBrandLicenseUntil(blankToNull(req.brandLicenseUntil()));
        p.setUpdatedAt(Instant.now());
        productRepo.save(p);
        return toProductDto(userId, p);
    }

    @Transactional
    public void deleteProduct(String userId, String id) {
        DapProduct p = requiredProduct(userId, id);
        p.setDeletedAt(Instant.now());
        productRepo.save(p);
    }

    @Transactional
    public Map<String, Object> productAngles(String userId, String id, ProductAngleRequest req) {
        DapProduct p = requiredProduct(userId, id);
        if (p.getImageKey() == null) {
            throw BusinessException.badRequest("DAP_PRODUCT_NO_IMAGE", "产品还没有主图，先上传或等待生成完成");
        }
        List<String> labels = req == null || req.labels() == null || req.labels().isEmpty()
                ? DEFAULT_ANGLE_LABELS : req.labels().stream().filter(l -> l != null && !l.isBlank()).limit(6).toList();
        if (labels.isEmpty()) {
            throw BusinessException.badRequest("DAP_ANGLE_REQUIRED", "请至少选择一个角度");
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("productId", p.getId());
        payload.put("labels", labels);
        DapJob job = jobService.submitAsset(userId, p.getId(), p.getName(), DapJob.T_PRODUCT_ANGLE,
                "产品补充角度", engineName(), pricing.productAngle() * labels.size(),
                "约 " + (labels.size() * 30) + " 秒", payload);
        return Map.of("job", JobDto.from(job, support::hm).toWire());
    }

    // ── 风格模板 ───────────────────────────────────────────────

    public List<StyleDto> listStyles(String userId) {
        return styleRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUseCountDescUpdatedAtDesc(userId).stream()
                .map(s -> StyleDto.from(s, support.relativeZh(s.getUpdatedAt()), storage::signedUrl))
                .toList();
    }

    public DapStyle requiredStyle(String userId, String id) {
        return styleRepo.findByIdAndOwnerUserId(id, userId)
                .filter(s -> s.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("DAP_STYLE_NOT_FOUND", "风格模板不存在或无权访问"));
    }

    public StyleDto styleDto(String userId, String id) {
        DapStyle s = requiredStyle(userId, id);
        return StyleDto.from(s, support.relativeZh(s.getUpdatedAt()), storage::signedUrl);
    }

    @Transactional
    public StyleDto createStyle(String userId, CreateStyleRequest req) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw BusinessException.badRequest("DAP_STYLE_NAME_REQUIRED", "请填写风格模板名称");
        }
        Instant now = Instant.now();
        DapStyle s = DapStyle.builder()
                .id(uniqueId("ST", styleRepo::existsById))
                .ownerUserId(userId)
                .name(req.name().trim())
                .summary(req.summary())
                .promptEn(req.promptEn())
                .tags(req.tags() == null ? new ArrayList<>() : new ArrayList<>(req.tags()))
                .source("work".equals(req.source()) ? "work" : "manual")
                .hue(190 + (int) (Math.abs(req.name().hashCode()) % 80))
                .createdAt(now).updatedAt(now)
                .build();
        styleRepo.save(s);
        return StyleDto.from(s, support.relativeZh(s.getUpdatedAt()), storage::signedUrl);
    }

    @Transactional
    public StyleDto patchStyle(String userId, String id, PatchStyleRequest req) {
        DapStyle s = requiredStyle(userId, id);
        if (req.name() != null && !req.name().isBlank()) s.setName(req.name().trim());
        if (req.summary() != null) s.setSummary(req.summary());
        if (req.promptEn() != null) s.setPromptEn(req.promptEn());
        if (req.tags() != null) s.setTags(new ArrayList<>(req.tags()));
        s.setUpdatedAt(Instant.now());
        styleRepo.save(s);
        return StyleDto.from(s, support.relativeZh(s.getUpdatedAt()), storage::signedUrl);
    }

    @Transactional
    public void deleteStyle(String userId, String id) {
        DapStyle s = requiredStyle(userId, id);
        s.setDeletedAt(Instant.now());
        styleRepo.save(s);
    }

    // ── 引用台账（APPLIED TO）────────────────────────────────────

    public List<AssetUsageDto> usages(String userId, String assetType, String assetId) {
        return usageRepo.findByOwnerUserIdAndAssetTypeAndAssetIdOrderByUpdatedAtDesc(userId, assetType, assetId)
                .stream()
                .map(u -> AssetUsageDto.from(u, storage::signedUrl))
                .toList();
    }

    /** 登记一条引用（同一对 资产 → 用处 重复引用时累加 times，不新增行）。 */
    @Transactional
    public void recordUsage(String userId, String assetType, String assetId,
                            String usedByType, String usedById, String title, String meta, String thumbKey) {
        if (assetId == null || assetId.isBlank()) return;
        Instant now = Instant.now();
        DapAssetUsage u = usageRepo
                .findByOwnerUserIdAndAssetTypeAndAssetIdAndUsedByTypeAndUsedById(
                        userId, assetType, assetId, usedByType, usedById)
                .orElse(null);
        if (u == null) {
            u = DapAssetUsage.builder()
                    .id("USE-" + UUID.randomUUID().toString().substring(0, 12))
                    .ownerUserId(userId)
                    .assetType(assetType).assetId(assetId)
                    .usedByType(usedByType).usedById(usedById)
                    .title(title).meta(meta).thumbKey(thumbKey)
                    .times(1)
                    .createdAt(now).updatedAt(now)
                    .build();
        } else {
            u.setTimes(u.getTimes() + 1);
            u.setTitle(title);
            u.setMeta(meta);
            if (thumbKey != null) u.setThumbKey(thumbKey);
            u.setUpdatedAt(now);
        }
        usageRepo.save(u);
    }

    @Transactional
    public void bumpStyleUse(String userId, String styleId) {
        if (styleId == null || styleId.isBlank()) return;
        styleRepo.findByIdAndOwnerUserId(styleId, userId).ifPresent(s -> {
            s.setUseCount(s.getUseCount() + 1);
            s.setUpdatedAt(Instant.now());
            styleRepo.save(s);
        });
    }

    // ── 内部工具 ───────────────────────────────────────────────

    public static Map<String, Object> angleItem(String label, String cdnKey, String spec) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", label);
        m.put("cdnKey", cdnKey);
        if (spec != null) m.put("spec", spec);
        return m;
    }

    private String uniqueId(String prefix, java.util.function.Predicate<String> exists) {
        for (int i = 0; i < 20; i++) {
            String id = support.newId(prefix);
            if (!exists.test(id)) return id;
        }
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static void requireImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("DAP_NO_FILES", "未收到图片文件");
        }
        if (file.getSize() > UPLOAD_MAX_BYTES) {
            throw BusinessException.badRequest("DAP_IMAGE_TOO_LARGE", "图片过大（上限 30MB）");
        }
        String ct = file.getContentType();
        if (ct == null || !ct.toLowerCase().startsWith("image/")) {
            throw BusinessException.badRequest("DAP_BAD_IMAGE", "仅支持图片文件");
        }
    }

    /** 读图片像素尺寸；解析失败返回 {0,0}（只影响展示的规格文案，不阻断入库）。 */
    private static int[] dimensionsOf(MultipartFile file) {
        try (ByteArrayInputStream in = new ByteArrayInputStream(file.getBytes())) {
            BufferedImage img = ImageIO.read(in);
            if (img != null) return new int[]{img.getWidth(), img.getHeight()};
        } catch (Exception ignored) {
            // 非致命：规格文案退化为「—」
        }
        return new int[]{0, 0};
    }

    private static boolean matches(String q, String... fields) {
        if (q == null || q.isBlank()) return true;
        String needle = q.toLowerCase();
        for (String f : fields) {
            if (f != null && f.toLowerCase().contains(needle)) return true;
        }
        return false;
    }

    static String blankTo(String v, String dft) {
        return v == null || v.isBlank() ? dft : v.trim();
    }

    static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    static String firstNonBlank(String... vs) {
        for (String v : vs) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    /** 描述 → 资产名：截断到 n 字并去掉截口处的标点，避免出现「…起居室，…」这种断口。 */
    static String truncate(String s, int n) {
        if (s == null) return "";
        if (s.length() <= n) return s;
        String head = s.substring(0, n).replaceAll("[\\s，。、；：,.;:!?！？]+$", "");
        return (head.isEmpty() ? s.substring(0, n) : head) + "…";
    }
}
