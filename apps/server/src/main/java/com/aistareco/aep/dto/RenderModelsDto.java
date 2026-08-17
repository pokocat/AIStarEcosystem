package com.aistareco.aep.dto;

import java.util.List;

/**
 * 短剧「出片模型」下拉数据（D-11，GET /me/drama/render/models）。
 * image = 首帧图像候选（用途 IMAGE_GENERATION）；video = 视频候选（用途 VIDEO_GENERATION）。
 * 仅含启用的候选 + 启用的端点；capability 未配置（null）时装配按 legacy 兼容默认（maxRefImages→6 =
 * v0.97 前端既有上限、首尾帧→协议关键字静态判定；非降级，applied_refs 会如实回报）。
 */
public record RenderModelsDto(
        List<RenderModelOptionDto> image,
        List<RenderModelOptionDto> video
) {
    public record RenderModelOptionDto(
            String endpointId,
            String name,
            boolean isDefault,
            EndpointCapabilityDto capability,
            long creditCost,
            String billingUnit
    ) {}
}
