package com.aistareco.aep.aiavatar.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 精调操作记录（任务书 §3 RefineEdit / §7 精调工作台）。
 *
 * 记录每一次几何微调 / 外观编辑 / 自然语言微调 / 局部重绘，支持前后对比、版本回退。
 */
@Entity
@Table(name = "aiavatar_refine_edit", indexes = {
        @Index(name = "idx_aiavatar_refine_avatar", columnList = "avatarId"),
        @Index(name = "idx_aiavatar_refine_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAvatarRefineEdit {

    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String avatarId;

    @Column(length = 64, nullable = false)
    private String ownerUserId;

    /** 产生的版本 id（异步外观编辑成功后回填）。 */
    @Column(length = 64)
    private String versionId;

    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false)
    private AiAvatarRefineKind kind;

    /**
     * 操作参数 JSON：
     *  - geometry：{slimFace, eyeSize, noseBridge, faceShape, mouthShape, ...}（相对中性值 ±）
     *  - appearance：{makeupRef, hairStyle, skin, outfit}
     *  - nl_global：{prompt}
     *  - region：{maskAssetId, prompt, rect}
     */
    @Lob
    @Column(name = "params_json", columnDefinition = "LONGTEXT")
    private String paramsJson;

    @Column(length = 64)
    private String beforeAssetId;

    @Column(length = 64)
    private String afterAssetId;

    /** 异步外观编辑对应的 job id（几何微调为同步，无 job）。 */
    @Column(length = 64)
    private String jobId;

    @Column(length = 512)
    private String note;

    @Column(nullable = false)
    private OffsetDateTime createdAt;
}
