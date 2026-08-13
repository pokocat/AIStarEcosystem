package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos.TemplateDto;
import com.aistareco.aep.clip.dto.ClipRequests.UpsertTemplate;
import com.aistareco.aep.clip.model.ClipTemplate;
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
    public ClipTemplateService(ClipTemplateRepository repo, FileStorageService storage, ClipAssetService assets) { this.repo = repo; this.storage = storage; this.assets = assets; }

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
