package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapDtos.AvatarDto;
import com.aistareco.aep.dap.dto.DapDtos.VersionDto;
import com.aistareco.aep.dap.dto.DapRequests.CreateAvatarRequest;
import com.aistareco.aep.dap.dto.DapRequests.PatchAvatarRequest;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapAvatarVersion;
import com.aistareco.aep.dap.model.DapPhoto;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapAvatarVersionRepository;
import com.aistareco.aep.dap.repository.DapPhotoRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 数字人资产 CRUD + 状态机推进 + 版本时间线。 */
@Service
public class DapAvatarService {

    /** 衍生模块 key 全集（deriv/counts 初始化）。 */
    public static final List<String> DERIV_KEYS = List.of("atlas", "expr", "scene", "ward", "d3", "video");

    private static final SecureRandom RND = new SecureRandom();

    private final DapAvatarRepository avatarRepo;
    private final DapAvatarVersionRepository versionRepo;
    private final DapPhotoRepository photoRepo;
    private final FileStorageService storage;
    private final DapSupport support;
    private final DapCatalogService catalog;
    private final DapPublicAvatarService publicAvatars;

    public DapAvatarService(DapAvatarRepository avatarRepo,
                            DapAvatarVersionRepository versionRepo,
                            DapPhotoRepository photoRepo,
                            FileStorageService storage,
                            DapSupport support,
                            DapCatalogService catalog,
                            DapPublicAvatarService publicAvatars) {
        this.avatarRepo = avatarRepo;
        this.versionRepo = versionRepo;
        this.photoRepo = photoRepo;
        this.storage = storage;
        this.support = support;
        this.catalog = catalog;
        this.publicAvatars = publicAvatars;
    }

    // ── 查询 ──────────────────────────────────────────────────

    public List<AvatarDto> list(String userId, String path, String status, Boolean fav, String q) {
        return avatarRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId).stream()
                .filter(a -> path == null || path.isBlank() || path.equals(a.getPath()))
                .filter(a -> status == null || status.isBlank() || status.equals(a.getStatus()))
                .filter(a -> fav == null || a.isFav() == fav)
                .filter(a -> q == null || q.isBlank()
                        || (a.getName() + " " + (a.getArchetype() == null ? "" : a.getArchetype()) + " " + a.getId())
                        .toLowerCase().contains(q.toLowerCase()))
                .map(this::toDto)
                .toList();
    }

    public AvatarDto get(String userId, String id) {
        return toDto(required(userId, id));
    }

    public DapAvatar required(String userId, String id) {
        return avatarRepo.findByIdAndOwnerUserId(id, userId)
                .filter(a -> a.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("DAP_AVATAR_NOT_FOUND", "数字人不存在或无权访问"));
    }

    public AvatarDto toDto(DapAvatar a) {
        return AvatarDto.from(a, support.relativeZh(a.getUpdatedAt()), storage::signedUrl);
    }

    // ── 创建 / 修改 / 删除 ─────────────────────────────────────

    @Transactional
    public AvatarDto create(String userId, CreateAvatarRequest req) {
        String path = "real".equals(req.path()) ? "real" : "ai";
        int hue = 20 + RND.nextInt(320);
        Map<String, Object> deriv = new LinkedHashMap<>();
        Map<String, Object> counts = new LinkedHashMap<>();
        DERIV_KEYS.forEach(k -> { deriv.put(k, "empty"); counts.put(k, 0); });

        Map<String, Object> def = new LinkedHashMap<>();
        def.put("年龄", "—");
        def.put("气质", "—");
        def.put("用途", "—");
        def.put("性格", List.of());
        def.put("服饰", "—");
        def.put("形象来源", "real".equals(path) ? "真人模特授权" : "AI 原创虚构");
        def.put("设定语", "");

        DapAvatar a = DapAvatar.builder()
                .id(uniqueId("DH"))
                .ownerUserId(userId)
                .name(req.name() != null && !req.name().isBlank() ? req.name() : "新建数字人")
                .codename("new-avatar")
                .path(path)
                .archetype("real".equals(path) ? "真人授权复刻" : "AI 原创形象")
                .tagline("创建中…")
                .status("draft")
                .hue(hue)
                .hairStyle(RND.nextBoolean() ? "short" : "long")
                .palette(support.paletteFor(hue))
                .def(def)
                .deriv(deriv)
                .counts(counts)
                .versions(1)
                .voiceName(catalog.recommendVoice(null))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        avatarRepo.save(a);
        return toDto(a);
    }

    @Transactional
    public AvatarDto patch(String userId, String id, PatchAvatarRequest req) {
        DapAvatar a = required(userId, id);
        if (req.name() != null && !req.name().isBlank()) a.setName(req.name().trim());
        if (req.fav() != null) a.setFav(req.fav());
        if (req.tagline() != null) a.setTagline(req.tagline());
        if (req.archetype() != null) a.setArchetype(req.archetype());
        if (req.codename() != null) a.setCodename(req.codename());
        if (req.def() != null && !req.def().isEmpty()) {
            Map<String, Object> def = a.defOrEmpty();
            def.putAll(req.def());
            a.setDef(def);
        }
        if (req.voiceName() != null && !req.voiceName().isBlank()) a.setVoiceName(req.voiceName());
        a.setUpdatedAt(Instant.now());
        avatarRepo.save(a);
        return toDto(a);
    }

    @Transactional
    public void remove(String userId, String id) {
        DapAvatar a = required(userId, id);
        a.setDeletedAt(Instant.now());
        a.setUpdatedAt(Instant.now());
        avatarRepo.save(a);
    }

    // ── 版本时间线 ────────────────────────────────────────────

    public List<VersionDto> versions(String userId, String id) {
        required(userId, id);
        List<DapAvatarVersion> rows = versionRepo.findByAvatarIdOrderByVDesc(id);
        List<VersionDto> out = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            DapAvatarVersion v = rows.get(i);
            out.add(VersionDto.from(v, i == 0, support.relativeZh(v.getCreatedAt()), storage::signedUrl));
        }
        return out;
    }

    @Transactional
    public AvatarDto switchToVersion(String userId, String id, int v) {
        DapAvatar a = required(userId, id);
        if (hasDerivativeAssets(a)) {
            throw BusinessException.badRequest("DAP_VERSION_HAS_DERIVATIVES",
                    "该数字人已有衍生资产，请另存为新数字人，避免形象与衍生资产不一致");
        }
        DapAvatarVersion ver = requiredVersion(id, v);
        if (ver.getImageKey() == null || ver.getImageKey().isBlank()) {
            throw BusinessException.badRequest("DAP_VERSION_NO_IMAGE", "该版本没有可切换的形象图");
        }
        a.setImageKey(ver.getImageKey());
        a.setStatus("refining");
        a.setUpdatedAt(Instant.now());
        addVersion(a, "切换到 " + versionLabel(v), "refine", ver.getImageKey());
        avatarRepo.save(a);
        return toDto(a);
    }

    @Transactional
    public AvatarDto forkVersion(String userId, String id, int v) {
        DapAvatar a = required(userId, id);
        DapAvatarVersion ver = requiredVersion(id, v);
        if (ver.getImageKey() == null || ver.getImageKey().isBlank()) {
            throw BusinessException.badRequest("DAP_VERSION_NO_IMAGE", "该版本没有可另存的形象图");
        }
        Map<String, Object> deriv = new LinkedHashMap<>();
        Map<String, Object> counts = new LinkedHashMap<>();
        DERIV_KEYS.forEach(k -> { deriv.put(k, "empty"); counts.put(k, 0); });
        DapAvatar copy = DapAvatar.builder()
                .id(uniqueId("DH"))
                .ownerUserId(userId)
                .name(a.getName() + " · " + versionLabel(v))
                .codename(a.getCodename())
                .path(a.getPath())
                .archetype(a.getArchetype())
                .tagline(a.getTagline())
                .status("archived")
                .hue(a.getHue())
                .hairStyle(a.getHairStyle())
                .licenseId(a.getLicenseId())
                .mock(a.isMock())
                .engine(a.getEngine())
                .palette(a.getPalette())
                .def(new LinkedHashMap<>(a.defOrEmpty()))
                .deriv(deriv)
                .counts(counts)
                .versions(1)
                .voiceName(a.getVoiceName())
                .imageKey(ver.getImageKey())
                .variantKeys(new ArrayList<>())
                .shotKeys(null)
                .descPrompt(a.getDescPrompt())
                .form(a.getForm() == null ? null : new LinkedHashMap<>(a.getForm()))
                .basePrompt(a.getBasePrompt())
                .templateId(a.getTemplateId())
                .imageBytes(0)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        avatarRepo.save(copy);
        addVersionAt(copy, 1, "从 " + a.getName() + " " + versionLabel(v) + " 另存", "init", ver.getImageKey());
        return toDto(copy);
    }

    /**
     * 数字人广场「另存为我的数字人」：把只读公开数字人（PA-*）复制为当前用户可编辑的数字人。
     *
     * <p>广场形象图是 web-aiavatar 自带的静态展示资源（/plaza/*，非 OSS 资产、无 imageKey），
     * 因此 live 副本只继承人设（名称 / 设定档案 / 配色 / 音色），状态置 draft，由用户走创建链路
     * 生成属于自己的形象图。mock（演示）模式则连同展示图一起复制（见 proto/api.ts saveAs）。
     */
    @Transactional
    public AvatarDto saveAsFromPublic(String userId, String publicId) {
        // 来源二选一：内置静态样板（catalog，无 OSS key → 副本无图、走创建链路）
        //            或运营上传的 DB 公开数字人（有 OSS key → 连图复制为已就绪副本）
        com.aistareco.aep.dap.model.DapPublicAvatar dbPub = publicAvatars.findEntity(publicId);
        Map<String, Object> pub = dbPub == null ? catalog.publicAvatar(publicId) : null;
        if (dbPub == null && pub == null) {
            throw BusinessException.notFound("DAP_PUBLIC_AVATAR_NOT_FOUND", "公开数字人不存在");
        }
        Map<String, Object> deriv = new LinkedHashMap<>();
        Map<String, Object> counts = new LinkedHashMap<>();
        DERIV_KEYS.forEach(k -> { deriv.put(k, "empty"); counts.put(k, 0); });

        DapAvatar.DapAvatarBuilder b = DapAvatar.builder()
                .id(uniqueId("DH"))
                .ownerUserId(userId)
                .path("ai")
                .hairStyle("short")
                .mock(false)
                .deriv(deriv)
                .counts(counts)
                .versions(1)
                .variantKeys(new ArrayList<>())
                .imageBytes(0)
                .createdAt(Instant.now())
                .updatedAt(Instant.now());

        String name;
        String imageKey = null;
        if (dbPub != null) {
            // 运营 DB 公开数字人：连 OSS 形象一起复制 → 副本即已就绪可用
            name = dbPub.getName() != null ? dbPub.getName() : "公开数字人";
            int hue = dbPub.getHue() != 0 ? dbPub.getHue() : 240;
            imageKey = dbPub.getFrontKey();
            Map<String, Object> shotKeys = new LinkedHashMap<>();
            if (dbPub.getFrontKey() != null) shotKeys.put("front-half", dbPub.getFrontKey());
            if (dbPub.getRightKey() != null) shotKeys.put("right", dbPub.getRightKey());
            if (dbPub.getLeftKey() != null) shotKeys.put("left", dbPub.getLeftKey());
            b.name(name)
                    .codename((dbPub.getCodename() != null ? dbPub.getCodename() : "avatar") + "-copy")
                    .archetype(dbPub.getArchetype() != null ? dbPub.getArchetype() : "AI 原创形象")
                    .tagline(dbPub.getTagline() != null ? dbPub.getTagline() : "")
                    .status(imageKey != null ? "archived" : "draft")
                    .hue(hue)
                    .engine(dbPub.getEngine() != null ? dbPub.getEngine() : "SDXL")
                    .palette(dbPub.getPalette() != null ? new LinkedHashMap<>(dbPub.getPalette()) : support.paletteFor(hue))
                    .def(dbPub.getDef() != null ? new LinkedHashMap<>(dbPub.getDef()) : new LinkedHashMap<>())
                    .voiceName(dbPub.getVoiceName() != null ? dbPub.getVoiceName() : catalog.recommendVoice(null))
                    .imageKey(imageKey)
                    .shotKeys(shotKeys.isEmpty() ? null : shotKeys);
        } else {
            // 内置静态样板：图是 app 自带静态资源、无 OSS key，副本只承袭人设，走创建链路出图
            @SuppressWarnings("unchecked")
            Map<String, Object> srcDef = (Map<String, Object>) pub.getOrDefault("def", Map.of());
            @SuppressWarnings("unchecked")
            Map<String, Object> srcPalette = (Map<String, Object>) pub.get("palette");
            int hue = pub.get("hue") instanceof Number n ? n.intValue() : 240;
            name = String.valueOf(pub.getOrDefault("name", "公开数字人"));
            b.name(name)
                    .codename(String.valueOf(pub.getOrDefault("codename", "avatar")) + "-copy")
                    .archetype(String.valueOf(pub.getOrDefault("archetype", "AI 原创形象")))
                    .tagline(String.valueOf(pub.getOrDefault("tagline", "")))
                    .status("draft")
                    .hue(hue)
                    .engine(String.valueOf(pub.getOrDefault("engine", "Agnes Image 2.1")))
                    .palette(srcPalette != null ? new LinkedHashMap<>(srcPalette) : support.paletteFor(hue))
                    .def(new LinkedHashMap<>(srcDef))
                    .voiceName(pub.get("voiceName") != null ? String.valueOf(pub.get("voiceName")) : catalog.recommendVoice(null))
                    .shotKeys(null);
        }

        DapAvatar copy = b.build();
        avatarRepo.save(copy);
        addVersionAt(copy, 1, "从数字人广场「" + name + "」另存", "init", imageKey);
        return toDto(copy);
    }

    @Transactional
    public void addVersion(DapAvatar a, String note, String kind, String imageKey) {
        a.setVersions(a.getVersions() + 1);
        versionRepo.save(DapAvatarVersion.builder()
                .id(UUID.randomUUID().toString())
                .avatarId(a.getId())
                .v(a.getVersions())
                .note(note)
                .kind(kind)
                .imageKey(imageKey)
                .createdAt(Instant.now())
                .build());
    }

    /** 不递增版本号的初始事件（v1 初始选稿）。 */
    @Transactional
    public void addVersionAt(DapAvatar a, int v, String note, String kind, String imageKey) {
        versionRepo.save(DapAvatarVersion.builder()
                .id(UUID.randomUUID().toString())
                .avatarId(a.getId())
                .v(v)
                .note(note)
                .kind(kind)
                .imageKey(imageKey)
                .createdAt(Instant.now())
                .build());
    }

    private DapAvatarVersion requiredVersion(String avatarId, int v) {
        return versionRepo.findByAvatarIdAndV(avatarId, v)
                .orElseThrow(() -> BusinessException.notFound("DAP_VERSION_NOT_FOUND", "版本不存在"));
    }

    private boolean hasDerivativeAssets(DapAvatar a) {
        Map<String, Object> counts = a.countsOrEmpty();
        for (String k : DERIV_KEYS) {
            Object raw = counts.get(k);
            if (raw instanceof Number n && n.intValue() > 0) return true;
            if (raw != null) {
                try { if (Integer.parseInt(String.valueOf(raw)) > 0) return true; }
                catch (NumberFormatException ignored) {}
            }
        }
        Map<String, Object> shots = a.getShotKeys();
        return shots != null && !shots.isEmpty();
    }

    private static String versionLabel(int v) {
        return "v" + Math.max(1, v);
    }

    // ── 候选挑选 / 定稿 / 绑音色 ───────────────────────────────

    @Transactional
    public AvatarDto pick(String userId, String id, int variantIndex) {
        DapAvatar a = required(userId, id);
        List<String> variants = a.getVariantKeys();
        if (variants == null || variants.isEmpty()) {
            throw BusinessException.badRequest("DAP_NO_VARIANTS", "尚无候选形象，请先生成");
        }
        int i = Math.max(0, Math.min(variants.size() - 1, variantIndex));
        a.setImageKey(variants.get(i));
        a.setStatus("iterating");
        a.setUpdatedAt(Instant.now());
        addVersionAt(a, 1, "初始选稿 · v" + (i + 1) + " 候选", "init", variants.get(i));
        avatarRepo.save(a);
        return toDto(a);
    }

    @Transactional
    public AvatarDto finalizeAvatar(String userId, String id, String templateId,
                                    List<String> confirmedShots, boolean archive) {
        DapAvatar a = required(userId, id);
        if (a.getImageKey() == null) {
            throw BusinessException.badRequest("DAP_NO_IMAGE", "尚未生成定妆形象，无法定稿");
        }
        if (templateId != null && !templateId.isBlank()) a.setTemplateId(templateId);
        if (archive) {
            a.setStatus("archived");
            addVersion(a, "完成创建 · 已入库", "archive", a.getImageKey());
        } else {
            a.setStatus("finalized");
            int n = confirmedShots == null ? 0 : confirmedShots.size();
            addVersion(a, "定稿确认 · " + n + " 张标准图", "finalize", a.getImageKey());
        }
        a.setUpdatedAt(Instant.now());
        avatarRepo.save(a);
        return toDto(a);
    }

    @Transactional
    public AvatarDto bindVoice(String userId, String id, String voiceName) {
        DapAvatar a = required(userId, id);
        if (voiceName == null || voiceName.isBlank()) {
            throw BusinessException.badRequest("DAP_VOICE_REQUIRED", "缺少音色");
        }
        a.setVoiceName(voiceName);
        a.setUpdatedAt(Instant.now());
        avatarRepo.save(a);
        return toDto(a);
    }

    // ── 定妆图同源输出（端上精调取图；规避 CDN 跨域 canvas 污染）──

    /** 当前定妆图的字节 + MIME（owner 校验；无图 404）。 */
    public ImagePayload imageContent(String userId, String id) {
        DapAvatar a = required(userId, id);
        if (a.getImageKey() == null || a.getImageKey().isBlank()) {
            throw BusinessException.notFound("DAP_NO_IMAGE", "尚未生成定妆形象");
        }
        try {
            java.nio.file.Path p = storage.openForRead(a.getImageKey());
            return new ImagePayload(java.nio.file.Files.readAllBytes(p), mimeOfKey(a.getImageKey()));
        } catch (java.io.IOException e) {
            throw new BusinessException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "DAP_IMAGE_READ_FAILED", "形象图读取失败，请稍后重试");
        }
    }

    public record ImagePayload(byte[] bytes, String contentType) {}

    private static String mimeOfKey(String key) {
        String k = key.toLowerCase();
        if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return "image/jpeg";
        if (k.endsWith(".webp")) return "image/webp";
        if (k.endsWith(".gif")) return "image/gif";
        return "image/png";
    }

    // ── 照片素材 ──────────────────────────────────────────────

    @Transactional
    public Map<String, Object> uploadPhotos(String userId, String id, List<MultipartFile> files) {
        DapAvatar a = required(userId, id);
        if (files == null || files.isEmpty()) {
            throw BusinessException.badRequest("DAP_NO_FILES", "未收到照片文件");
        }
        int saved = 0;
        for (MultipartFile f : files) {
            if (f.isEmpty()) continue;
            FileStorageService.StoredFile stored = storage.store(f, "dap/photo", userId);
            photoRepo.save(DapPhoto.builder()
                    .id(UUID.randomUUID().toString())
                    .avatarId(a.getId())
                    .ownerUserId(userId)
                    .fileKey(stored.key())
                    .contentType(stored.contentType())
                    .bytes(stored.bytes())
                    .createdAt(Instant.now())
                    .build());
            saved++;
        }
        a.setUpdatedAt(Instant.now());
        avatarRepo.save(a);
        return Map.of("passed", saved > 0, "count", saved);
    }

    public List<DapPhoto> photosOf(String avatarId) {
        return photoRepo.findByAvatarIdOrderByCreatedAtAsc(avatarId);
    }

    public void save(DapAvatar a) {
        a.setUpdatedAt(Instant.now());
        avatarRepo.save(a);
    }

    public String uniqueId(String prefix) {
        for (int i = 0; i < 20; i++) {
            String id = support.newId(prefix);
            if (!avatarRepo.existsById(id)) return id;
        }
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
