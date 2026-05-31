package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.config.AiAvatarProperties;
import com.aistareco.aep.aiavatar.model.AiAvatarJob;
import com.aistareco.aep.aiavatar.model.AiAvatarJobStatus;
import com.aistareco.aep.aiavatar.repository.AiAvatarJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 任务监控线程（用户附加硬要求）：
 *   「如果遇到模型错误执行中断等，另起一个监控线程，每一小时判断下当前任务是否完成，
 *     异常中断则继续执行下去。」
 *
 * 由 {@link com.aistareco.aep.aiavatar.config.AiAvatarAsyncConfig} 用独立单线程调度器每
 * {@code aep.aiavatar.watchdog-interval-ms}（默认 1h）触发 {@link #sweep()}。
 *
 * 判定 + 处置：
 *  1. RUNNING 但心跳超过 {@code aep.aiavatar.job-stale-ms}（默认 10min）无更新 / 进程重启后内存进度丢失
 *     → 视为「异常中断」。若 attempts < maxAttempts → 重新派发执行（续跑）；否则置 FAILED 并记原因。
 *  2. FAILED 且 attempts < maxAttempts → 自动重试（续跑）。
 *  3. QUEUED 但迟迟未被线程池拉起（积压 / 重启丢失）→ 重新派发。
 *
 * 续跑走 {@link AiAvatarJobRunner#runAsync(String)}（重入安全：内部对终态短路）。
 * 重试有上限，避免「坏任务」无限循环烧算力 / 积分。
 */
@Component
public class AiAvatarJobWatchdog {

    private static final Logger log = LoggerFactory.getLogger(AiAvatarJobWatchdog.class);

    private final AiAvatarJobRepository jobRepo;
    private final AiAvatarJobRunner runner;
    private final AiAvatarJobProgressTracker tracker;
    private final AiAvatarProperties props;

    public AiAvatarJobWatchdog(AiAvatarJobRepository jobRepo,
                         @Lazy AiAvatarJobRunner runner,
                         AiAvatarJobProgressTracker tracker,
                         AiAvatarProperties props) {
        this.jobRepo = jobRepo;
        this.runner = runner;
        this.tracker = tracker;
        this.props = props;
    }

    /** 一次巡检。被调度器周期调用，也可由 admin / 测试手动触发。 */
    public void sweep() {
        try {
            doSweep();
        } catch (Exception e) {
            // 监控线程自身绝不能因单次异常而死掉
            log.error("[aiavatar-watchdog] sweep error: {}", e.getMessage(), e);
        }
    }

    private void doSweep() {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime staleCutoff = now.minusSeconds(Math.max(60, props.getJobStaleMs() / 1000));

        List<AiAvatarJob> toResume = new ArrayList<>();
        int failedExhausted = 0;

        // 1) RUNNING 但心跳过期 → 异常中断
        List<AiAvatarJob> staleRunning = new ArrayList<>();
        staleRunning.addAll(jobRepo.findByStatusAndHeartbeatAtBefore(AiAvatarJobStatus.RUNNING, staleCutoff));
        staleRunning.addAll(jobRepo.findByStatusAndHeartbeatAtIsNullAndCreatedAtBefore(AiAvatarJobStatus.RUNNING, staleCutoff));

        for (AiAvatarJob job : staleRunning) {
            if (tracker.isCancelled(job.getId())) continue;
            if (job.getAttempts() < job.getMaxAttempts()) {
                log.warn("[aiavatar-watchdog] stale RUNNING job={} cap={} attempts={}/{} heartbeat={} → resume",
                        job.getId(), job.getCapability().wire(), job.getAttempts(), job.getMaxAttempts(),
                        job.getHeartbeatAt());
                // 退回 queued 让 runner 重新接管（runner 内部会再 attempts++）
                job.setStatus(AiAvatarJobStatus.QUEUED);
                job.setErrorMessage("监控线程检测到异常中断，自动续跑（第 " + (job.getAttempts() + 1) + " 次）");
                jobRepo.save(job);
                toResume.add(job);
            } else {
                job.setStatus(AiAvatarJobStatus.FAILED);
                job.setErrorMessage("异常中断且已达最大重试次数(" + job.getMaxAttempts() + ")，停止续跑");
                job.setCompletedAt(now);
                jobRepo.save(job);
                tracker.complete(job.getId(), "failed");
                failedExhausted++;
            }
        }

        // 2) FAILED 但仍有重试额度 → 自动续跑
        for (AiAvatarJob job : jobRepo.findByStatus(AiAvatarJobStatus.FAILED)) {
            if (job.getAttempts() < job.getMaxAttempts() && !tracker.isCancelled(job.getId())) {
                log.warn("[aiavatar-watchdog] retry FAILED job={} cap={} attempts={}/{}",
                        job.getId(), job.getCapability().wire(), job.getAttempts(), job.getMaxAttempts());
                job.setStatus(AiAvatarJobStatus.QUEUED);
                jobRepo.save(job);
                toResume.add(job);
            }
        }

        // 3) QUEUED 长时间未启动（积压 / 重启丢失）→ 重新派发
        for (AiAvatarJob job : jobRepo.findByStatus(AiAvatarJobStatus.QUEUED)) {
            if (job.getStartedAt() == null && job.getCreatedAt() != null
                    && job.getCreatedAt().isBefore(staleCutoff)
                    && !toResume.contains(job)) {
                log.warn("[aiavatar-watchdog] stuck QUEUED job={} created={} → dispatch", job.getId(), job.getCreatedAt());
                toResume.add(job);
            }
        }

        // 派发续跑
        for (AiAvatarJob job : toResume) {
            try {
                runner.runAsync(job.getId());
            } catch (Exception e) {
                log.error("[aiavatar-watchdog] resume dispatch failed job={}: {}", job.getId(), e.getMessage());
            }
        }

        if (!staleRunning.isEmpty() || !toResume.isEmpty() || failedExhausted > 0) {
            log.info("[aiavatar-watchdog] sweep done: stale={}, resumed={}, exhausted={}",
                    staleRunning.size(), toResume.size(), failedExhausted);
        } else {
            log.debug("[aiavatar-watchdog] sweep clean (no action)");
        }
    }
}
