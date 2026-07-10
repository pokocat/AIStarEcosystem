package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 短剧场景资产实体（C-2 一致性引擎 L0 地基）。
 *
 * 把此前散落在 {@link DramaProject#getPayloadJson()} 的 {@code scenes[]}（跨集共享取景地）升级为独立表。
 * 字段名与前端 {@code SceneAsset}（apps/web-drama/src/mocks/drama-workshop/types.ts）对齐。
 * refImagesJson = 多角度参考图集 JSON：[{cdnKey, angle, label}]，真值 cdnKey（§4.7.4），出 wire 派生 url。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_scene",
        indexes = @Index(name = "idx_ds_project", columnList = "project_id"))
public class DramaScene {

    @Id
    @Column(length = 40)
    private String id;

    @Column(name = "project_id", length = 64, nullable = false)
    private String projectId;

    @Column(name = "owner_user_id", length = 64, nullable = false)
    private String ownerUserId;

    @Column(length = 128)
    private String name;

    /** 氛围基调（暖光仪式 / 冷白压迫 …）。 */
    @Column(length = 64)
    private String mood;

    /** 风格标签 JSON：string[]。 */
    @Lob
    @Column(name = "style_tags_json", columnDefinition = "LONGTEXT")
    private String styleTagsJson;

    /** 多角度参考图集 JSON：[{cdnKey, angle, label}]（真值 cdnKey，出 wire 派生 url）。 */
    @Lob
    @Column(name = "ref_images_json", columnDefinition = "LONGTEXT")
    private String refImagesJson;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}
