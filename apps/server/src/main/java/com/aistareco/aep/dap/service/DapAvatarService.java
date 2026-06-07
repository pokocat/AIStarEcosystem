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

    public DapAvatarService(DapAvatarRepository avatarRepo,
                            DapAvatarVersionRepository versionRepo,
                            DapPhotoRepository photoRepo,
                            FileStorageService storage,
                            DapSupport support,
                            DapCatalogService catalog) {
        this.avatarRepo = avatarRepo;
        this.versionRepo = versionRepo;
        this.photoRepo = photoRepo;
        this.storage = storage;
        this.support = support;
        this.catalog = catalog;
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
