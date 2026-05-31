package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 脚本工坊脚本（v0.45，drama 子产品 /scripts）。
 *
 * 与短剧生成的 {@link DramaScript} 区分：DramaScript 是「AI 起草 → 直接生成视频」的轻量短剧脚本；
 * WorkshopScript 是带版本树（{@link WorkshopScriptVersion}）的正式编剧工作流脚本，
 * 可关联到一个短剧项目（dramaId）。命名带 Workshop 前缀避免与 DramaScript 混淆。
 *
 * 字段镜像 packages/types/src/script.ts 的 Script。按 ownerUserId 隔离。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "workshop_scripts")
public class WorkshopScript {

    @Id
    private String id;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    private String title;

    /** wire 小写：drama | ad | trailer | voice */
    private String kind;

    /** wire 小写：draft | review | approved | archived */
    private String status;

    private String series;
    private String episode;

    @Column(name = "drama_id")
    private String dramaId;

    @Column(name = "current_version_id")
    private String currentVersionId;

    private int progress;

    @Column(columnDefinition = "TEXT")
    private String suggestion;

    @Column(name = "author_name")
    private String authorName;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
