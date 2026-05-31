package com.aistareco.aep.aiavatar.provider.impl;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.provider.AbstractCapabilityProvider;
import com.aistareco.aep.aiavatar.provider.AiAvatarJobContext;
import com.aistareco.aep.aiavatar.provider.ProviderResult;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * 人脸合规检测 Mock（faceDetect）—— 模拟 InsightFace(RetinaFace) 的遮挡 / 模糊 / 多脸筛查。
 * 返回结构化合规判定 metaJson（无资产产出）。
 */
public class MockFaceDetectProvider extends AbstractCapabilityProvider {

    public MockFaceDetectProvider(AiAvatarStorage storage, ObjectMapper mapper) {
        super(AiAvatarCapability.FACE_DETECT, AiAvatarProviderMode.MOCK, "MOCK", storage, mapper);
    }

    @Override
    public ProviderResult run(JsonNode input, AiAvatarJobContext ctx) {
        step(ctx, 20, "载入人脸检测模型", 150);
        step(ctx, 55, "检测人脸 / 遮挡 / 模糊 / 多脸", 250);
        step(ctx, 90, "汇总合规判定", 120);

        ObjectNode r = mapper.createObjectNode();
        r.put("faces", 1);
        r.put("occlusion", false);
        r.put("blur", false);
        r.put("multiFace", false);
        r.put("brightness", "normal");
        r.put("passed", true);
        r.put("reason", "");
        r.put("engine", "MOCK");
        return ProviderResult.meta(r.toString());
    }
}
