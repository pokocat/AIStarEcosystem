package com.aistareco.aep.ipstudio.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * 一次节点运行（identity 抽取 / generate 出图）。
 *
 * <p>为什么运行结果不写回 {@link IpProject#getDocJson()}：画布文档是客户端每 1.2s 防抖 PUT 的整块
 * 文档，异步 worker 若往里写产物，两边必然互相覆盖。所以产物只落这张表，
 * {@code GET project} 时以 nodeId → 最近一次 run 的形式投影出去。
 *
 * <p>同一节点重跑 = 新开一行，旧行保留 —— 用户可能已经选中了旧运行里的某张候选图
 * （{@code IpGenerateData.selectedRunId}），删掉旧行就等于把他选的图弄丢。
 *
 * <p>{@code cost} 恒为真实账本值：running 时 = 冻结额，done = 已 commit 之和，
 * failed = 已 commit 的部分（可能为 0）。
 */
@Entity
@Table(name = "ip_run", indexes = {
        @Index(name = "idx_ip_run_project_node", columnList = "projectId,nodeId,createdAt"),
        @Index(name = "idx_ip_run_status", columnList = "status,heartbeatAt")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IpRun {

    public static final String KIND_IDENTITY = "identity";
    public static final String KIND_GENERATE = "generate";

    public static final String STATUS_RUNNING = "running";
    public static final String STATUS_DONE = "done";
    public static final String STATUS_FAILED = "failed";

    /** 业务 id，形如 IPR-7b21de40。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 32)
    private String projectId;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    /** 画布节点 id（客户端生成，服务端不解释其格式）。 */
    @Column(nullable = false, length = 64)
    private String nodeId;

    /** identity | generate */
    @Column(nullable = false, length = 16)
    private String kind;

    /** running | done | failed（wire 三态，与 dap_job 一致）。 */
    @Column(nullable = false, length = 16)
    private String status;

    /** 内部阶段串：queued / prompt.compile / image.generate.{n} / storage.persist / done / failed。 */
    @Column(length = 64)
    private String stage;

    @Builder.Default
    private int pct = 0;

    @Builder.Default
    private long cost = 0;

    @Column(length = 64)
    private String errorCode;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    /** IpRunInputs JSON（实际英文提示词 + 参考图生效回报 + size/count）。 */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String inputJson;

    /** IpRunOutput JSON（identity: text/promptEn；generate: candidates[{key}]，**只存 key**）。 */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String outputJson;

    /** 用户请求取消；worker 在阶段间检查并收尾（避免与 worker 抢终态写入）。 */
    @Builder.Default
    private boolean cancelRequested = false;

    private Instant createdAt;
    private Instant startedAt;
    private Instant finishedAt;
    /** 每 tick 更新；{@code IpRunReaper} 据此判定僵死运行。 */
    private Instant heartbeatAt;
}
