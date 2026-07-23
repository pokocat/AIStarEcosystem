package com.aistareco.aep.service;

import com.aistareco.aep.config.DramaConfigSeeder;
import com.aistareco.aep.model.DramaCharacter;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.model.DramaScene;
import com.aistareco.aep.repository.DramaCharacterRepository;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.repository.DramaSceneRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 短剧角色 / 场景实体化 + 多角度参考图集服务（C-2 一致性引擎 L0）。
 *
 * <p>注意：与 {@link DramaAssetService}（用户素材库 drama_assets）不同——本服务管的是项目内
 * 角色（drama_character）/ 场景（drama_scene）实体及其结构化参考图集。
 *
 * 四件事：
 *   1. 懒回填（read 时）：老项目 payloadJson.characters/scenes 无实体行 → 建实体（幂等闸=项目实体行是否存在）；
 *      单图 refCdnKey → refImages[0]{angle:front} 迁移。
 *   2. 双写（write 时）：saveProject 落 payloadJson 后，把 data.characters/scenes upsert 到实体表（增/改名/软删对齐）。
 *      <b>§6.1 纪律：只 upsert 实体表，不重写 payloadJson</b>（实体是独立行，天然避开文档级 LWW，收敛并发面）。
 *   3. 出 wire overlay（read 时）：把实体表的 refImages（cdnKey 真值 → signer 派生 url）叠加进返回文档，
 *      让前端看到三视图产物——三视图端点只写实体表，不改文档。
 *   4. 三视图端点：角色一键生成 正/侧/全身 参考图，hold→逐角度 commit→部分失败 release（§4.3）。
 */
@Service
public class DramaReferenceAssetService {

    private static final Logger log = LoggerFactory.getLogger(DramaReferenceAssetService.class);
    private static final String REF_TYPE_CHAR_SHEET = "DRAMA_CHAR_SHEET";
    private static final List<String> DEFAULT_ANGLES = List.of("front", "side", "full");

    private final DramaProjectRepository projectRepo;
    private final DramaCharacterRepository charRepo;
    private final DramaSceneRepository sceneRepo;
    private final DramaRenderService renderService;
    private final CreditService creditService;
    private final PlatformConfigService configs;
    private final CdnUrlSigner signer;
    private final ObjectMapper om;

    public DramaReferenceAssetService(DramaProjectRepository projectRepo,
                                      DramaCharacterRepository charRepo,
                                      DramaSceneRepository sceneRepo,
                                      DramaRenderService renderService,
                                      CreditService creditService,
                                      PlatformConfigService configs,
                                      CdnUrlSigner signer,
                                      ObjectMapper om) {
        this.projectRepo = projectRepo;
        this.charRepo = charRepo;
        this.sceneRepo = sceneRepo;
        this.renderService = renderService;
        this.creditService = creditService;
        this.configs = configs;
        this.signer = signer;
        this.om = om;
    }

    // ── 懒回填（read 时） ──────────────────────────────────────────────────────────

    /**
     * 若该项目还没有角色/场景实体行且文档非空 → 从文档建实体。幂等：以「项目实体行是否存在」为闸
     * （含软删，建过就不再建）。跑两次不重复建。
     */
    @Transactional
    public void ensureBackfilled(String projectId, String ownerUserId, JsonNode data) {
        if (projectId == null || projectId.isBlank() || data == null) return;
        OffsetDateTime now = OffsetDateTime.now();
        if (!charRepo.existsByProjectId(projectId)) {
            JsonNode chars = data.path("characters");
            if (chars.isArray()) {
                for (JsonNode c : chars) {
                    if (c.isObject()) charRepo.save(charFromDoc(projectId, ownerUserId, c, now));
                }
            }
        }
        if (!sceneRepo.existsByProjectId(projectId)) {
            JsonNode scenes = data.path("scenes");
            if (scenes.isArray()) {
                for (JsonNode s : scenes) {
                    if (s.isObject()) sceneRepo.save(sceneFromDoc(projectId, ownerUserId, s, now));
                }
            }
        }
    }

    // ── 双写（write 时）：只 upsert 实体表，不重写 payloadJson（§6.1） ────────────────

    /** saveProject 落文档后调用：把 data.characters/scenes upsert 到实体表，文档缺失的行软删对齐。 */
    @Transactional
    public void syncFromDoc(String projectId, String ownerUserId, JsonNode data) {
        if (projectId == null || projectId.isBlank() || data == null) return;
        OffsetDateTime now = OffsetDateTime.now();
        syncCharacters(projectId, ownerUserId, data.path("characters"), now);
        syncScenes(projectId, ownerUserId, data.path("scenes"), now);
    }

    private void syncCharacters(String projectId, String ownerUserId, JsonNode chars, OffsetDateTime now) {
        Map<String, DramaCharacter> existing = new LinkedHashMap<>();
        for (DramaCharacter e : charRepo.findByProjectId(projectId)) existing.put(e.getId(), e);
        Set<String> seen = new LinkedHashSet<>();
        if (chars.isArray()) {
            for (JsonNode c : chars) {
                if (!c.isObject()) continue;
                String id = text(c, "id");
                if (id == null || id.isBlank()) continue;
                seen.add(id);
                DramaCharacter e = existing.get(id);
                if (e == null) {
                    e = new DramaCharacter();
                    e.setId(id);
                    e.setProjectId(projectId);
                    e.setCreatedAt(now);
                }
                e.setOwnerUserId(ownerUserId);
                e.setName(text(c, "name"));
                e.setRole("key".equals(text(c, "role")) ? "key" : "extra");
                e.setCast(text(c, "cast"));
                e.setDapAvatarId(text(c, "avatarId"));
                applyRefImagesFromDoc(c, e);
                e.setDeletedAt(null);
                e.setUpdatedAt(now);
                charRepo.save(e);
            }
        }
        for (DramaCharacter e : existing.values()) {
            if (!seen.contains(e.getId()) && e.getDeletedAt() == null) {
                e.setDeletedAt(now);
                e.setUpdatedAt(now);
                charRepo.save(e);
            }
        }
    }

    private void syncScenes(String projectId, String ownerUserId, JsonNode scenes, OffsetDateTime now) {
        Map<String, DramaScene> existing = new LinkedHashMap<>();
        for (DramaScene e : sceneRepo.findByProjectId(projectId)) existing.put(e.getId(), e);
        Set<String> seen = new LinkedHashSet<>();
        if (scenes.isArray()) {
            for (JsonNode s : scenes) {
                if (!s.isObject()) continue;
                String id = text(s, "id");
                if (id == null || id.isBlank()) continue;
                seen.add(id);
                DramaScene e = existing.get(id);
                if (e == null) {
                    e = new DramaScene();
                    e.setId(id);
                    e.setProjectId(projectId);
                    e.setCreatedAt(now);
                }
                e.setOwnerUserId(ownerUserId);
                e.setName(text(s, "name"));
                e.setMood(text(s, "mood"));
                applySceneRefImagesFromDoc(s, e);
                e.setDeletedAt(null);
                e.setUpdatedAt(now);
                sceneRepo.save(e);
            }
        }
        for (DramaScene e : existing.values()) {
            if (!seen.contains(e.getId()) && e.getDeletedAt() == null) {
                e.setDeletedAt(now);
                e.setUpdatedAt(now);
                sceneRepo.save(e);
            }
        }
    }

    /** 项目物理删除时清角色/场景实体行（对齐 purgeProject）。 */
    @Transactional
    public void purgeByProject(String projectId) {
        if (projectId == null || projectId.isBlank()) return;
        List<DramaCharacter> chars = charRepo.findByProjectId(projectId);
        if (!chars.isEmpty()) charRepo.deleteAll(chars);
        List<DramaScene> scenes = sceneRepo.findByProjectId(projectId);
        if (!scenes.isEmpty()) sceneRepo.deleteAll(scenes);
    }

    // ── 出 wire overlay（read 时） ────────────────────────────────────────────────

    /**
     * 把实体表的 refImages 叠加进返回文档的 characters/scenes（cdnKey → signer 派生 url）。
     * 三视图端点只写实体表、不改文档，靠这层让前端看到产物；前端拿到 refImages 后回 PUT，saveProject
     * 双写把它带回实体（round-trip 不丢）。
     */
    public void overlayEntityRefs(String projectId, JsonNode data) {
        if (projectId == null || projectId.isBlank() || data == null || !data.isObject()) return;
        Map<String, DramaCharacter> chars = new LinkedHashMap<>();
        for (DramaCharacter e : charRepo.findByProjectIdAndDeletedAtIsNull(projectId)) chars.put(e.getId(), e);
        if (!chars.isEmpty()) {
            for (JsonNode c : data.path("characters")) {
                if (!c.isObject()) continue;
                DramaCharacter e = chars.get(c.path("id").asText(""));
                if (e != null && e.getRefImagesJson() != null && !e.getRefImagesJson().isBlank()) {
                    ((ObjectNode) c).set("refImages", signRefImages(e.getRefImagesJson()));
                }
            }
        }
        Map<String, DramaScene> scenes = new LinkedHashMap<>();
        for (DramaScene e : sceneRepo.findByProjectIdAndDeletedAtIsNull(projectId)) scenes.put(e.getId(), e);
        if (!scenes.isEmpty()) {
            for (JsonNode s : data.path("scenes")) {
                if (!s.isObject()) continue;
                DramaScene e = scenes.get(s.path("id").asText(""));
                if (e != null && e.getRefImagesJson() != null && !e.getRefImagesJson().isBlank()) {
                    ((ObjectNode) s).set("refImages", signRefImages(e.getRefImagesJson()));
                }
            }
        }
    }

    // ── 三视图端点 ───────────────────────────────────────────────────────────────

    /**
     * 角色一键生成多角度参考图（默认 正/侧/全身）。body:{ angles?:[front|side|full], ratio?, appearanceHint? }
     * → { characterId, refImages:[{cdnKey,url,angle,label}], cost }。
     *
     * 计费 hold→commit（§4.3）：hold 总额 = frameCost×角度数；逐角度成功即 commit(frameCost)；某角度失败 →
     * 已成功保留、剩余 release；全失败 → release 全额 + 抛错。§8.0：端点/提示词未配 → 503（preflight 在
     * hold 前，故不 hold、不扣费）。产物只写实体表（§6.1 不重写 payloadJson），出 wire 由 overlay/本方法派生。
     */
    public JsonNode generateReferenceSheet(String projectId, String charId, JsonNode body, String ownerUserId) {
        DramaProject row = projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(projectId, ownerUserId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_PROJECT_NOT_FOUND", "短剧项目不存在"));
        JsonNode data = readPayload(row);
        ensureBackfilled(projectId, ownerUserId, data);

        DramaCharacter ch = charRepo.findByIdAndProjectIdAndDeletedAtIsNull(charId, projectId).orElse(null);
        if (ch == null) {
            JsonNode docChar = findDocChar(data, charId);
            if (docChar == null) {
                throw new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_CHARACTER_NOT_FOUND", "角色不存在");
            }
            ch = charFromDoc(projectId, ownerUserId, docChar, OffsetDateTime.now());
            charRepo.save(ch);
        }

        List<String> angles = parseAngles(body);
        // §8.0：hold 之前做端点/提示词/配额前置校验（未配 503，不 hold、不扣费）。
        renderService.preflightCharacterReferenceSheet(ownerUserId);

        long frameCost = configs.getLong(DramaConfigSeeder.KEY_FRAME, 2);
        long total = frameCost * angles.size();
        String ratio = orDefault(text(body, "ratio"), orDefault(text(data.path("projectInfo"), "ratio"), "9:16"));
        String appearanceHint = text(body, "appearanceHint");
        List<String> lockRefs = lockRefsFor(ch);

        String ref = "cs_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        creditService.hold(ownerUserId, total, REF_TYPE_CHAR_SHEET, ref,
                "角色三视图（" + orDefault(ch.getName(), "角色") + "）");

        ArrayNode refImages = readRefImages(ch.getRefImagesJson());
        int committed = 0;
        RuntimeException lastErr = null;
        for (String angle : angles) {
            try {
                String cdnKey = renderService.renderCharacterReferenceFrame(
                        ownerUserId, charVars(ch, angle, appearanceHint), ratio, lockRefs);
                creditService.commitHold(REF_TYPE_CHAR_SHEET, ref, frameCost, "角色三视图 · " + angleLabel(angle));
                // 只在 commitHold 真成功之后才落 refImages：commitHold 也在 try 块内、也会抛异常
                // （见下方 catch 注释），先前的实现在 render 成功后就无条件 addObject，一旦随后
                // commitHold 失败（未提交扣费、已 release），这条「未付费」的图仍会残留在数组里，
                // 连同旧图一起被 removeExistingAngle 顶替——用户白得一张图、账本上却退了款。
                // 「重新生成」同一角度时替换旧图而非无限追加：frontRefUrl/firstRefUrl 按插入顺序取首个
                // 匹配角度，追加不替换会导致新图永远排在旧图之后、被扣费却从未被参考装配实际使用，
                // 图库缩略图也会无限膨胀。仅在本角度真正完成扣费后才移除旧图，失败时保留旧图作为兜底。
                removeExistingAngle(refImages, angle);
                ObjectNode r = refImages.addObject();
                r.put("cdnKey", cdnKey);
                r.put("angle", angle);
                r.put("label", angleLabel(angle));
                committed++;
            } catch (RuntimeException e) {
                // commitHold 抛的是 ResponseStatusException（非 BusinessException 子类），
                // 之前只捕 BusinessException 会让 commitHold 失败直接跳过下面的 release，
                // 冻结的 pendingBalance 只能等 CreditHoldSweeper 兜底（默认 180 分钟才释放）。
                lastErr = e;
                break; // 停在首个失败角度；剩余在下方 release
            }
        }
        if (committed < angles.size()) {
            try {
                creditService.releaseHold(REF_TYPE_CHAR_SHEET, ref, "角色三视图 · 剩余释放");
            } catch (Exception ignore) { /* 释放失败仅记账问题，不掩盖原始错误 */ }
        }
        if (committed == 0) {
            throw lastErr != null ? lastErr
                    : new BusinessException(HttpStatus.BAD_GATEWAY, "REFERENCE_SHEET_FAILED", "角色三视图生成失败，请稍后重试。");
        }

        // §6.1：产物只写实体表，不回写 payloadJson。
        ch.setRefImagesJson(write(refImages));
        ch.setUpdatedAt(OffsetDateTime.now());
        charRepo.save(ch);
        log.info("[drama-ref-asset] reference-sheet ok user={} project={} char={} produced={}/{}",
                ownerUserId, projectId, ch.getId(), committed, angles.size());

        ObjectNode out = om.createObjectNode();
        out.put("characterId", ch.getId());
        out.set("refImages", signRefImages(ch.getRefImagesJson()));
        out.put("cost", frameCost * committed);
        return out;
    }

    // ── 文档 → 实体映射 ─────────────────────────────────────────────────────────

    private DramaCharacter charFromDoc(String projectId, String ownerUserId, JsonNode c, OffsetDateTime now) {
        String id = text(c, "id");
        if (id == null || id.isBlank()) id = "ch_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        DramaCharacter e = DramaCharacter.builder()
                .id(id)
                .projectId(projectId)
                .ownerUserId(ownerUserId)
                .name(text(c, "name"))
                .role("key".equals(text(c, "role")) ? "key" : "extra")
                .cast(text(c, "cast"))
                .dapAvatarId(text(c, "avatarId"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        applyRefImagesFromDoc(c, e);
        return e;
    }

    private DramaScene sceneFromDoc(String projectId, String ownerUserId, JsonNode s, OffsetDateTime now) {
        String id = text(s, "id");
        if (id == null || id.isBlank()) id = "scn_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        DramaScene e = DramaScene.builder()
                .id(id)
                .projectId(projectId)
                .ownerUserId(ownerUserId)
                .name(text(s, "name"))
                .mood(text(s, "mood"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        applySceneRefImagesFromDoc(s, e);
        return e;
    }

    /** refImages 安全合并：文档带 refImages（非空）→ 覆盖；否则单图 refCdnKey→refImages[0]，
     *  再否则保留实体已有（防旧前端 PUT 抹掉三视图产物）。 */
    private void applyRefImagesFromDoc(JsonNode c, DramaCharacter e) {
        JsonNode refIn = c.path("refImages");
        if (refIn.isArray() && refIn.size() > 0) {
            e.setRefImagesJson(write(normalizeRefImages(refIn)));
            return;
        }
        String legacyKey = text(c, "refCdnKey");
        if ((e.getRefImagesJson() == null || e.getRefImagesJson().isBlank())
                && legacyKey != null && !legacyKey.isBlank()) {
            ArrayNode arr = om.createArrayNode();
            ObjectNode r = arr.addObject();
            r.put("cdnKey", legacyKey);
            r.put("angle", "front");
            e.setRefImagesJson(write(arr));
        }
    }

    private void applySceneRefImagesFromDoc(JsonNode s, DramaScene e) {
        JsonNode refIn = s.path("refImages");
        if (refIn.isArray() && refIn.size() > 0) {
            e.setRefImagesJson(write(normalizeRefImages(refIn)));
            return;
        }
        String legacyKey = text(s, "refCdnKey");
        if ((e.getRefImagesJson() == null || e.getRefImagesJson().isBlank())
                && legacyKey != null && !legacyKey.isBlank()) {
            ArrayNode arr = om.createArrayNode();
            ObjectNode r = arr.addObject();
            r.put("cdnKey", legacyKey);
            r.put("angle", "env");
            e.setRefImagesJson(write(arr));
        }
    }

    /** 归一化 refImages 入库形态：只留有 cdnKey 的项（cdnKey 是真值；url 出 wire 派生，不入库）。 */
    private ArrayNode normalizeRefImages(JsonNode refIn) {
        ArrayNode out = om.createArrayNode();
        if (refIn == null || !refIn.isArray()) return out;
        for (JsonNode r : refIn) {
            if (!r.isObject()) continue;
            String cdnKey = text(r, "cdnKey");
            if (cdnKey == null || cdnKey.isBlank()) continue; // url-only 项丢弃（overlay 会从 cdnKey 派生）
            ObjectNode o = out.addObject();
            o.put("cdnKey", cdnKey);
            String angle = text(r, "angle");
            if (angle != null && !angle.isBlank()) o.put("angle", angle);
            String label = text(r, "label");
            if (label != null && !label.isBlank()) o.put("label", label);
        }
        return out;
    }

    // ── 三视图 prompt vars / 锁脸参考 ───────────────────────────────────────────

    private Map<String, String> charVars(DramaCharacter ch, String angle, String appearanceHint) {
        StringBuilder desc = new StringBuilder();
        if (ch.getCast() != null && !ch.getCast().isBlank()) desc.append("选角：").append(ch.getCast()).append("。");
        if (appearanceHint != null && !appearanceHint.isBlank()) desc.append(appearanceHint).append("。");
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("name", orDefault(ch.getName(), "角色"));
        vars.put("descClause", desc.length() > 0 ? "外貌/设定：" + desc + " " : "");
        vars.put("angleClause", anglePromptClause(angle) + " ");
        vars.put("styleSuffix", "");
        return vars;
    }

    /** 锁脸参考：角色已有定妆图集（cdnKey → 签名 url）。本地/相对 URL 由渲染层过滤，仅生产 OSS 生效。 */
    private List<String> lockRefsFor(DramaCharacter ch) {
        List<String> out = new ArrayList<>();
        for (JsonNode r : readRefImages(ch.getRefImagesJson())) {
            String cdnKey = text(r, "cdnKey");
            if (cdnKey != null && !cdnKey.isBlank()) {
                String url = signer.signKey(cdnKey);
                if (url != null && !url.isBlank()) out.add(url);
            }
        }
        return out;
    }

    private static String angleLabel(String angle) {
        return switch (angle == null ? "" : angle) {
            case "side" -> "侧面";
            case "full" -> "全身";
            case "front" -> "正面";
            default -> angle;
        };
    }

    private static String anglePromptClause(String angle) {
        return switch (angle == null ? "" : angle) {
            case "side" -> "拍摄角度：侧面 / 四分之三侧脸半身肖像，清晰面部轮廓。";
            case "full" -> "拍摄角度：全身站姿，完整服装与鞋子，头到脚可见。";
            case "front" -> "拍摄角度：正面全脸半身肖像，五官清晰、平视镜头。";
            default -> "拍摄角度：正面全脸半身肖像。";
        };
    }

    private List<String> parseAngles(JsonNode body) {
        JsonNode in = body == null ? null : body.get("angles");
        if (in == null || !in.isArray() || in.size() == 0) return DEFAULT_ANGLES;
        List<String> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (JsonNode a : in) {
            String v = a.asText("").trim();
            if ((v.equals("front") || v.equals("side") || v.equals("full")) && seen.add(v)) out.add(v);
        }
        return out.isEmpty() ? DEFAULT_ANGLES : out;
    }

    // ── 工具 ─────────────────────────────────────────────────────────────────────

    private static JsonNode findDocChar(JsonNode data, String charId) {
        for (JsonNode c : data.path("characters")) {
            if (c.isObject() && charId.equals(c.path("id").asText(null))) return c;
        }
        return null;
    }

    /** 移除数组中已有的同角度条目（倒序遍历避免 remove 后索引错位）。 */
    private void removeExistingAngle(ArrayNode arr, String angle) {
        for (int i = arr.size() - 1; i >= 0; i--) {
            JsonNode r = arr.get(i);
            if (r.isObject() && angle.equals(text(r, "angle"))) {
                arr.remove(i);
            }
        }
    }

    private ArrayNode readRefImages(String json) {
        if (json == null || json.isBlank()) return om.createArrayNode();
        try {
            JsonNode n = om.readTree(json);
            return n.isArray() ? (ArrayNode) n : om.createArrayNode();
        } catch (Exception e) {
            return om.createArrayNode();
        }
    }

    /** cdnKey 真值 → { cdnKey, url(signKey), angle?, label? }（出 wire）。 */
    private ArrayNode signRefImages(String json) {
        ArrayNode out = om.createArrayNode();
        for (JsonNode r : readRefImages(json)) {
            if (!r.isObject()) continue;
            String cdnKey = text(r, "cdnKey");
            if (cdnKey == null || cdnKey.isBlank()) continue;
            ObjectNode o = out.addObject();
            o.put("cdnKey", cdnKey);
            o.put("url", signer.signKey(cdnKey));
            String angle = text(r, "angle");
            if (angle != null && !angle.isBlank()) o.put("angle", angle);
            String label = text(r, "label");
            if (label != null && !label.isBlank()) o.put("label", label);
        }
        return out;
    }

    private JsonNode readPayload(DramaProject row) {
        try {
            return row.getPayloadJson() != null ? om.readTree(row.getPayloadJson()) : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
    }

    private String write(JsonNode node) {
        try {
            return om.writeValueAsString(node);
        } catch (Exception e) {
            return "[]";
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }
}
