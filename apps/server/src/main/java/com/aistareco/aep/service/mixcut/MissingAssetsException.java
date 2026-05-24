package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.dto.MissingAssetItem;

import java.util.List;

/**
 * v0.30+: 「重跑」任务时检测到原 binding 引用的 MixcutAsset 已被硬删。
 * GlobalExceptionHandler 捕获后返回 409 + missing_assets 列表（在 ApiErrorBody.details 里）。
 *
 * 选择严格阻拦而不是沉默走 demo 兜底 —— 与 v0.29 「不让 demo 串进用户预期」方向一致：
 * 用户期望"原样重跑"，缺素材必须显式告知用户去重新上传 / 走 create 页从头做。
 */
public class MissingAssetsException extends RuntimeException {

    private final List<MissingAssetItem> missingAssets;

    public MissingAssetsException(List<MissingAssetItem> missingAssets) {
        super("无法重跑：" + missingAssets.size() + " 个素材已删除");
        this.missingAssets = List.copyOf(missingAssets);
    }

    public List<MissingAssetItem> getMissingAssets() {
        return missingAssets;
    }
}
