package com.aistareco.aep.aiavatar.provider.impl;

import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.provider.*;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

/**
 * 图生视频 Mock（img2video）—— 模拟 SVD-XT 的「缓慢运镜」。
 *
 * 本环境无 ffmpeg；产出一张海报帧 + meta{effect:ken_burns}。前端 VideoPreview 组件对 posterOnly 资产
 * 用 CSS 缓慢推拉（运镜）实现「可播放」预览（DECISIONS.md）。接 SVD 后 fileUrl 换真实 mp4，组件走 &lt;video&gt;。
 */
public class MockVideoProvider extends AbstractCapabilityProvider {

    public MockVideoProvider(AiAvatarStorage storage, ObjectMapper mapper) {
        super(AiAvatarCapability.IMG2VIDEO, AiAvatarProviderMode.MOCK, "MOCK", storage, mapper);
    }

    @Override
    public ProviderResult run(JsonNode input, AiAvatarJobContext ctx) {
        int duration = Math.max(5, Math.min(30, intVal(input, "videoDurationSec", 10)));
        step(ctx, 20, "关键帧插值", 400);
        step(ctx, 55, "运镜轨迹合成 (" + duration + "s)", 500);
        step(ctx, 85, "编码", 300);

        AiAvatarStorage.StoredFile poster = storage.writePlaceholder(
                720, 1280, "VIDEO " + duration + "s", "缓慢运镜 · SVD(MOCK)",
                List.of("effect: ken_burns", "fps: 25", "engine: MOCK(SVD)", "仅运镜 · 无动作驱动"),
                "MOCK", true, ctx.jobId().hashCode(), ctx.ownerUserId());

        AssetSpec spec = AssetSpec.builder()
                .kind(AiAvatarAssetKind.VIDEO)
                .fileUrl(poster.url())
                .thumbnailUrl(poster.url())
                .mimeType("image/png")          // posterOnly：前端用 CSS 运镜呈现
                .width(poster.width())
                .height(poster.height())
                .fileSize(poster.bytes())
                .durationSec(duration)
                .engine("MOCK")
                .metaJson("{\"effect\":\"ken_burns\",\"posterOnly\":true,\"fps\":25}")
                .build();
        return ProviderResult.of(spec);
    }
}
