package com.aistareco.aep.aiavatar.provider.impl;

import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.model.AiAvatarStandardShot;
import com.aistareco.aep.aiavatar.provider.AbstractCapabilityProvider;
import com.aistareco.aep.aiavatar.provider.AssetSpec;
import com.aistareco.aep.aiavatar.provider.AiAvatarJobContext;
import com.aistareco.aep.aiavatar.provider.ProviderResult;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

/**
 * 图像类能力 Mock（faceClone / txt2img / img2img / inpaint / makeup / hair / restore）。
 *
 * 产出真实可查看的占位 PNG（{@link com.aistareco.aep.aiavatar.provider.AiAvatarImageGen}）：带能力名 / prompt /
 * 参数 / MOCK 角标 / 人像剪影，并模拟真实进度事件与延迟，使任务管线在 mock 下被同等走通（任务书 §5）。
 *
 * 支持两种产出形态：
 *  - 标准出图：input.standardShots=[front_bust,...] → 每构图一张（kind=image_2d, standardShot 标注）
 *  - 多版打样 / 单版编辑：input.variants=N → N 张
 */
public class MockImageProvider extends AbstractCapabilityProvider {

    private static final int W = 768;
    private static final int H = 1024;

    public MockImageProvider(AiAvatarCapability capability, AiAvatarStorage storage, ObjectMapper mapper) {
        super(capability, AiAvatarProviderMode.MOCK, "MOCK", storage, mapper);
    }

    @Override
    public ProviderResult run(JsonNode input, AiAvatarJobContext ctx) {
        String prompt = strVal(input, "prompt", "");
        step(ctx, 8, "解析输入与人设关键词", 200);
        step(ctx, 25, capabilityVerb() + "：构图与基底", 350);

        List<String> shots = readStandardShots(input);
        List<AssetSpec> out = new ArrayList<>();

        if (!shots.isEmpty()) {
            // 标准出图：逐构图渲染
            int n = shots.size();
            for (int i = 0; i < n; i++) {
                if (ctx.isCancelled()) break;
                AiAvatarStandardShot shot = AiAvatarStandardShot.fromWire(shots.get(i));
                int pct = 25 + (int) ((i + 1) * 60.0 / n);
                step(ctx, pct, "出图 " + shot.label() + " (" + (i + 1) + "/" + n + ")", 300);
                out.add(renderOne(ctx, shot, i, prompt, AiAvatarAssetKind.IMAGE_2D));
            }
        } else {
            int variants = Math.max(1, Math.min(8, intVal(input, "variants", defaultVariants())));
            for (int i = 0; i < variants; i++) {
                if (ctx.isCancelled()) break;
                int pct = 25 + (int) ((i + 1) * 60.0 / variants);
                step(ctx, pct, "生成第 " + (i + 1) + "/" + variants + " 版", 350);
                out.add(renderOne(ctx, null, i, prompt, resultKind()));
            }
        }

        step(ctx, 96, "写入资产库", 120);
        return ProviderResult.of(out);
    }

    private AssetSpec renderOne(AiAvatarJobContext ctx, AiAvatarStandardShot shot, int idx, String prompt, AiAvatarAssetKind kind) {
        long seed = (ctx.jobId() + ":" + idx + ":" + (shot == null ? "" : shot.wire())).hashCode();
        List<String> lines = new ArrayList<>();
        lines.add("cap   : " + capability.wire());
        if (shot != null) lines.add("shot  : " + shot.wire());
        else lines.add("variant: #" + (idx + 1));
        if (prompt != null && !prompt.isBlank()) {
            lines.add("prompt: " + clip(prompt, 28));
        }
        lines.add("engine: MOCK");
        String subtitle = shot != null ? shot.label() : (capability.label() + " · 第 " + (idx + 1) + " 版");
        AiAvatarStorage.StoredFile sf = storage.writePlaceholder(
                W, H, capability.wire().toUpperCase(), subtitle, lines, "MOCK", true, seed, ctx.ownerUserId());
        return AssetSpec.builder()
                .kind(kind)
                .standardShot(shot)
                .fileUrl(sf.url())
                .thumbnailUrl(sf.url())
                .mimeType("image/png")
                .width(sf.width())
                .height(sf.height())
                .fileSize(sf.bytes())
                .engine("MOCK")
                .build();
    }

    private List<String> readStandardShots(JsonNode input) {
        List<String> shots = new ArrayList<>();
        if (input != null && input.has("standardShots") && input.get("standardShots").isArray()) {
            for (JsonNode n : input.get("standardShots")) shots.add(n.asText());
        }
        return shots;
    }

    private int defaultVariants() {
        return switch (capability) {
            case FACE_CLONE, TXT2IMG -> 3;   // 打样一次出 3~5 版
            default -> 1;
        };
    }

    private AiAvatarAssetKind resultKind() {
        return switch (capability) {
            case FACE_CLONE, TXT2IMG, IMG2IMG -> AiAvatarAssetKind.DRAFT_IMAGE;
            default -> AiAvatarAssetKind.IMAGE_2D;
        };
    }

    private String capabilityVerb() {
        return switch (capability) {
            case FACE_CLONE -> "ID 保持复刻";
            case TXT2IMG -> "文生图";
            case IMG2IMG -> "指令编辑";
            case INPAINT -> "局部重绘";
            case MAKEUP -> "妆容迁移";
            case HAIR -> "发型变换";
            case RESTORE -> "美颜修复";
            default -> "生成";
        };
    }

    private static String clip(String s, int n) {
        return s.length() <= n ? s : s.substring(0, n) + "…";
    }
}
