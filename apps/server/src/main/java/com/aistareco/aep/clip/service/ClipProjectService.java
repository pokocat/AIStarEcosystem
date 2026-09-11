package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.dto.ClipDtos.ProjectDto;
import com.aistareco.aep.clip.dto.ClipRequests.SaveProject;
import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.common.BusinessException;
import com.aistareco.aep.service.storage.FileStorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
public class ClipProjectService {
    private static final Set<String> ROLES = Set.of("avatar", "broll", "tail");
    private final ClipProjectRepository repo;
    private final ClipTemplateService templates;
    private final ClipRenderJobRepository jobs;
    private final ClipShotJobRepository shotJobs;
    private final ClipTtsPreviewRepository ttsPreviews;
    private final FileStorageService storage;
    public ClipProjectService(ClipProjectRepository repo, ClipTemplateService templates, ClipRenderJobRepository jobs, ClipShotJobRepository shotJobs, ClipTtsPreviewRepository ttsPreviews, FileStorageService storage) { this.repo = repo; this.templates = templates; this.jobs = jobs; this.shotJobs = shotJobs; this.ttsPreviews = ttsPreviews; this.storage = storage; }

    @Transactional
    public ProjectDto create(String owner, String templateId) {
        ClipTemplate t = templates.required(templateId);
        if (!"published".equals(t.getStatus())) throw BusinessException.notFound("CLIP_TEMPLATE_NOT_FOUND", "模板不存在");
        Map<String, Object> skeleton = ClipDtos.safeMap(t.getScriptSkeletonJson());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("variables", defaults(skeleton.get("variables")));
        List<Map<String,Object>> segments = applyConfiguredTail(ClipDtos.mapListValue(skeleton.get("segments")), t);
        payload.put("segments", segments);
        payload.put("shots", ClipShotPlan.defaultShots(segments));
        payload.put("scriptChat", new ArrayList<>());
        payload.put("avatarId", null); payload.put("voiceId", null); payload.put("bgmAssetId", null);
        payload.put("subtitleStyle", new LinkedHashMap<>(Map.of("aiWatermark", false)));
        // 封面默认关闭：它是「出片确认」页的可选步骤，用户不填就不该多出一段封面
        payload.put("cover", new LinkedHashMap<>(Map.of("enabled", false)));
        ClipProject p = ClipProject.builder().id(id("cp")).externalOwnerId(owner).templateId(t.getId()).templateName(t.getName())
                .title(t.getName()).status("draft").payloadJson(payload).step(1).createdAt(Instant.now()).updatedAt(Instant.now()).build();
        recompute(p); return ProjectDto.from(repo.save(p));
    }

    public ProjectDto get(String owner, String id) { return ProjectDto.from(required(owner, id)); }
    public List<ProjectDto> list(String owner) { return repo.findByExternalOwnerIdAndDeletedAtIsNullOrderByUpdatedAtDesc(owner).stream().map(ProjectDto::from).toList(); }
    public ProjectDto ongoing(String owner) { return repo.findFirstByExternalOwnerIdAndStatusAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, "draft").map(ProjectDto::from).orElse(null); }

    @Transactional
    public ProjectDto save(String owner, String id, SaveProject req) {
        ClipProject p = requiredForUpdate(owner, id);
        if (!"draft".equals(p.getStatus())) throw new BusinessException(org.springframework.http.HttpStatus.CONFLICT, "CLIP_PROJECT_NOT_EDITABLE", "当前项目不能继续编辑");
        Map<String, Object> payload = new LinkedHashMap<>(ClipDtos.safeMap(p.getPayloadJson()));
        if (req != null) {
            if (req.variables() != null) payload.put("variables", new LinkedHashMap<>(req.variables()));
            if (req.segments() != null) { validateSegments(req.segments()); payload.put("segments", new ArrayList<>(req.segments())); }
            List<Map<String, Object>> previousShots = ClipDtos.mapListValue(payload.get("shots"));
            if (req.shots() != null) { ClipShotPlan.validate(req.shots(), ClipDtos.mapListValue(payload.get("segments"))); payload.put("shots", carryOverSource(previousShots, req.shots())); }
            else if (req.segments() != null) payload.put("shots", carryOverSource(previousShots, ClipShotPlan.defaultShots(req.segments())));
            if (req.scriptChat() != null) { validateScriptChat(req.scriptChat()); payload.put("scriptChat", new ArrayList<>(req.scriptChat())); }
            if (req.avatarId() != null) payload.put("avatarId", req.avatarId());
            if (req.voiceId() != null) payload.put("voiceId", req.voiceId());
            if (req.bgmAssetId() != null) payload.put("bgmAssetId", req.bgmAssetId());
            if (req.subtitleStyle() != null) payload.put("subtitleStyle", req.subtitleStyle());
            // 存之前先过一遍 ClipCoverPlan：文案按码点截断、模板 id 归一，
            // 免得渲染时才发现用户塞了一整段话进标语槽
            if (req.cover() != null) payload.put("cover", ClipCoverPlan.normalize(req.cover()));
            if (req.step() != null) p.setStep(Math.max(1, Math.min(3, req.step())));
            if (req.title() != null && !req.title().isBlank()) p.setTitle(req.title().trim().substring(0, Math.min(160, req.title().trim().length())));
        }
        p.setPayloadJson(payload); p.setUpdatedAt(Instant.now()); recompute(p); return ProjectDto.from(repo.save(p));
    }

    /**
     * 复制成一份新草稿。
     *
     * <p>**产物引用一律清掉**：{@code shots[].source.artifact} 是原主人真金白银换来的，
     * 复制一份稿子不该顺带白继承一段已经花过钱的视频。{@code creditsHeld} 同理归零 ——
     * 那笔钱冻在原项目的那一单上，跟这份新稿子没有任何关系。
     *
     * <p>保留的是**创作意图**：分镜怎么切、每镜打算用哪个 model、prompt 写了什么都留着，
     * 只把成品拿走。否则「复制一版再改改」这个动作就退化成了「重新建一个项目」。
     */
    @Transactional
    public ProjectDto duplicate(String owner, String id) {
        ClipProject source = required(owner, id);
        Map<String, Object> payload = new LinkedHashMap<>(ClipDtos.safeMap(source.getPayloadJson()));
        // actualDurationSec 是上一版真跑过一次 TTS 量出来的秒数，新稿子还没跑过，留着会让报价虚高
        payload.put("segments", ClipDtos.mapListValue(payload.get("segments")).stream()
                .map(row -> { row.remove("actualDurationSec"); return row; }).toList());
        payload.put("shots", ClipShotPlan.shots(payload).stream().map(ClipProjectService::withoutArtifact).toList());
        payload.remove("publishStats");
        Instant now = Instant.now();
        String title = (source.getTitle() + "（副本）");
        ClipProject copy = ClipProject.builder().id(id("cp")).externalOwnerId(owner)
                .templateId(source.getTemplateId()).templateName(source.getTemplateName())
                .title(title.substring(0, Math.min(160, title.length()))).status("draft").payloadJson(payload)
                .step(source.getStep()).creditsHeld(0).progress(0).createdAt(now).updatedAt(now).build();
        recompute(copy); return ProjectDto.from(repo.save(copy));
    }

    @Transactional
    public Map<String, Object> reset(String owner, String id) {
        ClipProject p = requiredForUpdate(owner, id); ClipTemplate t = templates.required(p.getTemplateId());
        List<Map<String, Object>> segments = applyConfiguredTail(ClipDtos.mapListValue(ClipDtos.safeMap(t.getScriptSkeletonJson()).get("segments")), t);
        List<Map<String, Object>> shots = ClipShotPlan.defaultShots(segments);
        Map<String, Object> payload = new LinkedHashMap<>(p.getPayloadJson()); payload.put("segments", segments); payload.put("shots", shots);
        p.setPayloadJson(payload); p.setUpdatedAt(Instant.now()); recompute(p); repo.save(p);
        return Map.of("segments", segments, "shots", shots);
    }
    @Transactional public void softDelete(String owner, String id) { ClipProject p = required(owner, id); p.setDeletedAt(Instant.now()); p.setUpdatedAt(Instant.now()); repo.save(p); }
    @Transactional public ProjectDto restore(String owner, String id) {
        ClipProject p = repo.findById(id).filter(v -> owner.equals(v.getExternalOwnerId())).orElseThrow(() -> BusinessException.notFound("CLIP_PROJECT_NOT_FOUND", "项目不存在"));
        p.setDeletedAt(null); p.setUpdatedAt(Instant.now()); return ProjectDto.from(repo.save(p));
    }
    @Transactional public void purge(String owner, String id) {
        ClipProject p = repo.findById(id).filter(v -> owner.equals(v.getExternalOwnerId())).orElseThrow(() -> BusinessException.notFound("CLIP_PROJECT_NOT_FOUND", "项目不存在")); purgeRow(p);
    }
    @Transactional public void purgeOwner(String owner) { repo.findByExternalOwnerId(owner).forEach(this::purgeRow); }
    @Transactional public void purgeExpired(ClipProject p) { repo.findById(p.getId()).ifPresent(this::purgeRow); }
    public ClipProject required(String owner, String id) { return repo.findByIdAndExternalOwnerIdAndDeletedAtIsNull(id, owner).orElseThrow(() -> BusinessException.notFound("CLIP_PROJECT_NOT_FOUND", "项目不存在或无权访问")); }

    /**
     * 取行时加写锁（{@code SELECT ... FOR UPDATE}），供对 {@code payloadJson} 做「读—改—写」
     * 的写入路径用（{@code save} / {@code reset} / {@code recordShotArtifact}）。
     *
     * <p>{@code payloadJson} 是整存整取的 JSON 文档、没有 {@code @Version}：用户草稿态编辑
     * （请求线程）与镜头 worker 落回段级产物（{@code @Scheduled} worker 线程）会并发地各读一份
     * 快照、改一处、整体写回，后提交的一方把先提交的覆盖掉 —— 丢的是用户已付费的产物或刚做的
     * 编辑。这三条写路径都在同一事务里先经此方法取同一行的写锁，串行化到该行上，关掉丢更新窗口。
     * 读路径（{@code get} / {@code list} / {@code duplicate} 读源）不走这里，不受影响。
     */
    private ClipProject requiredForUpdate(String owner, String id) {
        return repo.findByIdAndExternalOwnerIdAndDeletedAtIsNullForUpdate(id, owner)
                .orElseThrow(() -> BusinessException.notFound("CLIP_PROJECT_NOT_FOUND", "项目不存在或无权访问"));
    }

    public static void recompute(ClipProject p) {
        List<Map<String, Object>> source = ClipDtos.mapListValue(p.getPayloadJson().get("segments"));
        List<Map<String, Object>> segments = ClipShotPlan.materialize(p.getPayloadJson());
        int total = 0, avatar = 0;
        for (Map<String, Object> row : segments) {
            int sec = seconds(row); total += sec; if ("avatar".equals(String.valueOf(row.get("role")))) avatar += sec;
        }
        p.setSegmentCount(source.size()); p.setDurationSec(total); p.setAvatarSeconds(avatar);
    }
    public static int seconds(Map<String, Object> row) {
        Object actual = row.get("actualDurationSec"); if (actual instanceof Number n && n.doubleValue() > 0) return Math.max(1, (int)Math.round(n.doubleValue()));
        Object duration = row.get("durationSec"); if ("tail".equals(String.valueOf(row.get("role"))) && duration instanceof Number n) return Math.max(0, (int)Math.round(n.doubleValue()));
        return Math.max(1, Math.round(String.valueOf(row.getOrDefault("text", "")).replaceAll("\\s", "").length() / 4f));
    }
    /**
     * 端上回存 shots 时没带 {@code source} 的，按 shot id 把旧的接回去。
     *
     * <p>{@code source.artifact} 是**用户已经付过钱的产物**。一次漏字段的 PUT（老版本端、
     * 或只想改个标题的局部保存）不该把它抹掉 —— 抹掉的代价是用户再花一次钱重生成一遍。
     *
     * <p>「会不会接回一个过期产物」有两道兜底：分镜范围一变 shot id 就变（{@code shot_起_止}），
     * 接不上；范围没变而文案变了，端上算的 fingerprint 对不上，下次 generate 照样重跑。
     * 所以这里只会救回「同一镜、同一份内容」的产物，不会让陈旧产物冒充新的。
     */
    static List<Map<String, Object>> carryOverSource(List<Map<String, Object>> previous, List<Map<String, Object>> incoming) {
        Map<String, Object> byId = new LinkedHashMap<>();
        for (Map<String, Object> row : previous) if (row.get("source") != null) byId.put(String.valueOf(row.get("id")), row.get("source"));
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : incoming) {
            Map<String, Object> copy = new LinkedHashMap<>(row);
            if (copy.get("source") == null && byId.containsKey(String.valueOf(copy.get("id")))) copy.put("source", byId.get(String.valueOf(copy.get("id"))));
            result.add(copy);
        }
        return result;
    }

    /**
     * 把一镜的产物落进项目 payload。**段级产物的真源是项目，不是任务行** ——
     * 任务行会被清理、会过期，而用户换一台手机重新拉项目时，产物必须还在。
     */
    @Transactional
    public void recordShotArtifact(String owner, String projectId, int shotNo, Map<String, Object> artifact, String model, String prompt) {
        ClipProject p = requiredForUpdate(owner, projectId);
        Map<String, Object> payload = new LinkedHashMap<>(ClipDtos.safeMap(p.getPayloadJson()));
        List<Map<String, Object>> shots = ClipShotPlan.shots(payload);
        if (shotNo < 1 || shotNo > shots.size()) return;
        Map<String, Object> shot = shots.get(shotNo - 1);
        Map<String, Object> source = new LinkedHashMap<>(ClipDtos.safeMapValue(shot.get("source")) == null ? Map.of() : ClipDtos.safeMapValue(shot.get("source")));
        source.put("model", model); if (prompt != null && !prompt.isBlank()) source.put("prompt", prompt);
        source.put("artifact", artifact); shot.put("source", source);
        payload.put("shots", shots); p.setPayloadJson(payload); p.setUpdatedAt(Instant.now()); recompute(p); repo.save(p);
    }

    private static Map<String, Object> withoutArtifact(Map<String, Object> shot) {
        Map<String, Object> copy = new LinkedHashMap<>(shot);
        Map<String, Object> source = ClipDtos.safeMapValue(copy.get("source"));
        if (source == null) return copy;
        source.remove("artifact");
        if (source.isEmpty()) copy.remove("source"); else copy.put("source", source);
        return copy;
    }

    public static void validateSegments(List<Map<String, Object>> segments) {
        if (segments.isEmpty() || segments.size() > 200) throw BusinessException.badRequest("CLIP_PROJECT_INVALID", "文案分段数量不合法");
        Set<Integer> nos = new HashSet<>();
        for (Map<String, Object> row : segments) {
            int no = row.get("no") instanceof Number n ? n.intValue() : -1;
            if (no < 1 || !nos.add(no) || !ROLES.contains(String.valueOf(row.get("role")))) throw BusinessException.badRequest("CLIP_PROJECT_INVALID", "文案分段结构不合法");
        }
    }
    public static void validateScriptChat(List<Map<String, Object>> messages) {
        if (messages.size() > 40) throw BusinessException.badRequest("CLIP_PROJECT_INVALID", "文案对话记录过长");
        for (Map<String,Object> row : messages) {
            String role = String.valueOf(row.get("role"));
            String content = String.valueOf(row.getOrDefault("content", "")).trim();
            if (!Set.of("user", "assistant").contains(role) || content.isEmpty() || content.length() > 4000) {
                throw BusinessException.badRequest("CLIP_PROJECT_INVALID", "文案对话记录结构不合法");
            }
        }
    }
    private void purgeRow(ClipProject p) {
        List<ClipRenderJob> rows = jobs.findByProjectId(p.getId());
        rows.forEach(j -> { storage.delete(j.getOutputCdnKey()); storage.delete(j.getThumbnailCdnKey()); });
        jobs.deleteAll(rows);
        // 段级产物同样归这个项目所有。不跟着删，对象存储里就留下一堆永远没人引用的孤儿 ——
        // 而且它们还在按字节占用户的容量配额，等于让用户为一个已经删掉的项目继续付空间。
        List<ClipShotJob> shotRows = shotJobs.findByProjectId(p.getId());
        shotRows.forEach(j -> { storage.delete(j.getArtifactCdnKey()); storage.delete(j.getArtifactPosterCdnKey()); storage.delete(j.getAudioCdnKey()); });
        shotJobs.deleteAll(shotRows);
        // 配音预览的音频也归这个项目所有：不跟着删就会在对象存储里留下永远没人引用的孤儿。
        List<ClipTtsPreview> previews = ttsPreviews.findByProjectId(p.getId());
        previews.forEach(preview -> ClipDtos.mapListValue(ClipDtos.safeMap(preview.getSegmentsJson()).get("items"))
                .forEach(item -> { Object key = item.get("audioCdnKey"); if (key != null && !String.valueOf(key).isBlank()) storage.delete(String.valueOf(key)); }));
        ttsPreviews.deleteAll(previews);
        repo.delete(p);
    }
    private static Map<String, String> defaults(Object value) {
        Map<String, String> result = new LinkedHashMap<>();
        for (Object row : ClipDtos.list(value)) if (row instanceof Map<?, ?> m && m.get("key") != null) {
            Object placeholder = m.containsKey("placeholder") ? m.get("placeholder") : "";
            result.put(String.valueOf(m.get("key")), String.valueOf(placeholder));
        }
        return result;
    }
    private static List<Map<String,Object>> applyConfiguredTail(List<Map<String,Object>> source, ClipTemplate template) {
        List<Map<String,Object>> segments = source.stream().map(row -> (Map<String,Object>) new LinkedHashMap<>(row)).toList();
        List<Map<String,Object>> configured = ClipDtos.mapList(template.getTailClipsJson(), "items");
        if (configured.isEmpty()) return new ArrayList<>(segments);
        Map<String,Object> clip = configured.get(0);
        String assetId = ClipDtos.string(clip.get("assetId"));
        if (assetId == null || assetId.isBlank()) return new ArrayList<>(segments);
        for (Map<String,Object> row : segments) if ("tail".equals(String.valueOf(row.get("role")))) {
            row.put("assetId", assetId); row.put("assetLabel", clip.getOrDefault("label", row.get("text")));
            row.put("brollSource", "preset");
            Object duration = clip.get("durationSec"); if (duration instanceof Number n && n.doubleValue() > 0) row.put("durationSec", Math.round(n.doubleValue()));
            break;
        }
        return new ArrayList<>(segments);
    }
    private static String id(String prefix) { return prefix + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16); }
}
