package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminAiModelEndpointUpsertDto;
import com.aistareco.aep.dto.AiModelDiscoveryRequestDto;
import com.aistareco.aep.dto.AiModelDiscoveryResultDto;
import com.aistareco.aep.dto.AiModelEndpointDto;
import com.aistareco.aep.dto.AiModelEndpointKeyMintedDto;
import com.aistareco.aep.dto.AiModelEntryDto;
import com.aistareco.aep.dto.AiModelProviderPresetDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * AI 模型接入端点管理（v0.41，原 AiModelProviderAdminService）。
 * 上游 apiKey 走明文进 service，加密落库；DTO 出口剥离明文，仅返回脱敏值。
 * 网关 Key 铸造 / 撤销委派给 {@link AiModelEndpointKeyService}。
 */
@Service
@Transactional
public class AiModelEndpointAdminService {

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

    private final AiModelEndpointRepository repo;
    private final AiAppBindingRepository bindingRepo;
    private final AiModelInvocationService invocation;
    private final AiModelEndpointKeyService keyService;

    public AiModelEndpointAdminService(AiModelEndpointRepository repo,
                                       AiAppBindingRepository bindingRepo,
                                       AiModelInvocationService invocation,
                                       AiModelEndpointKeyService keyService) {
        this.repo = repo;
        this.bindingRepo = bindingRepo;
        this.invocation = invocation;
        this.keyService = keyService;
    }

    /** 内置服务商预设列表（前端「快速添加」用）。 */
    public List<AiModelProviderPresetDto> listPresets() {
        return PRESETS;
    }

    public List<AiModelEndpointDto> list() {
        return repo.findAllByOrderByCreatedAtDesc().stream()
                .map(AiModelEndpointDto::from)
                .toList();
    }

    public AiModelEndpointDto get(String id) {
        return AiModelEndpointDto.from(load(id));
    }

    public AiModelEndpointDto create(AdminAiModelEndpointUpsertDto req) {
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
            throw new BusinessException(HttpStatus.CONFLICT, "ENDPOINT_DUPLICATE", "端点 id 已存在");
        }
        AiModelEndpoint entity = AiModelEndpoint.builder()
                .id(id)
                .name(req.name())
                .providerType(req.providerType() != null
                        ? AiModelProviderType.fromWire(req.providerType())
                        : AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl(req.baseUrl())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt(req.apiKey()))
                .apiVersion(req.apiVersion())
                .model(req.model())
                .modelsJson(serializeModels(req.models()))
                .ownerUserId(blankToNull(req.ownerUserId()))
                .enabled(req.enabled() != null ? req.enabled() : true)
                .build();
        return AiModelEndpointDto.from(repo.save(entity));
    }

    public AiModelEndpointDto update(String id, AdminAiModelEndpointUpsertDto req) {
        AiModelEndpoint entity = load(id);
        if (req.name() != null) entity.setName(req.name());
        if (req.providerType() != null) entity.setProviderType(AiModelProviderType.fromWire(req.providerType()));
        if (req.baseUrl() != null) entity.setBaseUrl(req.baseUrl());
        if (req.apiKey() != null && !req.apiKey().isBlank()) {
            entity.setUpstreamApiKeyEncrypted(AepCryptoUtil.encrypt(req.apiKey()));
        }
        if (req.apiVersion() != null) entity.setApiVersion(req.apiVersion());
        if (req.model() != null) entity.setModel(req.model());
        if (req.models() != null) entity.setModelsJson(serializeModels(req.models()));
        // ownerUserId：null = 不改；"" = 清空为平台级；非空 = 设置
        if (req.ownerUserId() != null) entity.setOwnerUserId(blankToNull(req.ownerUserId()));
        if (req.enabled() != null) entity.setEnabled(req.enabled());
        return AiModelEndpointDto.from(repo.save(entity));
    }

    public void delete(String id) {
        if (!repo.existsById(id)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "ENDPOINT_NOT_FOUND", "AI 模型端点不存在");
        }
        long bound = bindingRepo.countByEndpointId(id);
        if (bound > 0) {
            throw new BusinessException(HttpStatus.CONFLICT, "ENDPOINT_IN_USE",
                    "该端点还有 " + bound + " 个 AI 应用绑定，请先在「AI 应用绑定」改绑或解绑后再删除。");
        }
        repo.deleteById(id);
    }

    public Map<String, Object> testConnection(String id) {
        return invocation.testConnection(id);
    }

    /** 给端点铸造（或重铸）网关 Key，明文一次性返回。 */
    public AiModelEndpointKeyMintedDto mintKey(String id) {
        return keyService.mintKey(id);
    }

    /** 撤销端点的网关 Key。 */
    public AiModelEndpointDto revokeKey(String id) {
        return keyService.revokeKey(id);
    }

    /** 新建端点前：用表单里填的 baseUrl + apiKey 直接拉取可用模型（不落库）。 */
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

    /** 已存端点：用落库（解密后）的 apiKey 拉取可用模型（不落库；前端拉回后由保存写入）。 */
    public AiModelDiscoveryResultDto fetchModels(String id) {
        AiModelEndpoint entity = load(id);
        String apiKey;
        try {
            apiKey = AepCryptoUtil.decrypt(entity.getUpstreamApiKeyEncrypted());
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

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private AiModelEndpoint load(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ENDPOINT_NOT_FOUND",
                        "AI 模型端点不存在"));
    }
}
