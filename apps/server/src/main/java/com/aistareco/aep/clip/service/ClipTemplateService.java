package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos.TemplateDto;
import com.aistareco.aep.clip.dto.ClipRequests.UpsertTemplate;
import com.aistareco.aep.clip.model.ClipTemplate;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.repository.ClipTemplateRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
public class ClipTemplateService {
    private final ClipTemplateRepository repo;
    private final FileStorageService storage;
    private final ClipAssetService assets;
    /** 「把草稿存成模板」要读草稿，而且只读**自己的**（projects.required 带属主校验）。 */
    private final ClipProjectService projects;
    public ClipTemplateService(ClipTemplateRepository repo, FileStorageService storage, ClipAssetService assets,
                               @org.springframework.context.annotation.Lazy ClipProjectService projects) {
        this.repo = repo; this.storage = storage; this.assets = assets; this.projects = projects;
    }

    public List<TemplateDto> published() { return repo.findByStatusAndDeletedAtIsNullOrderByUpdatedAtDesc("published").stream().map(this::dto).toList(); }
    public TemplateDto published(String id) {
        ClipTemplate t = required(id);
        if (!"published".equals(t.getStatus())) throw BusinessException.notFound("CLIP_TEMPLATE_NOT_FOUND", "模板不存在");
        return dto(t);
    }
    public List<TemplateDto> adminList() { return repo.findByDeletedAtIsNullOrderByUpdatedAtDesc().stream().map(this::dto).toList(); }

    @Transactional
    public TemplateDto upsert(String pathId, UpsertTemplate req) {
        String id = pathId != null ? pathId : (req == null ? null : req.id());
        if (id == null || !id.matches("[A-Za-z0-9_-]{3,64}")) id = "ct_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        if (req == null || blank(req.name()) || blank(req.industry()) || blank(req.themeKey()) || blank(req.description())) {
            throw BusinessException.badRequest("CLIP_TEMPLATE_INVALID", "模板名称、行业、主题和说明不能为空");
        }
        if (req.scriptSkeleton() == null || !(req.scriptSkeleton().get("segments") instanceof List<?> segments) || segments.isEmpty()) {
            throw BusinessException.badRequest("CLIP_TEMPLATE_INVALID", "模板必须包含文案分段骨架");
        }
        ClipProjectService.validateSegments(com.aistareco.aep.clip.dto.ClipDtos.mapListValue(req.scriptSkeleton().get("segments")));
        ClipTemplate t = repo.findById(id).orElseGet(ClipTemplate::new);
        Instant now = Instant.now();
        if (t.getId() == null) { t.setId(id); t.setCreatedAt(now); }
        t.setName(req.name().trim()); t.setIndustry(req.industry().trim()); t.setThemeKey(req.themeKey().trim());
        t.setDescription(req.description().trim()); t.setStatus("published".equals(req.status()) ? "published" : "draft");
        t.setOwnerScope("user".equals(req.ownerScope()) ? "user" : "official"); t.setScriptSkeletonJson(req.scriptSkeleton());
        t.setTimelineJson(req.timeline() == null ? new LinkedHashMap<>() : req.timeline());
        t.setTailClipsJson(Map.of("items", req.tailClips() == null ? List.of() : req.tailClips()));
        t.setBrollPoolJson(Map.of("items", req.brollPool() == null ? List.of() : req.brollPool()));
        int calculatedDuration = duration(req.scriptSkeleton());
        t.setRatio("9:16"); t.setEstDurationSec(calculatedDuration);
        t.setAvatarSecHint(Math.max(0, req.avatarSecHint() == null ? 0 : req.avatarSecHint())); t.setCreditHint(req.creditHint());
        t.setDeletedAt(null); t.setUpdatedAt(now); return dto(repo.save(t));
    }

    @Transactional public void delete(String id) { ClipTemplate t = required(id); t.setDeletedAt(Instant.now()); t.setUpdatedAt(Instant.now()); repo.save(t); }

    /**
     * 把一条**自己的**草稿存成模板。运营在小程序里把片子做顺了，回后台一键沉淀成货架上的一套。
     *
     * <p>形制照搬 ip studio 的 {@code publish-as-demo}（{@code IpDemoTemplateService.publishFromProject}）：
     * 同样是「我的项目 → 全平台内容」，同样只能拿自己的项目，同样要超管（军师 BFF 侧压
     * requireSuper + requireProductAccess('editor')）。
     *
     * <p><b>必须剥掉的东西，比 ip studio 那边更要紧。</b> ip studio 剥的是作者自己的照片；
     * 这里剥的是：
     * <ul>
     *   <li>{@code avatarId} —— 运营自己的数字人。不剥的话，每个用这套模板的人做出来的片子
     *       都顶着运营那张脸。</li>
     *   <li>{@code voiceId} —— 运营自己的声音，同上。</li>
     *   <li>非预置素材的 {@code assetId} —— 运营自己上传的空镜。留着的话用户打开模板会看到
     *       一堆自己没有权限、也不该看到的别人的素材位。</li>
     * </ul>
     * 预置素材（{@code brollSource=preset}）是平台自有的，留着 —— 那本来就是给所有人用的。
     *
     * <p><b>留下的是「怎么讲」，不是「讲了什么」。</b> 分段的角色、时长、画面提示、镜头切分
     * 全部保留；正文按 {@code keepText} 决定：默认保留（运营写的示范文案本身就是模板的价值），
     * 想只留骨架就传 false，正文清空、字数与时长按原样留着当写作约束。
     *
     * @param ownerId   调用者的 externalOwnerId。只能拿自己的项目，运营也不该凭一个 id
     *                  就把别人的草稿连素材抄成公开模板。
     * @param templateId 传了就是更新那一条（改版），不传新建。
     */
    @Transactional
    public TemplateDto publishFromProject(String ownerId, String projectId, String templateId,
                                          String name, String industry, String themeKey,
                                          String description, boolean keepText) {
        ClipProject p = projects.required(ownerId, projectId);
        if (blank(name) || blank(industry) || blank(themeKey) || blank(description)) {
            throw BusinessException.badRequest("CLIP_TEMPLATE_INVALID", "模板名称、行业、主题和说明不能为空");
        }
        Map<String, Object> payload = p.getPayloadJson() == null ? Map.of() : p.getPayloadJson();
        List<Map<String, Object>> segments = com.aistareco.aep.clip.dto.ClipDtos.mapListValue(payload.get("segments"));
        if (segments.isEmpty()) {
            throw BusinessException.badRequest("CLIP_TEMPLATE_INVALID", "这条草稿还没有文案分段，存不成模板");
        }

        List<Map<String, Object>> clean = new ArrayList<>();
        for (Map<String, Object> row : segments) {
            Map<String, Object> seg = new LinkedHashMap<>(row);
            // 段级产物（artifact / job）是这一条草稿跑出来的成品，跟模板没关系
            seg.remove("artifact"); seg.remove("job"); seg.remove("source");
            if (!"preset".equals(String.valueOf(seg.get("brollSource")))) {
                // 运营自己传的素材：连 assetId 和标签一起清干净。只清 assetId 不清 assetLabel 的话，
                // 用户会在模板里看到一个叫「我家门店实拍.mp4」、却点不开的空位。
                seg.remove("assetId"); seg.remove("assetLabel"); seg.remove("brollSource");
            }
            if (!keepText) seg.put("text", "");
            clean.add(seg);
        }
        ClipProjectService.validateSegments(clean);

        String id = templateId != null && !templateId.isBlank()
                ? templateId.trim()
                : "ct_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        if (!id.matches("[A-Za-z0-9_-]{3,64}")) {
            throw BusinessException.badRequest("CLIP_TEMPLATE_INVALID", "模板标识不合法");
        }
        Instant now = Instant.now();
        ClipTemplate t = repo.findById(id).orElseGet(ClipTemplate::new);
        if (t.getId() == null) { t.setId(id); t.setCreatedAt(now); }
        t.setName(name.trim()); t.setIndustry(industry.trim()); t.setThemeKey(themeKey.trim());
        t.setDescription(description.trim());
        t.setOwnerScope("official");
        // **一律存成草稿**，哪怕是在更新一条已经上架的。存模板和上架是两个决定：
        // 存完先自己在后台看一眼分段对不对、素材剥干净没有，再手动上架。
        // 直接 published 的话，一次手滑就推给了全平台每一个用户。
        t.setStatus("draft");
        t.setScriptSkeletonJson(Map.of("segments", clean));
        // 时间线是模板自己的编排产物，草稿里没有；更新已有模板时不要把它清掉。
        if (t.getTimelineJson() == null) t.setTimelineJson(new LinkedHashMap<>());
        t.setTailClipsJson(Map.of("items", List.of()));
        t.setBrollPoolJson(Map.of("items", List.of()));
        t.setRatio("9:16");
        t.setEstDurationSec(duration(Map.of("segments", clean)));
        t.setAvatarSecHint(Math.max(0, p.getAvatarSeconds()));
        t.setDeletedAt(null); t.setUpdatedAt(now);
        return dto(repo.save(t));
    }

    /**
     * 只改上下架状态，别的字段一个都不碰。
     *
     * 不复用 upsert：那个方法是**整体替换**语义 —— 必填 name/industry/themeKey/description/scriptSkeleton，
     * 而且 timeline / tailClips / brollPool 缺省就被清空。运营后台只想点一下「上架」，走 upsert 就得
     * 先读回整份再原样回传，中间任何一次并发编辑都会被这次回传覆盖掉（典型的 lost update），
     * 而且漏传一个字段就是静默清空运营配好的片尾。上下架是最高频的运营动作，值得一条专用路径。
     */
    @Transactional public TemplateDto setStatus(String id, String status) {
        if (!"published".equals(status) && !"draft".equals(status)) {
            throw BusinessException.badRequest("CLIP_TEMPLATE_STATUS_INVALID", "状态只能是 published 或 draft");
        }
        ClipTemplate t = required(id);
        t.setStatus(status); t.setUpdatedAt(Instant.now());
        return dto(repo.save(t));
    }
    /** 显式替换片尾（只在 reseed 开关打开时调用）。与 attachTailClipIfMissing 分开命名，
     *  避免"看起来只是补空缺、实际覆盖了运营配置"这种意外。 */
    @Transactional public void replaceTailClip(String templateId, com.aistareco.aep.clip.dto.ClipDtos.AssetDto asset) {
        ClipTemplate template = required(templateId);
        template.setTailClipsJson(Map.of("items", List.of(Map.of("assetId", asset.id(), "label", asset.label(),
                "durationSec", Math.max(1, Math.round(asset.durationSec()))))));
        template.setUpdatedAt(Instant.now()); repo.save(template);
    }

    @Transactional public void attachTailClipIfMissing(String templateId, com.aistareco.aep.clip.dto.ClipDtos.AssetDto asset) {
        ClipTemplate template = required(templateId);
        if (!com.aistareco.aep.clip.dto.ClipDtos.mapList(template.getTailClipsJson(), "items").isEmpty()) return;
        template.setTailClipsJson(Map.of("items", List.of(Map.of("assetId", asset.id(), "label", asset.label(), "durationSec", Math.max(1, Math.round(asset.durationSec()))))));
        template.setUpdatedAt(Instant.now()); repo.save(template);
    }
    /**
     * 把所有引用某条素材的片尾清空。删预置素材时必须先做，否则模板会留着一条指向已删素材的
     * tailClip —— 出片时才炸，而且炸在离原因最远的地方。
     */
    @Transactional public int detachTailClip(String assetId) {
        int touched = 0;
        for (ClipTemplate t : repo.findAll()) {
            if (t.getDeletedAt() != null) continue;
            var items = com.aistareco.aep.clip.dto.ClipDtos.mapList(t.getTailClipsJson(), "items");
            if (items.stream().noneMatch(row -> assetId.equals(String.valueOf(row.get("assetId"))))) continue;
            var kept = items.stream().filter(row -> !assetId.equals(String.valueOf(row.get("assetId")))).toList();
            t.setTailClipsJson(Map.of("items", kept)); t.setUpdatedAt(Instant.now()); repo.save(t); touched++;
        }
        return touched;
    }

    public ClipTemplate required(String id) { return repo.findById(id).filter(t -> t.getDeletedAt() == null).orElseThrow(() -> BusinessException.notFound("CLIP_TEMPLATE_NOT_FOUND", "模板不存在")); }
    private TemplateDto dto(ClipTemplate t) {
        List<Map<String,Object>> clips = new ArrayList<>();
        for (Map<String,Object> raw : com.aistareco.aep.clip.dto.ClipDtos.mapList(t.getTailClipsJson(), "items")) {
            Map<String,Object> clip = new LinkedHashMap<>(raw);
            String assetId = com.aistareco.aep.clip.dto.ClipDtos.string(clip.get("assetId"));
            if (assetId != null && !assetId.isBlank()) {
                try {
                    var asset = assets.visible("admin", assetId);
                    clip.put("label", asset.label()); clip.put("durationSec", Math.round(asset.durationSec()));
                    clip.put("previewUrl", asset.previewUrl()); clip.put("contentUrl", asset.contentUrl());
                } catch (RuntimeException ignored) { /* 后台会继续看到失效 assetId，便于修正。 */ }
            }
            clips.add(clip);
        }
        int duration = duration(t.getScriptSkeletonJson());
        if (!clips.isEmpty() && clips.get(0).get("durationSec") instanceof Number n && n.doubleValue() > 0) {
            int skeletonTail = com.aistareco.aep.clip.dto.ClipDtos.mapListValue(t.getScriptSkeletonJson().get("segments")).stream()
                    .filter(row -> "tail".equals(String.valueOf(row.get("role")))).mapToInt(ClipProjectService::seconds).sum();
            duration = Math.max(0, duration - skeletonTail + Math.max(1, (int)Math.round(n.doubleValue())));
        }
        return TemplateDto.from(t, storage.signedUrl(t.getPreviewCoverKey()), storage.signedUrl(t.getPreviewVideoKey()), clips, duration);
    }
    public static int duration(Map<String,Object> skeleton) {
        int total = 0;
        for (Map<String,Object> row : com.aistareco.aep.clip.dto.ClipDtos.mapListValue(skeleton == null ? null : skeleton.get("segments"))) total += ClipProjectService.seconds(row);
        return total;
    }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
