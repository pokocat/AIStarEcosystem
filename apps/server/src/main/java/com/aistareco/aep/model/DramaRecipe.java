package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 短剧「可复用配方」Recipe（v0.73，抽 skill 飞轮）。
 *
 * 由一部已完成的爆款 {@link DramaProject} 反向蒸馏而来：剥离具体剧情，保留可迁移的
 * 结构 / 套路 / 爽点节奏（mainline 模板 + 分集 beats + 角色原型 + 钩子），供他人「一键套用」
 * 去拍不同题材的新剧。
 *
 * 生命周期（v0.75 双通道入「创意市场」）：
 *   ① 用户自助：用户从自己项目抽取 → status=submitted（待运营审核）→ 运营 publish / reject。
 *   ② 运营邀请精选：运营对任意用户的成片发起邀请 → status=invited（待用户授权）→
 *      用户 approve → published（consentAt 写入）/ decline → declined。
 * published 的 Recipe 进创意市场，所有 drama 用户可见、可套用。origin=official 为运营手建内置。
 *
 * payloadJson 结构（前端 DramaRecipe TS 接口即契约真源）：
 *   { mainline, beats:[{no,hook,beat}], characters:[{role,archetype,desc}], hooks:[], notes }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_recipes")
public class DramaRecipe {

    @Id
    private String id;

    /** 抽取者（提交人）。运营审核不改属主。 */
    @Column(name = "owner_user_id")
    private String ownerUserId;

    /** 抽自哪部项目（可空：官方手建配方无来源项目）。 */
    @Column(name = "source_project_id")
    private String sourceProjectId;

    /** draft | submitted | invited | published | rejected | declined */
    private String status;

    /** extracted（用户自助抽取）| featured（运营邀请精选用户作品）| official（运营手建内置） */
    private String origin;

    /** 来源用户展示名（用于「来自用户@xx」标签）。official 内置为空。 */
    @Column(name = "author_name", length = 128)
    private String authorName;

    /** 运营发起「邀请精选」时记录运营 userId（审计；自助提交为空）。 */
    @Column(name = "invited_by")
    private String invitedBy;

    private String title;
    /** 一句话配方说明（适合拍什么、爽点在哪）。 */
    @Column(length = 512)
    private String summary;

    @Column(name = "type_key")
    private String typeKey;
    private String type;
    private String ratio;
    private int episodes;

    @Column(name = "cover_from")
    private String coverFrom;
    @Column(name = "cover_to")
    private String coverTo;

    /** v0.74：官方内置配方的真实预览图（如 /recipes/&lt;id&gt;.webp，web-drama public 直出）；
        为空时前端回退到 coverFrom/coverTo 渐变。extracted 配方默认无图。 */
    @Column(name = "cover_image", length = 512)
    private String coverImage;

    /** 套用次数（发布后累计，用于热度排序）。 */
    @Column(name = "use_count")
    private int useCount;

    /** 审核备注 / 驳回理由。 */
    @Column(name = "review_note", length = 512)
    private String reviewNote;

    @Lob
    @Column(name = "payload_json", columnDefinition = "LONGTEXT")
    private String payloadJson;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
    @Column(name = "published_at")
    private OffsetDateTime publishedAt;
    /** 用户对运营邀请的授权时间（approve 时写入）。 */
    @Column(name = "consent_at")
    private OffsetDateTime consentAt;
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}
