package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminAiModelProviderUpsertDto;
import com.aistareco.aep.dto.AiModelDiscoveryRequestDto;
import com.aistareco.aep.dto.AiModelDiscoveryResultDto;
import com.aistareco.aep.dto.AiModelEntryDto;
import com.aistareco.aep.dto.AiModelProviderDto;
import com.aistareco.aep.dto.AiModelProviderPresetDto;
import com.aistareco.aep.model.AiModelProvider;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.repository.AiModelProviderRepository;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
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

    private static final ObjectMapper OM = new ObjectMapper();

    /** 内置常见大模型服务商预设（仅模板，不落库）。admin 选中后填 apiKey 即可建档。 */
    private static final List<AiModelProviderPresetDto> PRESETS = List.of(
            new AiModelProviderPresetDto("volcengine-ark", "火山引擎方舟（豆包 Doubao）", "VOLCENGINE",
                    "https://ark.cn-beijing.volces.com/api/v3", "doubao-1-5-pro-32k",
                    "https://www.volcengine.com/docs/82379/1099475",
                    "在火山方舟控制台「API Key 管理」创建，形如 ark-xxxxxxxx。"),
            new AiModelProviderPresetDto("moonshot-kimi", "Kimi（月之暗面 Moonshot）", "MOONSHOT",
                    "https://api.moonshot.cn/v1", "moonshot-v1-8k",
                    "https://platform.moonshot.cn/docs",
                    "在 platform.moonshot.cn「用户中心 · API Key」创建，形如 sk-xxxxxxxx。"),
            new AiModelProviderPresetDto("deepseek", "DeepSeek 深度求索", "DEEPSEEK",
                    "https://api.deepseek.com", "deepseek-chat",
                    "https://api-docs.deepseek.com",
                    "在 platform.deepseek.com「API keys」创建，形如 sk-xxxxxxxx。"),
            new AiModelProviderPresetDto("qwen-dashscope", "阿里千问（百炼 DashScope 兼容模式）", "ALIYUN",
                    "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus",
                    "https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope",
                    "在阿里云百炼控制台创建 API-KEY，形如 sk-xxxxxxxx。"),
            new AiModelProviderPresetDto("openai", "OpenAI", "OPENAI",
                    "https://api.openai.com/v1", "gpt-4o-mini",
                    "https://platform.openai.com/docs/api-reference",
                    "在 platform.openai.com「API keys」创建，形如 sk-xxxxxxxx。")
    );

    private final AiModelProviderRepository repo;
    private final AiModelInvocationService invocation;

    public AiModelProviderAdminService(AiModelProviderRepository repo,
                                        AiModelInvocationService invocation) {
        this.repo = repo;
        this.invocation = invocation;
    }

    /** 内置服务商预设列表（前端「快速添加」用）。 */
    public List<AiModelProviderPresetDto> listPresets() {
        return PRESETS;
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
                .modelsJson(serializeModels(req.models()))
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
        if (req.models() != null) entity.setModelsJson(serializeModels(req.models()));
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

    /** 新建 provider 前：用表单里填的 baseUrl + apiKey 直接拉取可用模型（不落库）。 */
    public AiModelDiscoveryResultDto discoverModels(AiModelDiscoveryRequestDto req) {
        if (req == null || req.baseUrl() == null || req.baseUrl().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "BASE_URL_REQUIRED", "baseUrl 必填");
        }
        if (req.apiKey() == null || req.apiKey().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "API_KEY_REQUIRED", "apiKey 必填");
        }
        AiModelProviderType type = req.providerType() != null
                ? AiModelProviderType.fromWire(req.providerType())
                : AiModelProviderType.OPENAI_COMPATIBLE;
        return invocation.listModels(type, req.baseUrl(), req.apiKey());
    }

    /** 已存 provider：用落库（解密后）的 apiKey 拉取可用模型（不落库；前端拉回后由保存写入）。 */
    public AiModelDiscoveryResultDto fetchModels(String id) {
        AiModelProvider entity = load(id);
        String apiKey;
        try {
            apiKey = AepCryptoUtil.decrypt(entity.getApiKeyEncrypted());
        } catch (Exception e) {
            return AiModelDiscoveryResultDto.fail(null, "已存 apiKey 解密失败：" + e.getMessage());
        }
        return invocation.listModels(entity.getProviderType(), entity.getBaseUrl(), apiKey);
    }

    private static String serializeModels(List<AiModelEntryDto> models) {
        if (models == null) return null;
        try {
            return OM.writeValueAsString(models);
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "MODELS_SERIALIZE_FAILED", "models 序列化失败");
        }
    }

    private AiModelProvider load(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PROVIDER_NOT_FOUND",
                        "provider 不存在"));
    }
}
