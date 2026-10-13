package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.platform.ModelFeatureRegistry;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/** Model classification and application availability are operator configuration, not supplier URL rules. */
@Service
public class AiModelAccessPolicyService {
    private static final String PREFIX = "ai.model-access.";
    public record Policy(List<String> categories, String scope, List<String> appCodes) {}

    private final PlatformConfigService config;
    private final AiModelEndpointRepository endpoints;
    private final ObjectMapper mapper;

    public AiModelAccessPolicyService(PlatformConfigService config, AiModelEndpointRepository endpoints, ObjectMapper mapper) {
        this.config = config;
        this.endpoints = endpoints;
        this.mapper = mapper;
    }

    public Policy get(String endpointId) {
        return config.findByKey(PREFIX + endpointId).map(saved -> {
            try {
                Policy policy = mapper.treeToValue(saved.value(), Policy.class);
                validate(policy);
                return policy;
            } catch (Exception exception) {
                throw BusinessException.badRequest("MODEL_ACCESS_INVALID", "模型开放范围配置无效");
            }
        }).orElse(new Policy(List.of("unclassified"), "all", List.of()));
    }

    public boolean allows(AiModelEndpoint endpoint, String appCode) {
        return allows(endpoint.getId(), appCode);
    }

    public boolean allows(String endpointId, String appCode) {
        Policy policy = get(endpointId);
        return "all".equals(policy.scope()) || appCode != null && policy.appCodes().contains(appCode);
    }

    @Transactional
    public Policy save(String endpointId, Policy policy, String actor) {
        if (!endpoints.existsById(endpointId)) throw BusinessException.badRequest("MODEL_ACCESS_INVALID", "模型不存在");
        validate(policy);
        config.lockExisting(PREFIX + endpointId);
        config.upsert(PREFIX + endpointId, mapper.valueToTree(policy), "模型类型与应用开放范围", actor);
        return policy;
    }

    private void validate(Policy policy) {
        if (policy == null || policy.categories() == null || policy.categories().isEmpty()
                || policy.categories().size() > 8
                || policy.categories().stream().anyMatch(category -> category == null || !category.matches("[a-z][a-z0-9_-]{1,31}"))
                || policy.categories().size() != Set.copyOf(policy.categories()).size()
                || !Set.of("all", "selected").contains(policy.scope() == null ? "" : policy.scope())
                || policy.appCodes() == null || policy.appCodes().stream().anyMatch(app -> app == null || app.isBlank())
                || policy.appCodes().size() != Set.copyOf(policy.appCodes()).size()
                || "all".equals(policy.scope()) && !policy.appCodes().isEmpty()
                || "selected".equals(policy.scope()) && policy.appCodes().isEmpty()
                || policy.appCodes().stream().anyMatch(app -> ModelFeatureRegistry.FEATURES.stream().noneMatch(feature -> feature.appCode().equals(app)))) {
            throw BusinessException.badRequest("MODEL_ACCESS_INVALID", "模型类型或应用开放范围无效");
        }
    }
}
