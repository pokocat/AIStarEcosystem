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
 * 2D→3D Mock（img23d）—— 模拟 TripoSR：产出**真实有效**的 .glb（{@link Glb} 立方体网格）+ 海报缩略图。
 * 真实可被任意 glTF 查看器加载旋转（任务书「3D 可交互 / 下载资产包」）。
 */
public class Mock3dProvider extends AbstractCapabilityProvider {

    public Mock3dProvider(AiAvatarStorage storage, ObjectMapper mapper) {
        super(AiAvatarCapability.IMG23D, AiAvatarProviderMode.MOCK, "MOCK", storage, mapper);
    }

    @Override
    public ProviderResult run(JsonNode input, AiAvatarJobContext ctx) {
        step(ctx, 15, "单图深度估计", 300);
        step(ctx, 45, "网格重建", 400);
        step(ctx, 75, "纹理烘焙", 300);

        // 海报缩略图
        AiAvatarStorage.StoredFile poster = storage.writePlaceholder(
                768, 768, "3D MODEL", "AiAvatar 3D 头模（GLB）",
                List.of("format: glb", "engine: MOCK(TripoSR)", "可旋转预览"),
                "MOCK", true, ctx.jobId().hashCode(), ctx.ownerUserId());

        // 真实 GLB
        byte[] glb = Glb.cube(0.6f, 0xF0A83A);
        AiAvatarStorage.StoredFile model = storage.writeBytes(glb, ctx.ownerUserId(), "glb", "model/gltf-binary");

        step(ctx, 95, "导出 GLB", 120);
        AssetSpec spec = AssetSpec.builder()
                .kind(AiAvatarAssetKind.MODEL_3D)
                .fileUrl(model.url())
                .thumbnailUrl(poster.url())
                .mimeType("model/gltf-binary")
                .format3d("GLB")
                .fileSize(model.bytes())
                .engine("MOCK")
                .metaJson("{\"interactive\":true,\"vertices\":8}")
                .build();
        return ProviderResult.of(spec);
    }
}
