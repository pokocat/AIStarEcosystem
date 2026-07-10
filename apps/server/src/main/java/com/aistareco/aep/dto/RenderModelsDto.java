package com.aistareco.aep.dto;

import java.util.List;

/**
 * 短剧「出片模型」下拉数据（D-11，GET /me/drama/render/models）。
 * image = 首帧图像候选（用途 IMAGE_GENERATION）；video = 视频候选（用途 VIDEO_GENERATION）。
 * 仅含启用的候选 + 启用的端点；capability 全 null 时前端按保守默认少送参考（非降级，applied_refs 会如实回报）。
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
            long creditCost
    ) {}
}
