package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminAiModelProviderUpsertDto;
import com.aistareco.aep.dto.AiModelProviderDto;
import com.aistareco.aep.model.AiModelProvider;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.repository.AiModelProviderRepository;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * AI provider 管理（v0.5 §D8）。
 * apiKey 走明文进 service，加密落库；DTO 出口剥离明文，仅返回脱敏值。
 */
@Service
@Transactional
public class AiModelProviderAdminService {

    private final AiModelProviderRepository repo;
    private final AiModelInvocationService invocation;

    public AiModelProviderAdminService(AiModelProviderRepository repo,
                                        AiModelInvocationService invocation) {
        this.repo = repo;
        this.invocation = invocation;
    }

    public List<AiModelProviderDto> list() {
        return repo.findAll().stream()
                .sorted((a, b) -> {
                    int pa = a.getPriority() != null ? a.getPriority() : 100;
                    int pb = b.getPriority() != null ? b.getPriority() : 100;
                    return Integer.compare(pa, pb);
                })
                .map(AiModelProviderDto::from)
                .toList();
    }

    public AiModelProviderDto get(String id) {
        return AiModelProviderDto.from(load(id));
    }

    public AiModelProviderDto create(AdminAiModelProviderUpsertDto req) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "NAME_REQUIRED", "name 必填");
        }
        if (req.baseUrl() == null || req.baseUrl().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "BASE_URL_REQUIRED", "baseUrl 必填");
        }
        if (req.apiKey() == null || req.apiKey().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "API_KEY_REQUIRED", "apiKey 必填");
        }
        String id = (req.id() != null && !req.id().isBlank())
                ? req.id()
                : "ai-" + UUID.randomUUID().toString().substring(0, 12);
        if (repo.existsById(id)) {
            throw new BusinessException(HttpStatus.CONFLICT, "PROVIDER_DUPLICATE", "provider id 已存在");
        }
        AiModelProvider entity = AiModelProvider.builder()
                .id(id)
                .name(req.name())
                .providerType(req.providerType() != null
                        ? AiModelProviderType.fromWire(req.providerType())
                        : AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl(req.baseUrl())
                .apiKeyEncrypted(AepCryptoUtil.encrypt(req.apiKey()))
                .apiVersion(req.apiVersion())
                .defaultModel(req.defaultModel())
                .purposes(req.purposes() != null ? new ArrayList<>(req.purposes()) : new ArrayList<>())
                .priority(req.priority() != null ? req.priority() : 100)
                .enabled(req.enabled() != null ? req.enabled() : true)
                .build();
        return AiModelProviderDto.from(repo.save(entity));
    }

    public AiModelProviderDto update(String id, AdminAiModelProviderUpsertDto req) {
        AiModelProvider entity = load(id);
        if (req.name() != null) entity.setName(req.name());
        if (req.providerType() != null) entity.setProviderType(AiModelProviderType.fromWire(req.providerType()));
        if (req.baseUrl() != null) entity.setBaseUrl(req.baseUrl());
        if (req.apiKey() != null && !req.apiKey().isBlank()) {
            entity.setApiKeyEncrypted(AepCryptoUtil.encrypt(req.apiKey()));
        }
        if (req.apiVersion() != null) entity.setApiVersion(req.apiVersion());
        if (req.defaultModel() != null) entity.setDefaultModel(req.defaultModel());
        if (req.purposes() != null) entity.setPurposes(new ArrayList<>(req.purposes()));
        if (req.priority() != null) entity.setPriority(req.priority());
        if (req.enabled() != null) entity.setEnabled(req.enabled());
        return AiModelProviderDto.from(repo.save(entity));
    }

    public void delete(String id) {
        if (!repo.existsById(id)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "PROVIDER_NOT_FOUND", "provider 不存在");
        }
        repo.deleteById(id);
    }

    public Map<String, Object> testConnection(String id) {
        return invocation.testConnection(id);
    }

    private AiModelProvider load(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PROVIDER_NOT_FOUND",
                        "provider 不存在"));
    }
}
