package com.aistareco.aep.service;

import com.aistareco.aep.dto.InternalUpstreamDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.AepCryptoUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 仅给内部 controller（/api/internal/ai-models/upstreams）用（v0.41，原 AiModelProviderInternalService）。
 * 把 enabled 端点解密上游 apiKey 后吐给 llm-gateway。
 *
 * v0.41：端点已是「固定单模型」，modelPrefixes 直接取 [endpoint.model]（精确模型即自身前缀，
 * 网关 {@code Upstream.matches} 的 startsWith 仍生效）。model 为空的端点不下发。
 */
@Service
public class AiModelEndpointInternalService {

    private static final Logger log = LoggerFactory.getLogger(AiModelEndpointInternalService.class);

    private final AiModelEndpointRepository repo;

    public AiModelEndpointInternalService(AiModelEndpointRepository repo) {
        this.repo = repo;
    }

    public List<InternalUpstreamDto> listEnabledUpstreams() {
        return repo.findByEnabledTrue().stream()
                .map(this::toDto)
                .filter(d -> d.modelPrefixes() != null && !d.modelPrefixes().isEmpty())
                .toList();
    }

    private InternalUpstreamDto toDto(AiModelEndpoint e) {
        String apiKey;
        try {
            apiKey = AepCryptoUtil.decrypt(e.getUpstreamApiKeyEncrypted());
        } catch (Exception ex) {
            log.warn("endpoint {} 上游 apiKey 解密失败，跳过 ({})", e.getId(), ex.getMessage());
            apiKey = "";
        }
        // 固定单模型：精确 model 即唯一 prefix（startsWith 自身恒真）。model 空 → 空列表（被过滤掉）。
        List<String> prefixes = (e.getModel() != null && !e.getModel().isBlank())
                ? List.of(e.getModel())
                : List.of();
        return new InternalUpstreamDto(
                e.getId(),
                e.getProviderType() != null ? e.getProviderType().wire() : null,
                e.getBaseUrl(),
                apiKey,
                e.getModel(),
                prefixes,
                100, // v0.41 无优先级语义，下发固定值
                e.isEnabled()
        );
    }
}
