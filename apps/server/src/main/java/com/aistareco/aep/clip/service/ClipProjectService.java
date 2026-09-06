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
    private final ClipTtsPreviewRepository ttsPreviews;
    private final FileStorageService storage;
    public ClipProjectService(ClipProjectRepository repo, ClipTemplateService templates, ClipRenderJobRepository jobs, ClipTtsPreviewRepository ttsPreviews, FileStorageService storage) { this.repo = repo; this.templates = templates; this.jobs = jobs; this.ttsPreviews = ttsPreviews; this.storage = storage; }

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
        ClipProject p = required(owner, id);
        if (!"draft".equals(p.getStatus())) throw new BusinessException(org.springframework.http.HttpStatus.CONFLICT, "CLIP_PROJECT_NOT_EDITABLE", "当前项目不能继续编辑");
        Map<String, Object> payload = new LinkedHashMap<>(ClipDtos.safeMap(p.getPayloadJson()));
        if (req != null) {
            if (req.variables() != null) payload.put("variables", new LinkedHashMap<>(req.variables()));
            if (req.segments() != null) { validateSegments(req.segments()); payload.put("segments", new ArrayList<>(req.segments())); }
            if (req.shots() != null) { ClipShotPlan.validate(req.shots(), ClipDtos.mapListValue(payload.get("segments"))); payload.put("shots", new ArrayList<>(req.shots())); }
            else if (req.segments() != null) payload.put("shots", ClipShotPlan.defaultShots(req.segments()));
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

    @Transactional
    public Map<String, Object> reset(String owner, String id) {
        ClipProject p = required(owner, id); ClipTemplate t = templates.required(p.getTemplateId());
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
