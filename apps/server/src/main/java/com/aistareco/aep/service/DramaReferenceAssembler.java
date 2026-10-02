package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaCharacter;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.model.DramaScene;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.model.StorageAsset;
import com.aistareco.aep.repository.DramaCharacterRepository;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.repository.DramaSceneRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.repository.StorageAssetRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 短剧「服务端参考装配」（C-3 一致性引擎 L1）。
 *
 * <p>把此前散落在前端 {@code epscript.tsx:shotRefImages} 的优先级链（@cast → 文本名兜底 → 全员；
 * 场景参考；同场上一镜真实末帧）下沉服务端：按 render body 里的 {@code shot_ref}（服务端自装配）/
 * {@code ref_slots}（前端已算好槽位）/ {@code ref_images}（C-1 过渡兼容数组）三级入参装配真实资产，
 * 按端点 capability（D-11）裁剪并如实回报 {@code applied_refs}（复用 C-1 结构，role 升级为精确槽位）。
 *
 * <p><b>纪律（AGENTS §6.1）：只读文档 / 实体，绝不回写 payloadJson</b>（不新增服务端文档写者，收敛并发面）。
 * <b>§8.0</b>：dev 本地 {@code /cdn} 参考如实标 {@code local_unfetchable}，不静默丢弃。
 *
 * <p>优先级链数据来源（对照前端 shotRefImages）：
 * <ul>
 *   <li>角色参考图：{@code drama_character.refImages}（C-2 实体，angle=front 优先）→ 实体缺失兜底文档 {@code avatarImage/refUrl}</li>
 *   <li>场景参考图：{@code drama_scene.refImages}（显式 sceneRefId 优先）→ 兜底文档 {@code scenes[].refUrl}（名称匹配）</li>
 *   <li>同场上一镜真实末帧：文档 {@code lastFrameUrl ?? frameUrl} 优先 + {@link MaterialVideoJob} 权威回退
 *       （读 C-1 的 {@code lastFrameCdnKey}→signKey，不用会过期的 lastFrameUrl）</li>
 * </ul>
 * 裁剪优先级保 identity：character_refs &gt; scene_ref &gt; prev_last_frame（末位先砍）。
 */
@Service
public class DramaReferenceAssembler {

    private static final Logger log = LoggerFactory.getLogger(DramaReferenceAssembler.class);

    private final DramaProjectRepository projectRepo;
    private final DramaCharacterRepository charRepo;
    private final DramaSceneRepository sceneRepo;
    private final MaterialVideoJobRepository videoJobRepo;
    private final StorageAssetRepository storageAssetRepo;
    private final CdnUrlSigner signer;
    private final ObjectMapper om;

    public DramaReferenceAssembler(DramaProjectRepository projectRepo,
                                   DramaCharacterRepository charRepo,
                                   DramaSceneRepository sceneRepo,
                                   MaterialVideoJobRepository videoJobRepo,
                                   StorageAssetRepository storageAssetRepo,
                                   CdnUrlSigner signer,
                                   ObjectMapper om) {
        this.projectRepo = projectRepo;
        this.charRepo = charRepo;
        this.sceneRepo = sceneRepo;
        this.videoJobRepo = videoJobRepo;
        this.storageAssetRepo = storageAssetRepo;
        this.signer = signer;
        this.om = om;
    }

    // ── 对外契约 ─────────────────────────────────────────────────────────────────

    /**
     * capability 未显式配置（D-11 candidate 字段为 null）时的 legacy 兼容默认参考图上限 = 6，
     * 等于 v0.97 前端 `shotRefImages` 的 `slice(0,6)` 既有上限（agnes-image 等已验证的行为）。
     * 不用「保守默认 1」——D-11 seeder 回填的存量候选 capability 全 null，按 1 会让升级当天
     * 所有默认端点的多参考一致性（角色+场景+镜间承接）被整体削弱，与一致性引擎目标相悖。
     */
    public static final int LEGACY_MAX_REF_IMAGES = 6;

    /**
     * 消费方（端点 capability）画像。字段由调用方按「显式配置最高优先」解析：maxRefImages null →
     * {@link #LEGACY_MAX_REF_IMAGES}（legacy 兼容默认）；supportsFirstLastFrame null → C-1 协议关键字
     * 静态判定（{@code DramaRenderService.supportsFirstLastFrame}：seedance/generic 支持、agnes 仅首帧）。
     *
     * <p>{@code firstFrameByStorageKey}：端点收首帧只认我方存储 key、不收 URL（聚算媒体协议，
     * 由 {@code MaterialVideoJobService#firstFrameNeedsStorageKey} 判定）。为 true 时首帧「送没送到」
     * 不看 URL 抓不抓得到，只看派不派得出本人的 key（2026-09-30 热修）。
     */
    public record Capability(int maxRefImages, boolean supportsFirstLastFrame, boolean supportsSubjectReference,
                             boolean firstFrameByStorageKey) {
        /** 首帧出图 / 走 URL 的出片协议：首帧按 URL 送达。 */
        public Capability(int maxRefImages, boolean supportsFirstLastFrame, boolean supportsSubjectReference) {
            this(maxRefImages, supportsFirstLastFrame, supportsSubjectReference, false);
        }
    }

    /** 首帧装配结果：imageRefs 送 {@code extra_body.image[]}；appliedRefs 回报「参考 N/M 生效」。 */
    public record FrameAssembly(List<String> imageRefs, ObjectNode appliedRefs) {}

    /**
     * 视频装配结果：first/last 帧拼进 prompt（下游按协议抽取）；appliedRefs 回报首尾帧是否生效。
     * {@code firstFrameKey}：仅「首帧只认 key」的协议才派生，且已确认归属本人；其余情况为 null。
     */
    public record ClipAssembly(String firstFrameUrl, String lastFrameUrl, String firstFrameKey, ObjectNode appliedRefs) {}

    /** 首帧不在我方存储里（外链 / 上游临时地址 / dev 相对路径），派不出 key、传不上去。wire 全小写。 */
    static final String REASON_NOT_IN_STORAGE = "not_in_storage";

    /** 一条参考项归类：精确槽位 role + 是否送达模型 + 未送达原因（wire 全小写枚举）。 */
    record AppliedRef(String role, String url, boolean applied, String reason) {}

    /** 装配前的有序候选（role 已定，按裁剪优先级排列）。 */
    record Candidate(String role, String url) {}

    // ── 首帧装配 ─────────────────────────────────────────────────────────────────

    /**
     * 首帧图像参考装配。三级入参优先级：{@code shot_ref} &gt; {@code ref_slots} &gt; {@code ref_images}。
     * {@code ref_leading}（如拆镜末帧出图的本镜首帧锚）永远置顶（role=first_frame）。
     */
    public FrameAssembly assembleFrame(JsonNode body, String ownerUserId, Capability cap) {
        List<Candidate> ordered = new ArrayList<>();
        // ref_leading：调用方显式置顶的锚点（如 decompose 用本镜首帧作末帧出图的一致性锚），最高优先级。
        JsonNode leading = body == null ? null : body.get("ref_leading");
        if (leading != null && leading.isArray()) {
            for (JsonNode n : leading) {
                String u = maybeSign(asText(n));
                if (u != null && !u.isBlank()) ordered.add(new Candidate("first_frame", u));
            }
        }
        JsonNode shotRef = body == null ? null : body.get("shot_ref");
        JsonNode refSlots = body == null ? null : body.get("ref_slots");
        if (shotRef != null && shotRef.isObject()) {
            ordered.addAll(frameCandidatesFromShotRef(shotRef, ownerUserId));
        } else if (refSlots != null && refSlots.isObject()) {
            ordered.addAll(frameCandidatesFromSlots(refSlots));
        } else {
            JsonNode refImages = body == null ? null : body.get("ref_images");
            if (refImages != null && refImages.isArray()) {
                for (JsonNode n : refImages) {
                    String u = asText(n);
                    if (u != null && !u.isBlank()) ordered.add(new Candidate("ref", u));
                }
            }
        }
        List<AppliedRef> classified = classifyImageRefs(ordered, cap.maxRefImages());
        List<String> imageRefs = classified.stream().filter(AppliedRef::applied).map(AppliedRef::url).toList();
        return new FrameAssembly(imageRefs, appliedRefsJson(classified));
    }

    private List<Candidate> frameCandidatesFromShotRef(JsonNode shotRef, String ownerUserId) {
        List<Candidate> out = new ArrayList<>();
        String projectId = asText(shotRef.get("project_id"));
        if (projectId == null || projectId.isBlank()) return out;
        DramaProject row = projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(projectId, ownerUserId).orElse(null);
        if (row == null) return out;
        JsonNode data = readPayload(row);
        int episodeNo = shotRef.path("episode_no").asInt(1);
        String sceneId = asText(shotRef.get("scene_id"));
        String shotId = asText(shotRef.get("shot_id"));
        boolean chain = shotRef.path("chain_consistency").asBoolean(false);
        JsonNode shot = locateShot(data, episodeNo, sceneId, shotId);

        // 角色参考：@cast 优先；空 → 画面文本名兜底；仍空 → 本项目全体有形象角色。
        for (String url : characterRefUrls(projectId, data, shot)) out.add(new Candidate("character", url));
        if (chain) {
            String sceneRef = sceneRefUrl(projectId, data, sceneId);
            if (sceneRef != null && !sceneRef.isBlank()) out.add(new Candidate("scene", sceneRef));
            String prev = prevLastFrameInScene(ownerUserId, projectId, data, episodeNo, sceneId, shotId);
            if (prev != null && !prev.isBlank()) out.add(new Candidate("prev_last_frame", prev));
        }
        return out;
    }

    private List<Candidate> frameCandidatesFromSlots(JsonNode slots) {
        List<Candidate> out = new ArrayList<>();
        JsonNode chars = slots.get("character_refs");
        if (chars != null && chars.isArray()) {
            for (JsonNode c : chars) {
                String u = slotUrl(c);
                if (u != null && !u.isBlank()) out.add(new Candidate("character", u));
            }
        }
        String scene = slotUrl(slots.get("scene_ref"));
        if (scene != null && !scene.isBlank()) out.add(new Candidate("scene", scene));
        String prev = slotUrl(slots.get("prev_last_frame"));
        if (prev != null && !prev.isBlank()) out.add(new Candidate("prev_last_frame", prev));
        return out;
    }

    // ── 视频装配 ─────────────────────────────────────────────────────────────────

    /**
     * 视频首/末帧装配。{@code shot_ref} 时服务端派生：first = body.frame_url（本镜已锁首帧）
     * ?? 文档本镜 frameUrl ?? （链式）同场上一镜真实末帧；last = body.last_frame_url（本镜末帧）
     * ?? 文档 endFrameUrl ?? （链式）同场下一镜开场首帧。无 shot_ref 时退回显式 frame_url/last_frame_url。
     */
    public ClipAssembly assembleClip(JsonNode body, String ownerUserId, Capability cap) {
        String firstFrame = maybeSign(asText(body == null ? null : body.get("frame_url")));
        String lastFrame = maybeSign(asText(body == null ? null : body.get("last_frame_url")));
        JsonNode shotRef = body == null ? null : body.get("shot_ref");
        if (shotRef != null && shotRef.isObject()) {
            String projectId = asText(shotRef.get("project_id"));
            DramaProject row = projectId == null || projectId.isBlank() ? null
                    : projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(projectId, ownerUserId).orElse(null);
            if (row != null) {
                JsonNode data = readPayload(row);
                int episodeNo = shotRef.path("episode_no").asInt(1);
                String sceneId = asText(shotRef.get("scene_id"));
                String shotId = asText(shotRef.get("shot_id"));
                boolean chain = shotRef.path("chain_consistency").asBoolean(false);
                JsonNode shot = locateShot(data, episodeNo, sceneId, shotId);
                if (firstFrame == null || firstFrame.isBlank()) {
                    String own = shot == null ? null : firstNonBlank(
                            asText(shot.get("frameUrl")), firstArrayEl(shot.get("frameUrls")));
                    firstFrame = own != null ? maybeSign(own)
                            : (chain ? prevLastFrameInScene(ownerUserId, projectId, data, episodeNo, sceneId, shotId) : null);
                }
                if (lastFrame == null || lastFrame.isBlank()) {
                    String own = shot == null ? null : asText(shot.get("endFrameUrl"));
                    lastFrame = own != null ? maybeSign(own)
                            : (chain ? nextFirstFrameInScene(data, episodeNo, sceneId, shotId) : null);
                }
            }
        }
        boolean supportsFirstFrame = cap.maxRefImages() != 0;
        // 2026-09-30 热修：聚算 H3 的首帧不收 URL，只认 variant_config.first_frame_key。此前这里只拼了提示词标记，
        // 聚算分支把标记剥掉后首帧就没了，静默变成文生视频。现在由首帧 URL 反抽我方存储 key 并确认归属本人。
        // maxRefImages=0（后台明确标了「只开放文生视频」）时不派生，照旧如实回报 model_no_image_input。
        String firstFrameKey = null;
        if (cap.firstFrameByStorageKey() && supportsFirstFrame && firstFrame != null && !firstFrame.isBlank()) {
            firstFrameKey = requireOwnedFrameKey(ownerUserId, firstFrame);
        }
        List<AppliedRef> classified = classifyClipFrames(firstFrame, lastFrame,
                supportsFirstFrame, cap.supportsFirstLastFrame(), cap.firstFrameByStorageKey(), firstFrameKey);
        return new ClipAssembly(firstFrame, lastFrame, firstFrameKey, appliedRefsJson(classified));
    }

    // ── 首帧存储 key：派生 + 归属（2026-09-30 热修） ─────────────────────────────

    /**
     * 首帧 URL → 本人的存储 key。
     *
     * @return 归属已确认的 key（台账 / 任务行里记的那个，后续由 worker 读字节上传）；
     *         URL 不是我方存储（外链、上游临时地址、dev 相对路径）派不出 key → null，调用方如实回报未送达
     * @throws BusinessException 400 {@code DRAMA_FRAME_NOT_OWNED}：是我方存储的 key，但查不到属于本人。
     *         必须在冻结积分之前抛（renderClip 里本方法先于 videoJobs.submit）。
     */
    String requireOwnedFrameKey(String ownerUserId, String firstFrameUrl) {
        // 反抽 key 只用 signer 现成的能力：只认我方 CDN 域名，外链一律抽不出
        String key = signer.keyOf(firstFrameUrl);
        if (key == null || key.isBlank()) return null;
        String owned = ownedFrameKey(ownerUserId, key);
        if (owned == null) {
            log.warn("[drama-ref-assembler] 首帧不属于本人，拒绝交给出片模型 owner={} key={}",
                    ownerUserId, abbreviate(key));
            throw BusinessException.badRequest("DRAMA_FRAME_NOT_OWNED",
                    "这张首帧核对不到是你账号里的图片，没法交给所选的出片模型。请重新生成这一镜的首帧再试。");
        }
        return owned;
    }

    /**
     * 归属判定：key 必须是本人在短剧下记过账的资产，返回记账时的那个 key；查不到 → null。
     *
     * <p>两处真值，覆盖短剧首帧的全部来源：
     * <ul>
     *   <li>存储台账 {@code storage_assets(app=drama, owner)}：分镜首帧（{@code renderFrame}，含 AI 改图 / 拆镜末帧）、
     *       角色参考图、上传的参考图素材 —— 都在落 CDN 时 {@code StorageQuotaService.record} 记了 owner；</li>
     *   <li>短剧视频任务的真实末帧 {@code material_video_job.last_frame_cdn_key}（owner + 分区 drama）：
     *       承接上一镜末帧作首帧时用，末帧不进台账。</li>
     * </ul>
     *
     * <p>为什么比对「多个候选」：台账里记的是**不带** OSS key-prefix 的 key（{@code drama/frames/…}），
     * 而 {@code keyOf} 从 URL 抽出来的是**带**前缀的对象键（生产 {@code media/drama/frames/…}）；任务行里的
     * 末帧 key 又是带前缀的。所以拿「完整 key + 依次去掉开头每一段」去查，命中谁就用谁记的那个 key。
     * 不会放宽归属：命中的必须是 owner=本人 的行，用的也是那一行里服务端自己写的 key。
     */
    String ownedFrameKey(String ownerUserId, String key) {
        if (ownerUserId == null || ownerUserId.isBlank() || key == null || key.isBlank()) return null;
        String k = key.trim();
        // 形状不对的直接不认（openForRead 是 localDir + key 拼路径，`..` 这类必须挡在归属判定之前）
        if (k.startsWith("/") || k.contains("..") || k.contains("\\") || k.contains("\n") || k.contains("\r")) {
            return null;
        }
        List<String> candidates = keySuffixes(k);
        for (StorageAsset a : storageAssetRepo.findByAppAndOwnerUserIdAndCdnKeyIn(
                MaterialVideoJobService.APP_DRAMA, ownerUserId, candidates)) {
            if (a.getCdnKey() != null && !a.getCdnKey().isBlank()) return a.getCdnKey();
        }
        for (MaterialVideoJob j : videoJobRepo.findScopedByLastFrameCdnKeyIn(
                ownerUserId, MaterialVideoJobService.APP_DRAMA, candidates)) {
            if (j.getLastFrameCdnKey() != null && !j.getLastFrameCdnKey().isBlank()) return j.getLastFrameCdnKey();
        }
        return null;
    }

    /** {@code media/drama/frames/x.png} → [自身, {@code drama/frames/x.png}, {@code frames/x.png}]（不含裸文件名）。 */
    static List<String> keySuffixes(String key) {
        List<String> out = new ArrayList<>();
        out.add(key);
        int slash = key.indexOf('/');
        while (slash >= 0 && key.indexOf('/', slash + 1) >= 0) {
            out.add(key.substring(slash + 1));
            slash = key.indexOf('/', slash + 1);
        }
        return out;
    }

    private static String abbreviate(String s) {
        return s == null || s.length() <= 120 ? s : s.substring(0, 120) + "…";
    }

    // ── 优先级链数据来源 ──────────────────────────────────────────────────────────

    /** 角色参考图：@cast 优先 → 画面文本名兜底 → 本项目全体；每角色 refImages(front 优先)→兜底文档 avatarImage。 */
    private List<String> characterRefUrls(String projectId, JsonNode data, JsonNode shot) {
        List<DramaCharacter> entities = charRepo.findByProjectIdAndDeletedAtIsNull(projectId);
        Map<String, DramaCharacter> byId = new LinkedHashMap<>();
        for (DramaCharacter e : entities) byId.put(e.getId(), e);

        List<String> castIds = new ArrayList<>();
        if (shot != null) {
            JsonNode cast = shot.get("cast");
            if (cast != null && cast.isArray()) {
                for (JsonNode c : cast) {
                    String id = asText(c);
                    if (id != null && !id.isBlank()) castIds.add(id);
                }
            }
        }
        // cast 空 → 画面文本名兜底（对项目角色名做 desc/visual 包含匹配，避免塞错人）。
        if (castIds.isEmpty() && shot != null) {
            String visRaw = firstNonBlank(asText(shot.get("visual")), asText(shot.get("desc")));
            String vis = visRaw == null ? "" : visRaw;
            for (DramaCharacter e : entities) {
                String name = e.getName();
                if (name != null && name.length() >= 2 && vis.contains(name)) castIds.add(e.getId());
            }
            for (JsonNode c : data.path("characters")) {
                String name = asText(c.get("name"));
                String id = asText(c.get("id"));
                if (name != null && name.length() >= 2 && id != null && !castIds.contains(id) && vis.contains(name)) {
                    castIds.add(id);
                }
            }
        }

        List<String> urls = new ArrayList<>();
        for (String cid : castIds) {
            String url = characterRefUrl(byId.get(cid), findDocById(data.path("characters"), cid));
            if (url != null && !url.isBlank()) urls.add(url);
        }
        // 仍空 → 本项目全体有形象角色（尽量锁脸）。
        if (urls.isEmpty()) {
            for (DramaCharacter e : entities) {
                String url = characterRefUrl(e, findDocById(data.path("characters"), e.getId()));
                if (url != null && !url.isBlank()) urls.add(url);
            }
            if (urls.isEmpty()) {
                for (JsonNode c : data.path("characters")) {
                    String url = docCharacterImage(c);
                    if (url != null && !url.isBlank()) urls.add(url);
                }
            }
        }
        return dedup(urls);
    }

    /** 单角色参考 url：实体 refImages(front 优先)→signKey；实体缺 → 文档 avatarImage/refUrl(maybeSign)。 */
    private String characterRefUrl(DramaCharacter entity, JsonNode docChar) {
        if (entity != null) {
            String url = frontRefUrl(entity.getRefImagesJson());
            if (url != null && !url.isBlank()) return url;
        }
        return docCharacterImage(docChar);
    }

    private String docCharacterImage(JsonNode docChar) {
        if (docChar == null) return null;
        return maybeSign(firstNonBlank(asText(docChar.get("avatarImage")), asText(docChar.get("refUrl"))));
    }

    /** 场景参考：显式 sceneRefId → 实体 refImages / 文档 refUrl；否则文档场景名匹配 place 兜底。 */
    private String sceneRefUrl(String projectId, JsonNode data, String sceneId) {
        String sceneRefId = boundSceneRefId(data, sceneId);
        if (sceneRefId != null && !sceneRefId.isBlank()) {
            DramaScene entity = sceneRepo.findByIdAndProjectIdAndDeletedAtIsNull(sceneRefId, projectId).orElse(null);
            if (entity != null) {
                String url = firstRefUrl(entity.getRefImagesJson());
                if (url != null && !url.isBlank()) return url;
            }
            String docUrl = docSceneRefUrl(data, sceneRefId);
            if (docUrl != null && !docUrl.isBlank()) return docUrl;
        }
        // 名称兜底：ScriptScene.place 包含 SceneAsset.name。
        String place = scriptScenePlace(data, sceneId);
        if (place != null && !place.isBlank()) {
            for (JsonNode a : data.path("scenes")) {
                String name = asText(a.get("name"));
                if (name != null && name.length() >= 2 && place.contains(name)) {
                    String url = docSceneRefFrom(a);
                    if (url != null && !url.isBlank()) return url;
                }
            }
        }
        return null;
    }

    /** 同场上一镜真实末帧：文档优先（lastFrameUrl ?? frameUrl ?? frameUrls[0]）+ MaterialVideoJob 权威回退。 */
    private String prevLastFrameInScene(String ownerUserId, String projectId, JsonNode data,
                                        int episodeNo, String sceneId, String shotId) {
        JsonNode shots = sceneShots(data, episodeNo, sceneId);
        if (shots == null) return null;
        int idx = indexOfShot(shots, shotId);
        if (idx < 0) return null;
        for (int i = idx - 1; i >= 0; i--) {
            JsonNode prev = shots.get(i);
            String prevId = asText(prev.get("id"));
            String doc = firstNonBlank(asText(prev.get("lastFrameUrl")),
                    asText(prev.get("frameUrl")), firstArrayEl(prev.get("frameUrls")));
            if (doc != null && !doc.isBlank()) return maybeSign(doc);
            String job = jobLastFrame(ownerUserId, projectId, sceneId, prevId);
            if (job != null && !job.isBlank()) return job;
        }
        return null;
    }

    /** 同场下一镜开场首帧（作本镜视频尾帧，切镜更平滑）。 */
    private String nextFirstFrameInScene(JsonNode data, int episodeNo, String sceneId, String shotId) {
        JsonNode shots = sceneShots(data, episodeNo, sceneId);
        if (shots == null) return null;
        int idx = indexOfShot(shots, shotId);
        if (idx < 0) return null;
        for (int i = idx + 1; i < shots.size(); i++) {
            JsonNode next = shots.get(i);
            String f = firstNonBlank(asText(next.get("frameUrl")), firstArrayEl(next.get("frameUrls")));
            if (f != null && !f.isBlank()) return maybeSign(f);
        }
        return null;
    }

    /** MaterialVideoJob 权威回退：同场同镜 succeeded 任务最新一条，读 C-1 lastFrameCdnKey→signKey（不过期）。 */
    private String jobLastFrame(String ownerUserId, String projectId, String sceneId, String prevShotId) {
        if (prevShotId == null || prevShotId.isBlank()) return null;
        List<MaterialVideoJob> jobs = videoJobRepo
                .findScopedByScript(ownerUserId, MaterialVideoJobService.APP_DRAMA, projectId);
        for (MaterialVideoJob j : jobs) {
            if (!"succeeded".equals(j.getStatus())) continue;
            JsonNode vc = parse(j.getVariantConfigJson());
            if (vc == null) continue;
            if (!prevShotId.equals(asText(vc.get("shot_id")))) continue;
            if (sceneId != null && !sceneId.isBlank() && !sceneId.equals(asText(vc.get("scene_id")))) continue;
            String key = j.getLastFrameCdnKey();
            if (key != null && !key.isBlank()) return signer.signKey(key);
            String url = j.getLastFrameUrl();
            if (url != null && !url.isBlank()) return maybeSign(url);
        }
        return null;
    }

    // ── 文档定位工具 ──────────────────────────────────────────────────────────────

    /** episodeDocs[ep].storyboard.scenes[sceneId].shots[shotId]；缺 → 顶层 storyboard 兜底（老项目 / mock）。 */
    private JsonNode locateShot(JsonNode data, int episodeNo, String sceneId, String shotId) {
        JsonNode shots = sceneShots(data, episodeNo, sceneId);
        if (shots == null) return null;
        for (JsonNode sh : shots) {
            if (sh.isObject() && shotId != null && shotId.equals(asText(sh.get("id")))) return sh;
        }
        return null;
    }

    private JsonNode sceneShots(JsonNode data, int episodeNo, String sceneId) {
        JsonNode board = data.path("episodeDocs").path(String.valueOf(episodeNo)).path("storyboard");
        JsonNode shots = shotsOfScene(board, sceneId);
        if (shots != null) return shots;
        return shotsOfScene(data.path("storyboard"), sceneId); // 顶层 legacy 兜底
    }

    private JsonNode shotsOfScene(JsonNode storyboard, String sceneId) {
        JsonNode scenes = storyboard == null ? null : storyboard.path("scenes");
        if (scenes == null || !scenes.isArray()) return null;
        for (JsonNode sc : scenes) {
            if (sc.isObject() && sceneId != null && sceneId.equals(asText(sc.get("id")))) {
                JsonNode shots = sc.get("shots");
                return shots != null && shots.isArray() ? shots : null;
            }
        }
        return null;
    }

    private static int indexOfShot(JsonNode shots, String shotId) {
        for (int i = 0; i < shots.size(); i++) {
            if (shotId != null && shotId.equals(text(shots.get(i), "id"))) return i;
        }
        return -1; // 未找到（如并发编辑期间 shotId 已失效）→ 调用方一律不装配参考图，不当作末位静默兜底
    }

    /** 本场绑定的 SceneAsset id：storyboard BoardScene.sceneRefId 优先，否则 script ScriptScene.sceneRefId。 */
    private String boundSceneRefId(JsonNode data, String sceneId) {
        for (JsonNode ed : iterEpisodeDocs(data)) {
            String id = sceneField(ed.path("storyboard"), sceneId, "sceneRefId");
            if (id != null) return id;
            id = sceneField(ed.path("script"), sceneId, "sceneRefId");
            if (id != null) return id;
        }
        String id = sceneField(data.path("storyboard"), sceneId, "sceneRefId");
        if (id != null) return id;
        return sceneField(data.path("script"), sceneId, "sceneRefId");
    }

    private String scriptScenePlace(JsonNode data, String sceneId) {
        for (JsonNode ed : iterEpisodeDocs(data)) {
            String place = sceneField(ed.path("script"), sceneId, "place");
            if (place != null) return place;
        }
        return sceneField(data.path("script"), sceneId, "place");
    }

    private String sceneField(JsonNode container, String sceneId, String field) {
        JsonNode scenes = container == null ? null : container.path("scenes");
        if (scenes == null || !scenes.isArray()) return null;
        for (JsonNode sc : scenes) {
            if (sc.isObject() && sceneId != null && sceneId.equals(asText(sc.get("id")))) {
                String v = asText(sc.get(field));
                return v == null || v.isBlank() ? null : v;
            }
        }
        return null;
    }

    private List<JsonNode> iterEpisodeDocs(JsonNode data) {
        List<JsonNode> out = new ArrayList<>();
        JsonNode docs = data.path("episodeDocs");
        if (docs.isObject()) docs.forEach(out::add);
        return out;
    }

    private String docSceneRefUrl(JsonNode data, String sceneAssetId) {
        JsonNode a = findDocById(data.path("scenes"), sceneAssetId);
        return docSceneRefFrom(a);
    }

    private String docSceneRefFrom(JsonNode sceneAsset) {
        if (sceneAsset == null) return null;
        JsonNode refImages = sceneAsset.get("refImages");
        if (refImages != null && refImages.isArray() && refImages.size() > 0) {
            String url = firstRefFromArray(refImages);
            if (url != null && !url.isBlank()) return url;
        }
        return maybeSign(firstNonBlank(asText(sceneAsset.get("refUrl")),
                sceneAsset.get("refCdnKey") != null ? signer.signKey(asText(sceneAsset.get("refCdnKey"))) : null));
    }

    private static JsonNode findDocById(JsonNode arr, String id) {
        if (arr == null || !arr.isArray() || id == null) return null;
        for (JsonNode n : arr) {
            if (n.isObject() && id.equals(text(n, "id"))) return n;
        }
        return null;
    }

    // ── refImages 解析（cdnKey → 签名 url） ───────────────────────────────────────

    /** 实体 refImages JSON：angle=front 优先，否则首个有 cdnKey 的；signKey 派生 url。 */
    private String frontRefUrl(String json) {
        ArrayNode arr = readArray(json);
        String first = null;
        for (JsonNode r : arr) {
            if (!r.isObject()) continue;
            String cdnKey = text(r, "cdnKey");
            if (cdnKey == null || cdnKey.isBlank()) continue;
            if (first == null) first = signer.signKey(cdnKey);
            if ("front".equals(text(r, "angle"))) return signer.signKey(cdnKey);
        }
        return first;
    }

    /** 场景实体 refImages：首个有 cdnKey 的（env 优先，否则首个）。 */
    private String firstRefUrl(String json) {
        ArrayNode arr = readArray(json);
        String first = null;
        for (JsonNode r : arr) {
            if (!r.isObject()) continue;
            String cdnKey = text(r, "cdnKey");
            if (cdnKey == null || cdnKey.isBlank()) continue;
            if (first == null) first = signer.signKey(cdnKey);
            if ("env".equals(text(r, "angle"))) return signer.signKey(cdnKey);
        }
        return first;
    }

    private String firstRefFromArray(JsonNode arr) {
        for (JsonNode r : arr) {
            if (!r.isObject()) continue;
            String cdnKey = text(r, "cdnKey");
            if (cdnKey != null && !cdnKey.isBlank()) return signer.signKey(cdnKey);
            String url = text(r, "url");
            if (url != null && !url.isBlank()) return maybeSign(url);
        }
        return null;
    }

    /** ref_slots 元素：cdnKey → signKey 优先，否则 url → maybeSign。 */
    private String slotUrl(JsonNode slot) {
        if (slot == null || !slot.isObject()) return null;
        String cdnKey = text(slot, "cdnKey");
        if (cdnKey != null && !cdnKey.isBlank()) return signer.signKey(cdnKey);
        return maybeSign(text(slot, "url"));
    }

    // ── 裁剪 / 归类（纯函数，可单测） ──────────────────────────────────────────────

    /**
     * 图像参考裁剪：去重（保先/高优先）→ 逐项按 fetchable/cap 归类。
     * 本地/相对 URL 标 {@code local_unfetchable}（不占额度）；fetchable 中超出 maxRefImages 标 {@code over_max_refs}。
     * 顺序即优先级：character_refs &gt; scene_ref &gt; prev_last_frame，末位先被 over_max_refs 砍。
     */
    static List<AppliedRef> classifyImageRefs(List<Candidate> ordered, int maxRefImages) {
        List<AppliedRef> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        int applied = 0;
        for (Candidate c : ordered) {
            String url = c.url();
            if (url == null || url.isBlank() || !seen.add(url)) continue; // 去重
            if (!isFetchableImageRef(url)) {
                out.add(new AppliedRef(c.role(), url, false, "local_unfetchable"));
            } else if (applied < Math.max(0, maxRefImages)) {
                out.add(new AppliedRef(c.role(), url, true, null));
                applied++;
            } else {
                out.add(new AppliedRef(c.role(), url, false, "over_max_refs"));
            }
        }
        return out;
    }

    /** 视频首/末帧归类：末帧仅端点支持首尾帧时送达（否则 model_no_flf）；本地/相对 URL 标 local_unfetchable。 */
    static List<AppliedRef> classifyClipFrames(String firstFrameUrl, String lastFrameUrl, boolean supportsFlf) {
        return classifyClipFrames(firstFrameUrl, lastFrameUrl, true, supportsFlf);
    }

    /** supportsFirstFrame=false 用于尚未接通上游资产上传的纯文生视频候选，避免把首帧误报为已送达。 */
    static List<AppliedRef> classifyClipFrames(String firstFrameUrl, String lastFrameUrl,
                                               boolean supportsFirstFrame, boolean supportsFlf) {
        return classifyClipFrames(firstFrameUrl, lastFrameUrl, supportsFirstFrame, supportsFlf, false, null);
    }

    /**
     * firstFrameByStorageKey=true（聚算媒体协议）：首帧送没送到只看派没派出本人的 key ——
     * 那条协议根本不用 URL，URL 抓不抓得到与此无关；派不出就是 {@code not_in_storage}，不许报「已送达」。
     */
    static List<AppliedRef> classifyClipFrames(String firstFrameUrl, String lastFrameUrl,
                                               boolean supportsFirstFrame, boolean supportsFlf,
                                               boolean firstFrameByStorageKey, String firstFrameKey) {
        List<AppliedRef> out = new ArrayList<>();
        if (firstFrameUrl != null && !firstFrameUrl.isBlank()) {
            if (!supportsFirstFrame) {
                out.add(new AppliedRef("first_frame", firstFrameUrl, false, "model_no_image_input"));
            } else if (firstFrameByStorageKey) {
                boolean ok = firstFrameKey != null && !firstFrameKey.isBlank();
                out.add(new AppliedRef("first_frame", firstFrameUrl, ok, ok ? null : REASON_NOT_IN_STORAGE));
            } else {
                boolean ok = isFetchableImageRef(firstFrameUrl);
                out.add(new AppliedRef("first_frame", firstFrameUrl, ok, ok ? null : "local_unfetchable"));
            }
        }
        if (lastFrameUrl != null && !lastFrameUrl.isBlank()) {
            if (!supportsFlf) {
                out.add(new AppliedRef("last_frame", lastFrameUrl, false, "model_no_flf"));
            } else {
                boolean ok = isFetchableImageRef(lastFrameUrl);
                out.add(new AppliedRef("last_frame", lastFrameUrl, ok, ok ? null : "local_unfetchable"));
            }
        }
        return out;
    }

    private ObjectNode appliedRefsJson(List<AppliedRef> items) {
        ObjectNode node = om.createObjectNode();
        node.put("requested", items.size());
        node.put("applied", (int) items.stream().filter(AppliedRef::applied).count());
        ArrayNode arr = node.putArray("items");
        for (AppliedRef r : items) {
            ObjectNode it = arr.addObject();
            it.put("role", r.role());
            it.put("url", r.url());
            it.put("applied", r.applied());
            if (r.reason() != null) it.put("reason", r.reason());
        }
        return node;
    }

    /** 参考图 URL 是否外部图像模型可抓取：绝对 http(s) 且非本机地址。 */
    static boolean isFetchableImageRef(String u) {
        String s = u == null ? "" : u.trim().toLowerCase();
        if (!(s.startsWith("http://") || s.startsWith("https://"))) return false;
        return !(s.contains("://localhost") || s.contains("://127.0.0.1") || s.contains("://0.0.0.0")
                || s.startsWith("http://192.168.") || s.startsWith("http://10.") || s.startsWith("http://172."));
    }

    // ── 杂项工具 ─────────────────────────────────────────────────────────────────

    private JsonNode readPayload(DramaProject row) {
        try {
            return row.getPayloadJson() != null ? om.readTree(row.getPayloadJson()) : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
    }

    private ArrayNode readArray(String json) {
        if (json == null || json.isBlank()) return om.createArrayNode();
        try {
            JsonNode n = om.readTree(json);
            return n.isArray() ? (ArrayNode) n : om.createArrayNode();
        } catch (Exception e) {
            return om.createArrayNode();
        }
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return om.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private String maybeSign(String url) {
        if (url == null || url.isBlank()) return url;
        try {
            String signed = signer.maybeSign(url);
            return signed != null ? signed : url;
        } catch (Exception e) {
            log.debug("[drama-ref-assembler] maybeSign failed, keep raw: {}", e.toString());
            return url;
        }
    }

    private static List<String> dedup(List<String> in) {
        Set<String> seen = new LinkedHashSet<>(in);
        return new ArrayList<>(seen);
    }

    private static String firstArrayEl(JsonNode arr) {
        if (arr == null || !arr.isArray() || arr.size() == 0) return null;
        return asText(arr.get(0));
    }

    private static String firstNonBlank(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return null;
    }

    private static String asText(JsonNode n) {
        return n == null || n.isNull() ? null : n.asText();
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }
}
