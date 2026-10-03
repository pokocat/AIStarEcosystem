package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 画布上的一次生成（v0.198，设计真源 docs/drama-canvas-plan.md §3–§4；契约 packages/types/src/drama-canvas.ts
 * {@code DramaCanvasRun}）。
 *
 * <p>生成<b>不改画布文档</b>：结果写在 {@code resultJson}，前端 GET runs 拿到后自己合进文档再保存（按 runId 幂等）。
 * 刷新页面后也靠它接回在途的生成。
 *
 * <p>幂等：{@code (owner_user_id, client_request_id)} 唯一 —— 同一个键重复请求（重试 / 双击 / 两个标签页）
 * 回原记录，不重复冻结、不重复提交。<b>唯一约束同时声明在实体上</b>（与 V36 迁移同名）：全新库 ddl-auto 建表时也要有。
 *
 * <p>{@code inputJson} 是提交时的输入快照（单价、实际提示词、参考 key、冻结引用），worker 只认这份快照，
 * 绝不回头再读后台单价或文档（hold 与 commit 之间改了价 / 改了文档，都不该影响这一次）。
 * {@code resultJson} <b>只存 key</b>；url 出 wire 时只给本人的 key 派生。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_canvas_run",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_drama_canvas_run_owner_req",
                        columnNames = {"owner_user_id", "client_request_id"})
        },
        indexes = {
                @Index(name = "idx_drama_canvas_run_canvas", columnList = "canvas_id,created_at"),
                @Index(name = "idx_drama_canvas_run_job", columnList = "job_id"),
                @Index(name = "idx_drama_canvas_run_status", columnList = "status,updated_at")
        })
public class DramaCanvasRun {

    public static final String KIND_SCRIPT = "script";
    public static final String KIND_EXTRACT = "extract";
    public static final String KIND_IMAGE = "image";
    public static final String KIND_STORYBOARD = "storyboard";
    public static final String KIND_VIDEO = "video";
    public static final String KIND_ASSEMBLE = "assemble";

    public static final String STATUS_QUEUED = "queued";
    public static final String STATUS_RUNNING = "running";
    public static final String STATUS_SUCCEEDED = "succeeded";
    public static final String STATUS_FAILED = "failed";
    public static final String STATUS_CANCELED = "canceled";

    /** 业务 id，形如 dcr_3f9a1c02e4b5。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(name = "canvas_id", nullable = false, length = 32)
    private String canvasId;

    @Column(name = "owner_user_id", nullable = false, length = 64)
    private String ownerUserId;

    /** script | extract | image | storyboard | video | assemble */
    @Column(nullable = false, length = 16)
    private String kind;

    /** DramaCanvasRunTarget：script:setting / look:&lt;id&gt; / frame:&lt;no&gt;:&lt;segmentId&gt; … */
    @Column(nullable = false, length = 128)
    private String target;

    /** queued | running | succeeded | failed | canceled */
    @Column(nullable = false, length = 16)
    private String status;

    /** 这次冻结 / 扣掉的积分（失败退回后保留原值，status 说明结果；部分成功时是实际扣的）。 */
    @Column(nullable = false)
    private long cost;

    @Column(name = "client_request_id", length = 80)
    private String clientRequestId;

    /** 出视频：MaterialVideoJob id（冻结 / 结算 / 退回由那条链负责）。 */
    @Column(name = "job_id", length = 64)
    private String jobId;

    @Lob
    @Column(name = "input_json", columnDefinition = "LONGTEXT")
    private String inputJson;

    @Lob
    @Column(name = "result_json", columnDefinition = "LONGTEXT")
    private String resultJson;

    /** {requested, applied, notes[]}：参考图实际送到模型的情况。 */
    @Lob
    @Column(name = "refs_json", columnDefinition = "TEXT")
    private String refsJson;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Lob
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    /** 最后一次状态 / 心跳写入时间；超时回收（DramaCanvasRunSweeper）看它。 */
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "finished_at")
    private OffsetDateTime finishedAt;

    public boolean isTerminal() {
        return STATUS_SUCCEEDED.equals(status) || STATUS_FAILED.equals(status) || STATUS_CANCELED.equals(status);
    }
}
