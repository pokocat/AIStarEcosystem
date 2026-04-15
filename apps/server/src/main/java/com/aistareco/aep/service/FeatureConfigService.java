package com.aistareco.aep.service;

import com.aistareco.aep.dto.ConfigChangeLogDto;
import com.aistareco.aep.dto.FeatureConfigDto;
import com.aistareco.aep.model.ConfigChangeLog;
import com.aistareco.aep.model.FeatureConfig;
import com.aistareco.aep.model.PlanFeatureOverride;
import com.aistareco.aep.repository.ConfigChangeLogRepository;
import com.aistareco.aep.repository.FeatureConfigRepository;
import com.aistareco.aep.repository.PlanFeatureOverrideRepository;
import com.aistareco.aep.security.AdminPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FeatureConfigService {

    private final FeatureConfigRepository featureConfigRepository;
    private final ConfigChangeLogRepository changeLogRepository;
    private final PlanFeatureOverrideRepository planFeatureOverrideRepository;

    public FeatureConfigService(
            FeatureConfigRepository featureConfigRepository,
            ConfigChangeLogRepository changeLogRepository,
            PlanFeatureOverrideRepository planFeatureOverrideRepository
    ) {
        this.featureConfigRepository = featureConfigRepository;
        this.changeLogRepository = changeLogRepository;
        this.planFeatureOverrideRepository = planFeatureOverrideRepository;
    }

    public Page<FeatureConfigDto> list(String group, Pageable pageable) {
        Page<FeatureConfig> page = (group == null || group.isBlank())
                ? featureConfigRepository.findAll(pageable)
                : featureConfigRepository.findByConfigGroup(group, pageable);
        return page.map(FeatureConfigDto::from);
    }

    public FeatureConfigDto get(String key) {
        return FeatureConfigDto.from(findConfigByKey(key));
    }

    public List<String> groups() {
        return featureConfigRepository.findAll().stream()
                .map(FeatureConfig::getConfigGroup)
                .distinct()
                .sorted()
                .toList();
    }

    public List<ConfigChangeLogDto> history(String key) {
        return changeLogRepository.findByConfigKeyOrderByCreatedAtDesc(key).stream()
                .map(ConfigChangeLogDto::from)
                .toList();
    }

    @Transactional
    public FeatureConfigDto update(String key, Map<String, Object> body, AdminPrincipal principal) {
        FeatureConfig config = findConfigByKey(key);
        String value = stringValue(body.get("value"));
        String reason = stringValue(body.get("change_reason"));
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Config value is required");
        }
        if (reason == null || reason.trim().length() < 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "change_reason must be at least 10 characters");
        }

        Instant now = Instant.now();
        Instant effectiveAt = body.get("effective_at") != null
                ? Instant.parse(body.get("effective_at").toString())
                : now;

        changeLogRepository.save(ConfigChangeLog.builder()
                .id(UUID.randomUUID().toString())
                .configKey(key)
                .oldValue(config.getValue())
                .newValue(value)
                .changedBy(principal.userId())
                .changedByRole(principal.role().name())
                .changeReason(reason)
                .effectiveAt(effectiveAt)
                .createdAt(now)
                .build());

        config.setValue(value);
        config.setUpdatedBy(principal.userId());
        config.setUpdatedAt(now);
        return FeatureConfigDto.from(featureConfigRepository.save(config));
    }

    @Transactional
    public FeatureConfigDto revert(String key, AdminPrincipal principal) {
        FeatureConfig config = findConfigByKey(key);
        List<ConfigChangeLog> history = changeLogRepository.findByConfigKeyOrderByCreatedAtDesc(key);
        if (history.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No config history to revert");
        }

        ConfigChangeLog lastChange = history.get(0);
        String revertedValue = lastChange.getOldValue();
        Instant now = Instant.now();
        lastChange.setRevertedAt(now);
        changeLogRepository.save(lastChange);

        changeLogRepository.save(ConfigChangeLog.builder()
                .id(UUID.randomUUID().toString())
                .configKey(key)
                .oldValue(config.getValue())
                .newValue(revertedValue)
                .changedBy(principal.userId())
                .changedByRole(principal.role().name())
                .changeReason("Revert to previous version")
                .effectiveAt(now)
                .createdAt(now)
                .build());

        config.setValue(revertedValue);
        config.setUpdatedBy(principal.userId());
        config.setUpdatedAt(now);
        return FeatureConfigDto.from(featureConfigRepository.save(config));
    }

    public Map<String, Object> frontendConfig() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("credits", flattenGroup("credits."));
        response.put("quota", quotaGroup());
        response.put("feature", flattenGroup("feature."));
        response.put("ui", flattenGroup("ui."));
        return response;
    }

    public Map<String, Object> frontendConfigGroup(String group) {
        return switch (group) {
            case "credits" -> flattenGroup("credits.");
            case "quota" -> quotaGroup();
            case "feature" -> flattenGroup("feature.");
            case "ui" -> flattenGroup("ui.");
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unsupported config group: " + group);
        };
    }

    public Map<String, Object> planLimits() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("singer_slot", mapByPlans("quota.singer_slot"));
        response.put("music_generate.daily", mapByPlans("quota.music_generate.daily"));
        response.put("track_publish.monthly", mapByPlans("quota.track_publish.monthly"));
        response.put("nft_mint.monthly", mapByPlans("quota.nft_mint.monthly"));
        return response;
    }

    public Object resolveSingleValue(String key, String tenantId, String planId, String productId) {
        FeatureConfig config = findConfigByKey(key);
        return parseTypedValue(resolveValue(config, tenantId, planId, productId), config.getValueType());
    }

    public Map<String, Object> resolveMany(List<String> keys, Map<String, Object> context) {
        String tenantId = stringValue(context.get("tenant_id"));
        String planId = stringValue(context.get("plan_id"));
        String productId = stringValue(context.get("product_id"));
        Map<String, Object> resolved = new LinkedHashMap<>();
        for (String key : keys) {
            FeatureConfig config = findConfigByKey(key);
            resolved.put(key, parseTypedValue(resolveValue(config, tenantId, planId, productId), config.getValueType()));
        }
        return resolved;
    }

    private FeatureConfig findConfigByKey(String key) {
        return featureConfigRepository.findByConfigKey(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Config not found: " + key));
    }

    private String resolveValue(FeatureConfig config, String tenantId, String planId, String productId) {
        if (config.getScope() == FeatureConfig.Scope.TENANT && Objects.equals(config.getTenantId(), tenantId)) {
            return config.getValue();
        }

        if (planId != null) {
            Optional<PlanFeatureOverride> planOverride = planFeatureOverrideRepository.findByPlanIdAndConfigKeyAndIsActiveTrue(planId, config.getConfigKey());
            if (planOverride.isPresent()) {
                return planOverride.get().getOverrideValue();
            }
        }

        return config.getValue();
    }

    private Map<String, Object> flattenGroup(String prefix) {
        return featureConfigRepository.findByConfigKeyStartingWithAndIsActiveTrue(prefix).stream()
                .collect(Collectors.toMap(
                        item -> item.getConfigKey().substring(prefix.length()),
                        item -> parseTypedValue(item.getValue(), item.getValueType()),
                        (left, right) -> right,
                        LinkedHashMap::new
                ));
    }

    private Map<String, Object> quotaGroup() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("singer_slot", mapByPlans("quota.singer_slot"));
        response.put("music_generate.daily", mapByPlans("quota.music_generate.daily"));
        response.put("track_publish.monthly", mapByPlans("quota.track_publish.monthly"));
        response.put("nft_mint.monthly", mapByPlans("quota.nft_mint.monthly"));
        return response;
    }

    private Map<String, Object> mapByPlans(String prefix) {
        Map<String, Object> response = new LinkedHashMap<>();
        for (String plan : List.of("free", "pro", "enterprise")) {
            featureConfigRepository.findByConfigKey(prefix + "." + plan)
                    .ifPresent(config -> response.put(plan, parseTypedValue(config.getValue(), config.getValueType())));
        }
        return response;
    }

    private Object parseTypedValue(String raw, FeatureConfig.ValueType valueType) {
        if (raw == null) {
            return null;
        }
        return switch (valueType) {
            case INT -> Integer.parseInt(raw);
            case FLOAT -> Double.parseDouble(raw);
            case BOOL -> Boolean.parseBoolean(raw);
            case STRING, JSON -> raw;
        };
    }

    private String stringValue(Object value) {
        return value != null ? value.toString() : null;
    }
}
