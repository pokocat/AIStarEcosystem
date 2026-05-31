package com.aistareco.aep.aiavatar.provider.impl;

import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.provider.AbstractCapabilityProvider;
import com.aistareco.aep.aiavatar.provider.AssetSpec;
import com.aistareco.aep.aiavatar.provider.AiAvatarJobContext;
import com.aistareco.aep.aiavatar.provider.ProviderResult;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.awt.*;
import java.awt.geom.Ellipse2D;
import java.awt.image.BufferedImage;

/**
 * 局部区域分割 Mock（segment）—— 模拟 SAM / face-parsing，产出 inpaint mask（黑底白区）。
 */
public class MockSegmentProvider extends AbstractCapabilityProvider {

    private static final int W = 768;
    private static final int H = 1024;

    public MockSegmentProvider(AiAvatarStorage storage, ObjectMapper mapper) {
        super(AiAvatarCapability.SEGMENT, AiAvatarProviderMode.MOCK, "MOCK", storage, mapper);
    }

    @Override
    public ProviderResult run(JsonNode input, AiAvatarJobContext ctx) {
        step(ctx, 30, "运行分割模型", 200);
        step(ctx, 80, "生成蒙版", 200);

        BufferedImage mask = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = mask.createGraphics();
        g.setColor(Color.BLACK);
        g.fillRect(0, 0, W, H);
        g.setColor(Color.WHITE);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        // 面部区域椭圆白区（可被 rect 覆盖）
        double rx = dblVal(input, "rectX", 0.30) * W;
        double ry = dblVal(input, "rectY", 0.22) * H;
        double rw = dblVal(input, "rectW", 0.40) * W;
        double rh = dblVal(input, "rectH", 0.30) * H;
        g.fill(new Ellipse2D.Double(rx, ry, rw, rh));
        g.dispose();

        AiAvatarStorage.StoredFile sf = storage.writeImagePng(mask, ctx.ownerUserId());
        AssetSpec spec = AssetSpec.builder()
                .kind(AiAvatarAssetKind.MASK)
                .fileUrl(sf.url())
                .thumbnailUrl(sf.url())
                .mimeType("image/png")
                .width(sf.width())
                .height(sf.height())
                .fileSize(sf.bytes())
                .engine("MOCK")
                .build();
        return ProviderResult.of(spec);
    }
}
