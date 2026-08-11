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
    public ClipTemplateService(ClipTemplateRepository repo, FileStorageService storage) { this.repo = repo; this.storage = storage; }

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
        t.setRatio("9:16"); t.setEstDurationSec(Math.max(0, req.estDurationSec() == null ? 0 : req.estDurationSec()));
        t.setAvatarSecHint(Math.max(0, req.avatarSecHint() == null ? 0 : req.avatarSecHint())); t.setCreditHint(req.creditHint());
        t.setDeletedAt(null); t.setUpdatedAt(now); return dto(repo.save(t));
    }

    @Transactional public void delete(String id) { ClipTemplate t = required(id); t.setDeletedAt(Instant.now()); t.setUpdatedAt(Instant.now()); repo.save(t); }
    public ClipTemplate required(String id) { return repo.findById(id).filter(t -> t.getDeletedAt() == null).orElseThrow(() -> BusinessException.notFound("CLIP_TEMPLATE_NOT_FOUND", "模板不存在")); }
    private TemplateDto dto(ClipTemplate t) { return TemplateDto.from(t, storage.signedUrl(t.getPreviewCoverKey()), storage.signedUrl(t.getPreviewVideoKey())); }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
