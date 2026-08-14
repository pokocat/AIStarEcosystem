package com.aistareco.aep.clip.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "clip_asset", indexes = {
        @Index(name = "idx_clip_asset_owner_kind", columnList = "externalOwnerId,kind"),
        @Index(name = "idx_clip_asset_preset", columnList = "preset,kind")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClipAsset {
    @Id @Column(length = 64) private String id;
    @Column(length = 128) private String externalOwnerId;
    @Column(nullable = false, length = 16) private String kind;
    @Column(nullable = false, length = 128) private String label;
    @Column(length = 128) private String tag;
    @Column(length = 1024) private String localPath;
    @Column(length = 512) private String cdnKey;
    @Column(length = 512) private String thumbnailCdnKey;
    @Column(nullable = false, length = 128) private String mimeType;
    private long bytes;
    /**
     * 像素宽高。**必须可空**，不许用 0 当"未知"。
     *
     * 上传视频的分辨率直接决定成片分辨率（石榴 2026-08-13 确认），所以这是用户要看见的画质凭据。
     * 但本字段之前不存在，历史素材一律没有值；把它写成基本类型 int 会让老数据全部读出 0，
     * 界面再把 0 渲染成「0×0」——那是把"没测过"说成"这素材是 0 像素"。null 才是老数据的真相，
     * 配合 spring.jackson.default-property-inclusion=non_null，未知时字段直接不下发，端上据此整块不渲染。
     */
    private Integer width;
    private Integer height;
    @Builder.Default private double durationSec = 0;
    @Builder.Default private int usedCount = 0;
    @Builder.Default private boolean preset = false;
    @Column(length = 64) private String presetGroup;
    private Instant createdAt;
    private Instant deletedAt;
}
