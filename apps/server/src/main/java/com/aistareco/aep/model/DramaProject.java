package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 短剧项目工作台（v0.64+，drama 子产品）。
 *
 * 承载「六阶段工作台」整套 ProjectData 文档：选题 / 大纲 / 角色 / 剧集脚本 / 分镜工厂 / 成片配方。
 * 与 {@link DramaScript} 同惯例：列出用于列表卡片 + 隔离 + 排序的核心字段，
 * 整套嵌套结构放 payloadJson（前端 ProjectData TS 接口即契约真源）。
 *
 * payloadJson 结构（= 前端 mocks/drama-workshop/types.ts 的 ProjectData）：
 *   { projectInfo, topicCards[], episodes[], characters[],
 *     script:{ep,scenes[]}, storyboard:{ep,scenes[]}, promptPack }
 *
 * 按 ownerUserId 严格隔离；软删用 deletedAt。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_projects")
public class DramaProject {

    @Id
    private String id;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    private String title;
    /** 内容类型中文名，如「悬疑短剧」 */
    private String type;
    /** 内容类型 key，如 mystery / palace / romance（CONTENT_TYPES 索引） */
    @Column(name = "type_key")
    private String typeKey;
    /** 画幅比，如 9:16 / 16:9 */
    private String ratio;
    /** 集数 */
    private int episodes;
    /** 进度 0-100 */
    private int progress;
    /** 当前阶段序号 1..6（topic→outline→cast→epscript→factory→prompt） */
    private int stage;
    /** guided | template */
    private String mode;

    @Column(name = "cover_from")
    private String coverFrom;
    @Column(name = "cover_to")
    private String coverTo;

    @Lob
    @Column(name = "payload_json", columnDefinition = "LONGTEXT")
    private String payloadJson;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}
