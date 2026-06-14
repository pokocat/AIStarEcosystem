package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 短视频制作草稿（v0.76，drama 子产品）。
 *
 * 短视频工坊 /shorts/make「分镜脚本 → 视频工厂」单条速成流程的可恢复草稿：
 * 整页编辑态（脚本 meta / 分镜 shots / AI 对话 chat / 出片产物）放 payloadJson，
 * 用核心字段做列表卡片 + 隔离 + 排序。与 {@link DramaProject} 同惯例，但短视频是「单条」，
 * 没有六阶段 / 分集概念，故独立成表（不复用 drama_projects，避免把脚本库语义搞混）。
 *
 * payloadJson 结构（= 前端 api/shorts.ts 的 ShortDraftData）：
 *   { idea?, reopen?, fmtKey?, fmtName?, title?, step:"script"|"factory",
 *     meta: ScriptMeta|null, shots: ShortShot[], chat: ChatMsg[], refs: Material[] }
 *
 * 按 ownerUserId 严格隔离；软删用 deletedAt。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_shorts")
public class DramaShort {

    @Id
    private String id;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    private String title;

    /** 套用的短视频模版 key（口播带货 sell / 知识科普 know …），可空（没套模版）。 */
    @Column(name = "fmt_key")
    private String fmtKey;
    /** 模版中文名（展示用）。 */
    @Column(name = "fmt_name")
    private String fmtName;

    @Column(name = "cover_from")
    private String coverFrom;
    @Column(name = "cover_to")
    private String coverTo;

    /** 成片总时长（秒，由各分镜 dur 累加，落库时回算）。 */
    @Column(name = "duration_sec")
    private int durationSec;
    /** 分镜总数（回算）。 */
    @Column(name = "shot_count")
    private int shotCount;
    /** 已验收成片的分镜数（回算）。 */
    @Column(name = "done_count")
    private int doneCount;

    /** draft（制作中）| done（已合成成片）。 */
    private String status;
    /** 进度 0-100（doneCount/shotCount，回算）。 */
    private int progress;

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
