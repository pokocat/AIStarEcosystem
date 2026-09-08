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
        Integer maxDurationSec,
        /**
         * 视频时长下限（秒）；null = 未知。来自**协议**硬边界（如聚算媒体协议 5–15 秒），
         * 后台那张候选表里没有这一列 —— 只有厂商知道，运营填不出来。
         * 前端拿它把时长滑杆夹到可提交区间：不给的话滑杆是 4–30，
         * 用户随手选个 4 秒就撞 400 `VIDEO_DURATION_UNSUPPORTED`（v0.176）。
         */
        Integer minDurationSec,
        /** 出图最小像素数（宽 × 高）；null = 无下限。见 AiAppEndpointCandidate#minImagePixels。 */
        Integer minImagePixels,
        /**
         * 出视频**真正能出**的清晰度短边（如 ["768"]）；null = 不受限。
         * 与时长下限同理：只有协议知道，后台那张候选表里没有这一列。
         */
        java.util.List<String> videoResolutions,
        /** 出视频**真正能出**的比例（如 ["16:9","9:16"]）；null = 不受限。 */
        java.util.List<String> videoRatios
) {
    public static EndpointCapabilityDto from(AiAppEndpointCandidate c) {
        return from(c, null, null, null);
    }

    /** 带**有效**时长区间（协议硬边界 ∩ 候选配置）+ 可出画幅的版本；视频用途用它。 */
    public static EndpointCapabilityDto from(AiAppEndpointCandidate c, Integer minSec, Integer maxSec,
                                             com.aistareco.aep.service.materialvideo.MaterialVideoModelClient.VideoGeometry geo) {
        java.util.List<String> res = geo == null ? null : geo.resolutions();
        java.util.List<String> ratios = geo == null ? null : geo.ratios();
        if (c == null) return new EndpointCapabilityDto(null, null, null, maxSec, minSec, null, res, ratios);
        return new EndpointCapabilityDto(c.getMaxRefImages(), c.getSupportsFirstLastFrame(),
                c.getSupportsSubjectReference(),
                maxSec != null ? maxSec : c.getMaxDurationSec(), minSec, c.getMinImagePixels(), res, ratios);
    }
}
