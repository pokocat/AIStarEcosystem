package com.aistareco.aep.service;

import com.aistareco.aep.dto.InternalUpstreamDto;
import com.aistareco.aep.model.AiModelProvider;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.repository.AiModelProviderRepository;
import com.aistareco.common.AepCryptoUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 仅给内部 controller（/api/internal/ai-models/upstreams）用。
 * 把 enabled provider 解密 apiKey 后吐给 llm-gateway。
 *
 * model 前缀由 providerType 静态推导——避免给 ai_model_providers 表加字段。
 * 后续若需要细粒度路由，再迁到 DB 列。
 */
@Service
public class AiModelProviderInternalService {

    private static final Logger log = LoggerFactory.getLogger(AiModelProviderInternalService.class);

    private static final Map<AiModelProviderType, List<String>> PREFIXES_BY_TYPE = Map.of(
            AiModelProviderType.VOLCENGINE, List.of("doubao-", "ep-"),
            AiModelProviderType.ALIYUN, List.of("qwen-", "qwq-", "qvq-"),
            AiModelProviderType.MOONSHOT, List.of("moonshot-", "kimi-"),
            AiModelProviderType.DEEPSEEK, List.of("deepseek-"),
            AiModelProviderType.OPENAI, List.of("gpt-", "o1-", "o3-", "chatgpt-"),
            AiModelProviderType.ANTHROPIC, List.of("claude-"),
            AiModelProviderType.AZURE_OPENAI, List.of("azure-"),
            AiModelProviderType.BAIDU, List.of("ernie-"),
            AiModelProviderType.TENCENT, List.of("hunyuan-")
    );

    private final AiModelProviderRepository repo;

    public AiModelProviderInternalService(AiModelProviderRepository repo) {
        this.repo = repo;
    }

    public List<InternalUpstreamDto> listEnabledUpstreams() {
        return repo.findByEnabledTrueOrderByPriorityAsc().stream()
                .map(this::toDto)
                .filter(d -> !d.modelPrefixes().isEmpty())
                .toList();
    }

    private InternalUpstreamDto toDto(AiModelProvider p) {
        String apiKey;
        try {
            apiKey = AepCryptoUtil.decrypt(p.getApiKeyEncrypted());
        } catch (Exception e) {
            log.warn("provider {} apiKey 解密失败，跳过 ({})", p.getId(), e.getMessage());
            apiKey = "";
        }
        List<String> prefixes = PREFIXES_BY_TYPE.getOrDefault(p.getProviderType(), List.of());
        return new InternalUpstreamDto(
                p.getId(),
                p.getProviderType().wire(),
                p.getBaseUrl(),
                apiKey,
                p.getDefaultModel(),
                prefixes,
                p.getPriority(),
                p.isEnabled()
        );
    }
}
