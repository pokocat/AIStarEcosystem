package com.aistareco.aep.aiavatar.provider;

import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import com.aistareco.aep.aiavatar.model.AiAvatarStandardShot;

/**
 * Provider 产出的单个资产描述（已落盘 / 已上传，url 就绪）。
 * AiAvatarJobService 据此写 {@link com.aistareco.aep.aiavatar.model.AiAvatarAsset} 行。
 */
public record AssetSpec(
        AiAvatarAssetKind kind,
        AiAvatarStandardShot standardShot,
        String fileUrl,
        String thumbnailUrl,
        String mimeType,
        int width,
        int height,
        long fileSize,
        double durationSec,
        String format3d,
        String engine,
        String metaJson
) {
    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private AiAvatarAssetKind kind = AiAvatarAssetKind.IMAGE_2D;
        private AiAvatarStandardShot standardShot;
        private String fileUrl;
        private String thumbnailUrl;
        private String mimeType = "image/png";
        private int width;
        private int height;
        private long fileSize;
        private double durationSec;
        private String format3d;
        private String engine;
        private String metaJson;

        public Builder kind(AiAvatarAssetKind v) { this.kind = v; return this; }
        public Builder standardShot(AiAvatarStandardShot v) { this.standardShot = v; return this; }
        public Builder fileUrl(String v) { this.fileUrl = v; return this; }
        public Builder thumbnailUrl(String v) { this.thumbnailUrl = v; return this; }
        public Builder mimeType(String v) { this.mimeType = v; return this; }
        public Builder width(int v) { this.width = v; return this; }
        public Builder height(int v) { this.height = v; return this; }
        public Builder fileSize(long v) { this.fileSize = v; return this; }
        public Builder durationSec(double v) { this.durationSec = v; return this; }
        public Builder format3d(String v) { this.format3d = v; return this; }
        public Builder engine(String v) { this.engine = v; return this; }
        public Builder metaJson(String v) { this.metaJson = v; return this; }

        public AssetSpec build() {
            return new AssetSpec(kind, standardShot, fileUrl, thumbnailUrl, mimeType,
                    width, height, fileSize, durationSec, format3d, engine, metaJson);
        }
    }
}
