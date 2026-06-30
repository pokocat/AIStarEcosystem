package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 短剧素材库条目（用户个人素材：上传的图片，按 人物/场景/道具/其他 分类）。
 *
 * 文件本体经 {@link com.aistareco.aep.controller.DramaAssetUploadController} 上传到 OSS，
 * 本表只存记录：cdnKey 为真值，URL 出 wire 时由 CdnUrlSigner 派生（§4.7 key-only）。
 * 按 ownerUserId 严格隔离；软删用 deletedAt。tags 以「、」拼接成单列存储。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_assets")
public class DramaAsset {

    @Id
    private String id;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    private String name;

    /** 人物 / 场景 / 道具 / 其他 */
    private String cat;

    /** image / video（当前仅 image）。 */
    private String kind;

    /** OSS object key（真值）；URL 出 wire 时由 signer 派生。 */
    @Column(name = "cdn_key", length = 512)
    private String cdnKey;

    /** 标签，以「、」拼接（展示用，可空）。 */
    @Column(length = 512)
    private String tags;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}
