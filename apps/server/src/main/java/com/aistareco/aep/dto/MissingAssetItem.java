package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * v0.30+: 重跑任务时检测到的缺失素材条目。
 * 一个原 binding 同时记 slot_id + asset_id，用户在前端 dialog 看到「场景 X 的素材已删除」时
 * 能精确定位是哪一项；同时附 source（"upload" / "library"）+ 可选的 kind（"video" / "image" / "audio"）
 * 让前端帮助文案更具体（「重新上传素材」 / 「重新从库里挑」）。
 */
public record MissingAssetItem(
        @JsonProperty("slot_id") String slotId,
        @JsonProperty("asset_id") String assetId,
        @JsonProperty("source") String source,
        @JsonProperty("kind") String kind
) {
}
