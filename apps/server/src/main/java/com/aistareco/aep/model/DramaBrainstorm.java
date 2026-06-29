package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 首页「跟 AI 聊出故事」脑暴草稿（drama 子产品）。
 *
 * 设计稿首页的核心链路：用户随口说一个念头 → 左侧与 AI 脑暴对话 → 右侧生成可编辑的「故事大纲」
 * （标题 / 剧情脉络 / 一句话简介 / 核心人物 / 取景参考 / 制作设置：形态 + 屏幕尺寸）→「去制作」。
 *
 * 脑暴是「立项之前」的可恢复草稿：在用户决定形态（剧集 / 单片）之前，对话与大纲都不应该
 * 污染 {@link DramaProject}（短剧工坊）或 {@link DramaShort}（短视频工坊）。只有点「去制作」时，
 * 才按形态 promote 成一部 DramaProject（剧集，免费立项）或一条 DramaShort（单片，扣开拍费）。
 *
 * 整页脑暴态（对话 messages / 大纲 outline / 制作设置 settings）放 payloadJson，
 * 用核心字段做「继续上次脑暴」列表卡片 + 归属隔离 + 排序。按 ownerUserId 隔离；软删用 deletedAt。
 *
 * payloadJson 结构（= 前端 api/brainstorm.ts 的 BrainstormData，字段名 1:1）：
 *   { seed?, direction?, messages:[{role:"ai"|"user", text, quick?:string[]}],
 *     outline: OutlineDraft|null, settings:{ form:"series"|"single", ratio, episodes? } }
 *   OutlineDraft: { title, type, tone, logline, mainline, beats:string[],
 *                   roles:[{name,role}], scenes:string[] }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_brainstorms")
public class DramaBrainstorm {

    @Id
    private String id;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    /** 大纲标题（生成后回写，列表卡片用）；未生成时用首条点子兜底。 */
    private String title;

    /** draft（脑暴中）| promoted（已去制作）。 */
    private String status;

    /** promote 后的去向：project（剧集）| short（单片），未 promote 为空。 */
    @Column(name = "promoted_kind")
    private String promotedKind;

    /** promote 出的 DramaProject / DramaShort id，未 promote 为空。 */
    @Column(name = "promoted_id")
    private String promotedId;

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
