package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapPublicAvatarUpsertRequest;
import com.aistareco.aep.dap.model.DapPublicAvatar;
import com.aistareco.aep.dap.repository.DapPublicAvatarRepository;
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
 * 数字人广场 · 运营可管理的公开数字人（DB 表 dap_public_avatar）。
 * 与 DapCatalogService 内置 10 个静态样板合并对外，但本表可由运营 CRUD + 上传 OSS 形象。
 */
@Service
public class DapPublicAvatarService {

    private final DapPublicAvatarRepository repo;
    private final FileStorageService storage;

    public DapPublicAvatarService(DapPublicAvatarRepository repo, FileStorageService storage) {
        this.repo = repo;
        this.storage = storage;
    }

    // ── 对外（合并进 scope=public 列表）──────────────────────────

    /** 全部运营公开数字人的 wire（与 DapCatalogService.publicAvatars() 同形，附 managed=true）。 */
    public List<Map<String, Object>> listPublicWire() {
        return repo.findAllByOrderBySortOrderAscCreatedAtDesc().stream().map(this::toWire).toList();
    }

    /** 单个（详情永久链接冷还原 / 另存为来源查找）。 */
    public Map<String, Object> findWire(String id) {
        return repo.findById(id).map(this::toWire).orElse(null);
    }

    public DapPublicAvatar findEntity(String id) {
        return repo.findById(id).orElse(null);
    }

    private Map<String, Object> toWire(DapPublicAvatar a) {
        Map<String, String> shots = new LinkedHashMap<>();
        if (a.getFrontKey() != null) shots.put("front-half", storage.signedUrl(a.getFrontKey()));
        if (a.getRightKey() != null) shots.put("right", storage.signedUrl(a.getRightKey()));
        if (a.getLeftKey() != null) shots.put("left", storage.signedUrl(a.getLeftKey()));

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("name", a.getName());
        m.put("codename", a.getCodename());
        m.put("path", a.getPath() != null ? a.getPath() : "ai");
        m.put("archetype", a.getArchetype());
        m.put("tagline", a.getTagline());
        m.put("status", "archived");
        m.put("updated", "已就绪");
        m.put("hue", a.getHue());
        m.put("cat", a.getCat());
        m.put("fav", a.isFav());
        m.put("versions", 1);
        m.put("engine", a.getEngine() != null ? a.getEngine() : "SDXL");
        m.put("voiceName", a.getVoiceName());
        m.put("palette", a.getPalette() != null ? a.getPalette() : Map.of());
        m.put("def", a.getDef() != null ? a.getDef() : Map.of());
        m.put("counts", Map.of());
        m.put("deriv", Map.of());
        if (a.getFrontKey() != null) m.put("imageUrl", storage.signedUrl(a.getFrontKey()));
        m.put("shotImages", shots);
        m.put("managed", true);   // 前端据此对运营开放编辑 / 删除（内置 10 个无此标记）
        return m;
    }

    // ── 运营 CRUD ────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> create(DapPublicAvatarUpsertRequest req, String operatorUserId) {
        if (req.name() == null || req.name().isBlank()) {
            throw BusinessException.badRequest("DAP_PUBLIC_NAME_REQUIRED", "请填写数字人名称");
        }
        if (req.frontKey() == null || req.frontKey().isBlank()) {
            throw BusinessException.badRequest("DAP_PUBLIC_IMAGE_REQUIRED", "请上传正面半身形象图");
        }
        Instant now = Instant.now();
        DapPublicAvatar a = DapPublicAvatar.builder()
                .id("PA-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8))
                .path("ai")
                .createdByUserId(operatorUserId)
                .createdAt(now)
                .updatedAt(now)
                .build();
        apply(a, req);
        repo.save(a);
        return toWire(a);
    }

    @Transactional
    public Map<String, Object> update(String id, DapPublicAvatarUpsertRequest req) {
        DapPublicAvatar a = repo.findById(id)
                .orElseThrow(() -> BusinessException.notFound("DAP_PUBLIC_AVATAR_NOT_FOUND", "公开数字人不存在"));
        apply(a, req);
        a.setUpdatedAt(Instant.now());
        repo.save(a);
        return toWire(a);
    }

    @Transactional
    public void delete(String id) {
        if (!repo.existsById(id)) {
            throw BusinessException.notFound("DAP_PUBLIC_AVATAR_NOT_FOUND", "公开数字人不存在");
        }
        repo.deleteById(id);
    }

    /** 把入参写入实体（create / update 共用）；null 字段保持不变（编辑可只改部分）。 */
    private void apply(DapPublicAvatar a, DapPublicAvatarUpsertRequest req) {
        if (req.name() != null && !req.name().isBlank()) a.setName(req.name().trim());
        if (req.codename() != null) a.setCodename(req.codename().trim());
        if (req.archetype() != null) a.setArchetype(req.archetype().trim());
        if (req.tagline() != null) a.setTagline(req.tagline().trim());
        if (req.cat() != null) a.setCat(req.cat().trim());
        if (req.hue() != null) a.setHue(req.hue());
        if (req.engine() != null) a.setEngine(req.engine().trim());
        if (req.voiceName() != null) a.setVoiceName(req.voiceName().trim());
        if (req.palette() != null) a.setPalette(req.palette());
        if (req.fav() != null) a.setFav(req.fav());
        if (req.sortOrder() != null) a.setSortOrder(req.sortOrder());
        if (req.frontKey() != null && !req.frontKey().isBlank()) a.setFrontKey(req.frontKey().trim());
        if (req.rightKey() != null) a.setRightKey(req.rightKey().isBlank() ? null : req.rightKey().trim());
        if (req.leftKey() != null) a.setLeftKey(req.leftKey().isBlank() ? null : req.leftKey().trim());

        Map<String, Object> def = buildDef(a.getDef(), req);
        if (def != null) a.setDef(def);
        if (a.getCodename() == null || a.getCodename().isBlank()) a.setCodename("plaza-avatar");
        if (a.getHue() == 0) a.setHue(222);
    }

    /** 组装设定档案：整包 def 优先；否则用分字段覆盖既有 def（保持中文键顺序）。 */
    private Map<String, Object> buildDef(Map<String, Object> existing, DapPublicAvatarUpsertRequest req) {
        if (req.def() != null && !req.def().isEmpty()) return new LinkedHashMap<>(req.def());
        boolean any = req.age() != null || req.temperament() != null || req.usage() != null
                || req.traits() != null || req.outfit() != null || req.persona() != null;
        if (!any && existing != null) return existing;
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("年龄", pick(req.age(), existing, "年龄"));
        d.put("气质", pick(req.temperament(), existing, "气质"));
        d.put("用途", pick(req.usage(), existing, "用途"));
        d.put("性格", req.traits() != null ? req.traits() : (existing != null ? existing.getOrDefault("性格", List.of()) : List.of()));
        d.put("服饰", pick(req.outfit(), existing, "服饰"));
        d.put("形象来源", "AI 原创虚构");
        d.put("设定语", pick(req.persona(), existing, "设定语"));
        return d;
    }

    private static Object pick(String incoming, Map<String, Object> existing, String key) {
        if (incoming != null) return incoming;
        if (existing != null && existing.get(key) != null) return existing.get(key);
        return "";
    }

    // ── 形象图上传 → OSS（§4.7：存 key，URL 由 signer 派生）────────

    /** 运营上传一张形象图，返回 { key, url }。key 写进 upsert 请求的 frontKey/rightKey/leftKey。 */
    public Map<String, String> uploadImage(org.springframework.web.multipart.MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("DAP_UPLOAD_EMPTY", "未收到图片文件");
        }
        String ct = file.getContentType();
        if (ct == null || !ct.startsWith("image/")) {
            throw BusinessException.badRequest("DAP_UPLOAD_NOT_IMAGE", "仅支持上传图片");
        }
        FileStorageService.StoredFile stored = storage.store(file, "dap/plaza", null);
        Map<String, String> out = new LinkedHashMap<>();
        out.put("key", stored.key());
        out.put("url", stored.signedUrl() != null ? stored.signedUrl() : stored.url());
        return out;
    }
}
