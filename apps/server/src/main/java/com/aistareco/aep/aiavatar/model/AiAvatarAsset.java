package com.aistareco.aep.aiavatar.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;

/**
 * 资产文件（任务书 §3 Asset）：图 / 视频 / 3D / 原始照片（加密）/ 参考图 / mask。
 *
 * 文件本体落本地 fs（dev）或 CDN（prod，复用 CdnUploader）；本表只存元数据 + 公网 URL。
 * 真人原始照片 {@code encrypted=true}：fileUrl 指向密文 blob，下载需解密（信封加密简化为 AES-GCM）。
 */
@Entity
@Table(name = "aiavatar_asset", indexes = {
        @Index(name = "idx_aiavatar_asset_avatar", columnList = "avatarId"),
        @Index(name = "idx_aiavatar_asset_owner", columnList = "ownerUserId"),
        @Index(name = "idx_aiavatar_asset_version", columnList = "versionId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAvatarAsset {

    @Id
    @Column(length = 64)
    private String id;

    /** 可空：原始照片在 avatar 建档前先上传。 */
    @Column(length = 64)
    private String avatarId;

    @Column(length = 64, nullable = false)
    private String ownerUserId;

    @Column(length = 64)
    private String versionId;

    @Enumerated(EnumType.STRING)
    @Column(length = 24, nullable = false)
    private AiAvatarAssetKind kind;

    /** 标准图集构图（仅 IMAGE_2D 标准集非空）。 */
    @Enumerated(EnumType.STRING)
    @Column(length = 24)
    private AiAvatarStandardShot standardShot;

    @Column(length = 1024, nullable = false)
    private String fileUrl;

    @Column(length = 1024)
    private String thumbnailUrl;

    @Column(length = 64)
    private String mimeType;

    @Column
    @ColumnDefault("0")
    @Builder.Default
    private int width = 0;

    @Column
    @ColumnDefault("0")
    @Builder.Default
    private int height = 0;

    @Column
    @ColumnDefault("0")
    @Builder.Default
    private long fileSize = 0;

    /** 视频时长（秒）。 */
    @Column
    @ColumnDefault("0")
    @Builder.Default
    private double durationSec = 0;

    /** 3D 格式 GLB / FBX（仅 MODEL_3D 非空）。 */
    @Column(length = 16)
    private String format3d;

    /** 产出引擎标识（InstantID / SDXL / TripoSR / SVD / MOCK …）。 */
    @Column(length = 48)
    private String engine;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private AiAvatarProviderMode providerMode;

    @Column(length = 128)
    private String watermarkToken;

    @Column(nullable = false)
    @ColumnDefault("false")
    @Builder.Default
    private boolean encrypted = false;

    @Lob
    @Column(name = "meta_json", columnDefinition = "LONGTEXT")
    private String metaJson;

    @Column(nullable = false)
    private OffsetDateTime createdAt;
}
