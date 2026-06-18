package com.aistareco.aep.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * AI 明星视频生成任务（v0.80）。
 *
 * <p>此前任务态是 {@code CelebrityZoneService} 里的静态 {@code ConcurrentHashMap}，
 * 重启即丢：轮询误报「完成」(1/1)，且 done 时不再 commit hold → 留下孤儿冻结额度。
 * 落表后重启可继续按 {@code startedAt + totalSec} 算进度，done 时幂等 commit hold。</p>
 *
 * <p>进度本身不存（由 {@code startedAt + totalSec} 实时计算）；{@code committed}
 * 只是「hold 已 commit」的幂等标记，避免重复 commit 尝试。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "generation_jobs")
public class GenerationJob {

    /** jobId（形如 gen-xxxxxxxx）。 */
    @Id
    private String id;

    /** 任务开始时刻；进度 = (now - startedAt) / totalSec。 */
    private Instant startedAt;

    /** 预估总时长（秒，演示已压缩）。 */
    private long totalSec;

    @Column(length = 64)
    private String engine;

    /** 下单用户（用于 done 时 commit 对应 hold）。 */
    @Column(length = 64)
    private String userId;

    /** 冻结的积分额度（done 时 commit）。 */
    private long creditCost;

    /** hold 是否已 commit（幂等标记，避免重复尝试）。 */
    private boolean committed;

    private Instant createdAt;
}
