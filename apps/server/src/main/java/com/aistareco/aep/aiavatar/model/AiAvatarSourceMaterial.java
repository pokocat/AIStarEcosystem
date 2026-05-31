package com.aistareco.aep.aiavatar.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 素材 / 真人照片 / 文案记录（任务书 §3 SourceMaterial + §7 素材授权填写）。
 *
 * - 真人路径：每张上传照片一条（assetId 指向 {@link AiAvatarAsset}（kind=SOURCE_PHOTO, encrypted=true）），
 *   带 InsightFace 合规检测结果（遮挡/模糊/多脸）。
 * - AI 路径：人设文案 / 风格参考图。
 */
@Entity
@Table(name = "aiavatar_source_material", indexes = {
        @Index(name = "idx_aiavatar_src_avatar", columnList = "avatarId"),
        @Index(name = "idx_aiavatar_src_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAvatarSourceMaterial {

    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String avatarId;

    @Column(length = 64, nullable = false)
    private String ownerUserId;

    /** "photo" / "text" / "reference"。 */
    @Column(length = 16, nullable = false)
    private String kind;

    /** 照片 / 参考图对应的加密 asset id。 */
    @Column(length = 64)
    private String assetId;

    /** 文案内容（kind=text）。 */
    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String text;

    /** InsightFace 合规检测结果 JSON（{faces, occlusion, blur, multiFace, passed, reason}）。 */
    @Lob
    @Column(name = "face_check_json", columnDefinition = "LONGTEXT")
    private String faceCheckJson;

    /** 合规是否通过（null=未检测 / 非照片）。 */
    private Boolean faceCheckPassed;

    @Column(nullable = false)
    private OffsetDateTime createdAt;
}
