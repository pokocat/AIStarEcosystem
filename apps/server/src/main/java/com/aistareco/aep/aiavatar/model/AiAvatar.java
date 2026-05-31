package com.aistareco.aep.aiavatar.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * AiAvatar 资产（任务书 §3 核心实体 Avatar）。
 *
 * 独立领域表 {@code aiavatar_avatar}；owner 复用 {@code aep_users.id}，不复制账户体系。
 * 每次 AI 动作产出一个 {@link AiAvatarVersion} 快照；状态机见 {@link AiAvatarStatus}。
 */
@Entity
@Table(name = "aiavatar_avatar", indexes = {
        @Index(name = "idx_aiavatar_avatar_owner", columnList = "ownerUserId"),
        @Index(name = "idx_aiavatar_avatar_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAvatar {

    @Id
    @Column(length = 64)
    private String id;

    /** 复用 aep_users.id —— 不新建账户表。 */
    @Column(length = 64, nullable = false)
    private String ownerUserId;

    /** 可选：复用 aep_studios.id。 */
    @Column(length = 64)
    private String studioId;

    @Column(length = 128, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(length = 24, nullable = false)
    private AiAvatarCreationMode mode;

    @Enumerated(EnumType.STRING)
    @Column(length = 24, nullable = false)
    private AiAvatarStatus status;

    /** 人设文案（AI 原创路径用户输入 / 真人路径可选）。 */
    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String persona;

    /** NLU 解析后的结构化人设（{appearance, temperament, style, scene, keywords[]} JSON）。 */
    @Lob
    @Column(name = "persona_structured_json", columnDefinition = "LONGTEXT")
    private String personaStructuredJson;

    /** 风格分类（如 "未来机能" / "国风古典"）。 */
    @Column(length = 64)
    private String styleCategory;

    /** 封面图 asset id。 */
    @Column(length = 64)
    private String coverAssetId;

    /** 当前活跃版本 id。 */
    @Column(length = 64)
    private String currentVersionId;

    /** 定稿版本 id（status>=finalized_2d 后非空）。 */
    @Column(length = 64)
    private String finalizedVersionId;

    @Column(nullable = false)
    @ColumnDefault("false")
    @Builder.Default
    private boolean has3d = false;

    @Column(nullable = false)
    @ColumnDefault("false")
    @Builder.Default
    private boolean hasVideo = false;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "LONGTEXT")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    /** 「另存为新AiAvatar」血缘 —— 指向原 avatar id。 */
    @Column(length = 64)
    private String forkedFromAvatarId;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    private OffsetDateTime archivedAt;
}
