package com.aistareco.aep.videostudio.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * 视频生成区的模板（「做同款」，docs/video-studio-plan.md §10，表由 V37 建）。
 *
 * <p>普通用户存的模板只有自己能看能用（{@code private}）；运营可以把自己的作品发布成全员可见的
 * 官方模板（{@code official}，发布权限查库判定，不信前端）。删除 / 撤回都是软删（{@code withdrawn}）。
 *
 * <p>{@code recipeJson} 是复刻配方（{@code TemplateRecipe}）：模式、最终提示词、规格、种子、模型、素材。
 * **不拷运行痕迹**（任务状态、错误、积分、外部任务号；§8.0.1 ⑪）。素材不复制文件，直接引用原作的 key。
 * 成片 / 封面只存 key，出 wire 时现签（§4.7.4）。
 */
@Entity
@Table(name = "video_studio_template", indexes = {
        @Index(name = "idx_vs_template_scope", columnList = "scope,status,createdAt"),
        @Index(name = "idx_vs_template_owner", columnList = "ownerUserId,status,createdAt")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StudioTemplate {

    public static final String SCOPE_OFFICIAL = "official";
    public static final String SCOPE_PRIVATE = "private";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_WITHDRAWN = "withdrawn";

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 16)
    private String scope;

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = STATUS_ACTIVE;

    @Column(nullable = false, length = 64)
    private String title;

    @Column(length = 400)
    private String description;

    @Column(nullable = false, length = 64)
    private String sourceJobId;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String recipeJson;

    @Column(length = 512)
    private String previewVideoKey;

    @Column(length = 512)
    private String previewThumbnailKey;

    @Column(nullable = false)
    @Builder.Default
    private int useCount = 0;

    private Instant createdAt;
    private Instant updatedAt;

    public boolean isActive() {
        return STATUS_ACTIVE.equals(status);
    }

    public boolean isOfficial() {
        return SCOPE_OFFICIAL.equals(scope);
    }
}
