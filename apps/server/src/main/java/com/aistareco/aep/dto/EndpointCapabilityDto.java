package com.aistareco.aep.dto;

import com.aistareco.aep.model.AiAppEndpointCandidate;

/**
 * 端点能力画像（D-11）：candidate 上「端点在某用途下」的能力元数据。
 * 字段为 null = 未知，消费方（C-3 参考装配 / 前端出片模型下拉）按 legacy 兼容默认处理
 * （maxRefImages→6、首尾帧→协议关键字静态判定；显式配置最高优先）
 * （maxRefImages=1 / supportsFirstLastFrame=false / supportsSubjectReference=false）。
 */
public record EndpointCapabilityDto(
        Integer maxRefImages,
        Boolean supportsFirstLastFrame,
        Boolean supportsSubjectReference,
        Integer maxDurationSec
) {
    public static EndpointCapabilityDto from(AiAppEndpointCandidate c) {
        if (c == null) return new EndpointCapabilityDto(null, null, null, null);
        return new EndpointCapabilityDto(c.getMaxRefImages(), c.getSupportsFirstLastFrame(),
                c.getSupportsSubjectReference(), c.getMaxDurationSec());
    }
}
