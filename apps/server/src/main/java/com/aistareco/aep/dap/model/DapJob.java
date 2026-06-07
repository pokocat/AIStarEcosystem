package com.aistareco.aep.dap.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
import java.util.Map;

/**
 * 异步生成作业（JOB-xxxx）。wire 状态只有 running | done | failed。
 * 扣费三段式：提交时 hold（referenceType=dap-job, referenceId=id:rN），成功 commit、失败/取消 release。
 */
@Entity
@Table(name = "dap_job", indexes = {
        @Index(name = "idx_dap_job_owner", columnList = "ownerUserId"),
        @Index(name = "idx_dap_job_avatar", columnList = "avatarId"),
        @Index(name = "idx_dap_job_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapJob {

    /** 作业类型（内部派发用，wire 不直接暴露枚举，kind 字段给人看）。 */
    public static final String T_GENERATE = "generate";           // AI 描述 → 4 变体
    public static final String T_GENERATE_UPLOAD = "generate_upload"; // 照片/素材 → 复刻 1 张
    public static final String T_ITERATE = "iterate";             // 自然语言迭代
    public static final String T_WARP = "warp";                   // 几何精调
    public static final String T_LOOK = "look";                   // 设计造型 / 场景替换
    public static final String T_DERIVE = "derive";               // 衍生（payload.derivKey 细分）
    public static final String T_VOICE_CLONE = "voice_clone";     // 声音克隆登记

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(length = 32)
    private String avatarId;

    /** 冗余：资产名（任务列表直接显示，避免 N+1）。 */
    @Column(length = 128)
    private String charName;

    /** 给人看的作业种类（中文），如「形象生成」「运镜短视频」。 */
    @Column(nullable = false, length = 64)
    private String kind;

    /** 内部类型（T_* 常量）。 */
    @Column(nullable = false, length = 24)
    private String type;

    /** 展示引擎名，如 Agnes Image 2.1 / Agnes Video 2.0。 */
    @Column(length = 64)
    private String engine;

    /** mock | backend | selfhost —— backend=真实大模型，mock=未配置引擎的占位。 */
    @Column(nullable = false, length = 12)
    @Builder.Default
    private String mode = "backend";

    /** running | done | failed（wire 三态；取消 = failed + eta 已取消）。 */
    @Column(nullable = false, length = 12)
    private String status;

    /** 当前内部阶段，给轮询接口和日志判断卡点；不改变 wire 三态。 */
    @Column(length = 64)
    private String stage;

    @Builder.Default
    private int pct = 0;

    @Column(length = 64)
    private String eta;

    /** 用户主动取消标记；runner 在阶段间检查。 */
    @Builder.Default
    private boolean cancelRequested = false;

    @Builder.Default
    private int retryCount = 0;

    /** 本次作业扣费（点）。 */
    @Builder.Default
    private long cost = 0;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    /** 入参快照（derivKey / instruction / warp 参数 / form 等）。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> payload;

    /** 产物摘要（keys / urls 数量等，详情另查各业务表）。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> result;

    private Instant createdAt;
    private Instant startedAt;
    private Instant finishedAt;
    /** runner 心跳（监控用）。 */
    private Instant heartbeatAt;
    /** stage 最后更新时间。 */
    private Instant stageUpdatedAt;
}
