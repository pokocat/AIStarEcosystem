package com.aistareco.aep.aiavatar.provider;

import java.util.ArrayList;
import java.util.List;

/**
 * Provider 一次运行的产出（任务书 §5 O run(...)）。
 *
 * @param assets   产出的资产（图 / 视频 / 3D / mask…，url 已就绪）
 * @param metaJson 结构化结果（如 faceDetect 的合规判定、nlu 的结构化人设），可空
 */
public record ProviderResult(List<AssetSpec> assets, String metaJson) {

    public static ProviderResult of(AssetSpec... specs) {
        List<AssetSpec> list = new ArrayList<>();
        for (AssetSpec s : specs) if (s != null) list.add(s);
        return new ProviderResult(list, null);
    }

    public static ProviderResult of(List<AssetSpec> specs) {
        return new ProviderResult(specs == null ? List.of() : specs, null);
    }

    public static ProviderResult meta(String metaJson) {
        return new ProviderResult(List.of(), metaJson);
    }

    public static ProviderResult of(List<AssetSpec> specs, String metaJson) {
        return new ProviderResult(specs == null ? List.of() : specs, metaJson);
    }
}
