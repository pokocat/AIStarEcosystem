package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.dto.MixcutTemplateUpsertRequest;
import com.aistareco.aep.model.MixcutTemplate;
import com.aistareco.aep.repository.MixcutTemplateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 混剪模板的 CRUD 服务。
 *
 * 列表语义（mirror 前端 mocks 旧行为）：
 *   user 的同 templateId 版本 > factory 的版本；user 自创模板追加显示。
 */
@Service
public class MixcutTemplateService {

    public static final String FACTORY_SCOPE = "factory";

    private final MixcutTemplateRepository repo;
    private final ObjectMapper mapper;

    public MixcutTemplateService(MixcutTemplateRepository repo, ObjectMapper mapper) {
        this.repo = repo;
        this.mapper = mapper;
    }

    /** 列出某用户视角下的全部模板：user override + 未被 override 的 factory。 */
    public List<MixcutTemplate> listForUser(String ownerUserId) {
        var scope = userScopeOf(ownerUserId);
        var userList = repo.findByOwnerUserIdOrderByUpdatedAtDesc(scope);
        var factoryList = repo.findByIsFactoryTrueOrderByUpdatedAtDesc();

        Map<String, MixcutTemplate> dedup = new LinkedHashMap<>();
        for (var t : userList) dedup.putIfAbsent(t.getTemplateId(), t);
        for (var t : factoryList) dedup.putIfAbsent(t.getTemplateId(), t);
        return new ArrayList<>(dedup.values());
    }

    /** 取单个模板：优先 user 版本，回退 factory。 */
    public Optional<MixcutTemplate> getForUser(String templateId, String ownerUserId) {
        var user = repo.findByTemplateIdAndOwnerScope(templateId, userScopeOf(ownerUserId));
        if (user.isPresent()) return user;
        return repo.findByTemplateIdAndOwnerScope(templateId, FACTORY_SCOPE);
    }

    /** 用户保存模板 —— upsert 到该用户的 scope。 */
    public MixcutTemplate upsertForUser(MixcutTemplateUpsertRequest req, String ownerUserId) {
        if (req.templateId() == null || req.templateId().isBlank()) {
            throw new IllegalArgumentException("template_id 不能为空");
        }
        var scope = userScopeOf(ownerUserId);
        var now = OffsetDateTime.now();
        var existing = repo.findByTemplateIdAndOwnerScope(req.templateId(), scope);
        var t = existing.orElseGet(() -> {
            var n = new MixcutTemplate();
            n.setId(MixcutTemplate.pkOf(req.templateId(), scope));
            n.setTemplateId(req.templateId());
            n.setOwnerScope(scope);
            n.setOwnerUserId(scope);
            n.setFactory(false);
            n.setCreatedAt(now);
            return n;
        });
        applyRequest(t, req);
        t.setUpdatedAt(now);
        return repo.save(t);
    }

    /** 删除用户的模板版本（factory 永不删）。 */
    public boolean deleteUserCopy(String templateId, String ownerUserId) {
        var existing = repo.findByTemplateIdAndOwnerScope(templateId, userScopeOf(ownerUserId));
        if (existing.isEmpty()) return false;
        repo.delete(existing.get());
        return true;
    }

    /** 写一个工厂模板（由 Seeder 用）。 */
    public MixcutTemplate upsertFactory(MixcutTemplateUpsertRequest req) {
        if (req.templateId() == null || req.templateId().isBlank()) {
            throw new IllegalArgumentException("template_id 不能为空");
        }
        var now = OffsetDateTime.now();
        var existing = repo.findByTemplateIdAndOwnerScope(req.templateId(), FACTORY_SCOPE);
        var t = existing.orElseGet(() -> {
            var n = new MixcutTemplate();
            n.setId(MixcutTemplate.pkOf(req.templateId(), FACTORY_SCOPE));
            n.setTemplateId(req.templateId());
            n.setOwnerScope(FACTORY_SCOPE);
            n.setOwnerUserId(null);
            n.setFactory(true);
            n.setCreatedAt(now);
            return n;
        });
        applyRequest(t, req);
        t.setUpdatedAt(now);
        return repo.save(t);
    }

    public boolean hasAnyFactory() {
        return !repo.findByIsFactoryTrueOrderByUpdatedAtDesc().isEmpty();
    }

    private static String userScopeOf(String ownerUserId) {
        // 兼容未登录 dev 模式：保存、读取、列表、删除都落在同一个 demo scope。
        return (ownerUserId == null || ownerUserId.isBlank()) ? "demo" : ownerUserId;
    }

    private void applyRequest(MixcutTemplate t, MixcutTemplateUpsertRequest req) {
        t.setName(req.name() == null ? "未命名模板" : req.name());
        t.setVersion(req.version() == null ? "1.0" : req.version());
        t.setPerturbationProfile(req.perturbationProfile() == null ? "moderate" : req.perturbationProfile());
        t.setOutputVariantsDefault(req.outputVariantsDefault() <= 0 ? 3 : req.outputVariantsDefault());
        try {
            t.setCanvasJson(mapper.writeValueAsString(req.canvas() == null ? new HashMap<>() : req.canvas()));
            t.setScenesJson(mapper.writeValueAsString(req.scenes() == null ? mapper.createArrayNode() : req.scenes()));
            t.setQualityGateJson(mapper.writeValueAsString(req.qualityGate() == null ? new HashMap<>() : req.qualityGate()));
        } catch (Exception e) {
            throw new IllegalArgumentException("序列化模板内容失败：" + e.getMessage(), e);
        }
        var meta = req.metadata();
        if (meta != null) {
            t.setCategory(meta.category() == null ? "未分类" : meta.category());
            t.setRequiredTier(meta.requiredTier() == null ? "basic" : meta.requiredTier());
            t.setThumbnailUrl(meta.thumbnailUrl());
            t.setCoverVideoUrl(meta.coverVideoUrl());
            t.setTagsCsv(meta.tags() == null || meta.tags().isEmpty()
                    ? null
                    : String.join(",", meta.tags()));
        } else {
            if (t.getCategory() == null) t.setCategory("未分类");
            if (t.getRequiredTier() == null) t.setRequiredTier("basic");
        }
    }
}
