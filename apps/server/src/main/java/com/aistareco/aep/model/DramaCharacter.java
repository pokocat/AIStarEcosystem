package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 短剧角色实体（C-2 一致性引擎 L0 地基）。
 *
 * 把此前散落在 {@link DramaProject#getPayloadJson()} 的 {@code characters[]} 升级为独立表：
 * 渲染真值（角色参考图集）读实体，编辑器仍读写文档视图，过渡期双写（懒回填 + saveProject upsert）。
 *
 * 字段名与前端 {@code CharacterDef}（apps/web-drama/src/mocks/drama-workshop/types.ts）对齐。
 * refImagesJson = 多角度参考图集 JSON：[{cdnKey, angle, label}]，真值为 cdnKey（§4.7.4），
 * 出 wire 由 {@code CdnUrlSigner.signKey} 派生 url。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_character",
        indexes = @Index(name = "idx_dc_project", columnList = "project_id"))
public class DramaCharacter {

    /** 复用文档内的 ch_N id，或 uuid。 */
    @Id
    @Column(length = 40)
    private String id;

    @Column(name = "project_id", length = 64, nullable = false)
    private String projectId;

    /** 属主隔离（= DramaProject.ownerUserId）。 */
    @Column(name = "owner_user_id", length = 64, nullable = false)
    private String ownerUserId;

    @Column(length = 128)
    private String name;

    /** key（关键角色） | extra（龙套）。 */
    @Column(length = 16)
    private String role;

    /** 选角标签，如「女·28·AE」。 */
    @Column(length = 256)
    private String cast;

    /** 结构化外观（预留，C-2 暂不填）。 */
    @Lob
    @Column(name = "appearance_json", columnDefinition = "LONGTEXT")
    private String appearanceJson;

    /** 绑定的 AiAvatar 数字人 id（可空）。 */
    @Column(name = "dap_avatar_id", length = 64)
    private String dapAvatarId;

    /** 音频线预留（P-1）。 */
    @Column(name = "voice_id", length = 64)
    private String voiceId;

    /** 多角度参考图集 JSON：[{cdnKey, angle, label}]（真值 cdnKey，出 wire 派生 url）。 */
    @Lob
    @Column(name = "ref_images_json", columnDefinition = "LONGTEXT")
    private String refImagesJson;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    /** 软删（随项目对齐；文档删角色 → 双写时置 deletedAt）。 */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}
