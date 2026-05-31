package com.aistareco.aep.aiavatar.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 版本快照（任务书 §3 AvatarVersion）。
 *
 * 每次 AI 动作（打样 / 草稿迭代 / 精调 / 模板出图 / 衍生）生成一条；含 time/author/note/参数，
 * 支持回溯、另存为新AiAvatar。
 */
@Entity
@Table(name = "aiavatar_avatar_version", indexes = {
        @Index(name = "idx_aiavatar_version_avatar", columnList = "avatarId"),
        @Index(name = "idx_aiavatar_version_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAvatarVersion {

    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String avatarId;

    @Column(length = 64, nullable = false)
    private String ownerUserId;

    /** 顺序版本号（1 起）。 */
    @Column(nullable = false)
    private int versionNo;

    @Column(length = 128)
    private String label;

    @Column(length = 512)
    private String note;

    /** 作者（userId）或 "系统"。 */
    @Column(length = 64)
    private String author;

    /** 产生该版本时的资产状态。 */
    @Enumerated(EnumType.STRING)
    @Column(length = 24)
    private AiAvatarStatus sourceStatus;

    /** 产生该版本所用的参数 JSON（capability / prompt / sliders / template…）。 */
    @Lob
    @Column(name = "params_json", columnDefinition = "LONGTEXT")
    private String paramsJson;

    /** 代表图 asset id。 */
    @Column(length = 64)
    private String previewAssetId;

    /** 该版本包含的资产 id 列表。 */
    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "LONGTEXT")
    @Builder.Default
    private List<String> assetIds = new ArrayList<>();

    /** 产生该版本的 job id（可空，几何形变等同步操作无 job）。 */
    @Column(length = 64)
    private String jobId;

    @Column(nullable = false)
    @ColumnDefault("false")
    @Builder.Default
    private boolean preferred = false;

    @Column(nullable = false)
    @ColumnDefault("false")
    @Builder.Default
    private boolean discarded = false;

    @Column(nullable = false)
    private OffsetDateTime createdAt;
}
