package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.dto.AiAvatarRequests;
import com.aistareco.aep.aiavatar.dto.AiAvatarTemplateDto;
import com.aistareco.aep.aiavatar.model.AiAvatarTemplate;
import com.aistareco.aep.aiavatar.model.AiAvatarTemplateCategory;
import com.aistareco.aep.aiavatar.repository.AiAvatarTemplateRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * AI 模板中心服务（任务书 §7）。用户看「工厂模板 + 自己私有」；admin 管理工厂模板。
 */
@Service
public class AiAvatarTemplateService {

    private final AiAvatarTemplateRepository templateRepo;
    private final ObjectMapper mapper;

    public AiAvatarTemplateService(AiAvatarTemplateRepository templateRepo, ObjectMapper mapper) {
        this.templateRepo = templateRepo;
        this.mapper = mapper;
    }

    public List<AiAvatarTemplateDto> listVisibleTo(String userId) {
        return templateRepo.findVisibleTo(userId).stream().map(t -> AiAvatarTemplateDto.from(t, mapper)).toList();
    }

    public List<AiAvatarTemplateDto> listAll() {
        return templateRepo.findAll().stream().map(t -> AiAvatarTemplateDto.from(t, mapper)).toList();
    }

    public AiAvatarTemplate requireById(String id) {
        return templateRepo.findById(id)
                .orElseThrow(() -> BusinessException.notFound("AIAVATAR_TEMPLATE_NOT_FOUND", "模板不存在"));
    }

    public AiAvatarTemplateDto get(String id) {
        return AiAvatarTemplateDto.from(requireById(id), mapper);
    }

    /** admin / 系统建工厂模板。 */
    public AiAvatarTemplate create(AiAvatarRequests.TemplateUpsert in, boolean official, String ownerUserId) {
        if (in.name() == null || in.name().isBlank()) {
            throw BusinessException.badRequest("AIAVATAR_TEMPLATE_NAME_REQUIRED", "模板名必填");
        }
        AiAvatarTemplate t = AiAvatarTemplate.builder()
                .id(UUID.randomUUID().toString())
                .name(in.name())
                .category(in.category() == null ? AiAvatarTemplateCategory.BEAUTY : in.category())
                .description(in.description())
                .thumbnailUrl(in.thumbnailUrl())
                .paramsJson(in.params() == null ? null : in.params().toString())
                .capability(in.capability())
                .official(official)
                .ownerUserId(official ? null : ownerUserId)
                .enabled(in.enabled() == null || in.enabled())
                .usageCount(0)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
        return templateRepo.save(t);
    }

    public AiAvatarTemplate update(String id, AiAvatarRequests.TemplateUpsert in) {
        AiAvatarTemplate t = requireById(id);
        if (in.name() != null) t.setName(in.name());
        if (in.category() != null) t.setCategory(in.category());
        if (in.description() != null) t.setDescription(in.description());
        if (in.thumbnailUrl() != null) t.setThumbnailUrl(in.thumbnailUrl());
        if (in.params() != null) t.setParamsJson(in.params().toString());
        if (in.capability() != null) t.setCapability(in.capability());
        if (in.official() != null) t.setOfficial(in.official());
        if (in.enabled() != null) t.setEnabled(in.enabled());
        t.setUpdatedAt(OffsetDateTime.now());
        return templateRepo.save(t);
    }

    public void delete(String id) {
        AiAvatarTemplate t = requireById(id);
        templateRepo.delete(t);
    }

    public void bumpUsage(String id) {
        templateRepo.findById(id).ifPresent(t -> {
            t.setUsageCount(t.getUsageCount() + 1);
            templateRepo.save(t);
        });
    }

    public AiAvatarTemplateDto toDto(AiAvatarTemplate t) {
        return AiAvatarTemplateDto.from(t, mapper);
    }
}
