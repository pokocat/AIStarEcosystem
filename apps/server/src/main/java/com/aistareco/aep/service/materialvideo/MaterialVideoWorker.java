package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.CreditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/**
 * 带货视频生成 worker —— 提交视频大模型任务后服务端轮询直到出片 / 超时。
 *
 * 与 MixcutRenderingService 同惯例：独立 bean（避免 @Async 自调用失效），@Async 入口仅捕获异常 +
 * mark failed；进度更新走 load-mutate-save（仓库默认事务即提交，前端独立轮询可见）。
 *
 * 积分：成功 commit（已 hold 的 creditsHeld）/ 失败 release（不可变账本约束，CLAUDE.md §4.2）。
 */
@Service
public class MaterialVideoWorker {

    private static final Logger log = LoggerFactory.getLogger(MaterialVideoWorker.class);

    private final MaterialVideoJobRepository jobRepo;
    private final MaterialVideoModelClient modelClient;
    private final MaterialVideoProperties props;
    private final CreditService creditService;

    public MaterialVideoWorker(MaterialVideoJobRepository jobRepo,
                               MaterialVideoModelClient modelClient,
                               MaterialVideoProperties props,
                               CreditService creditService) {
        this.jobRepo = jobRepo;
        this.modelClient = modelClient;
        this.props = props;
        this.creditService = creditService;
    }

    @Async("materialVideoExecutor")
    public void generateAsync(String jobId) {
        log.info("[material-video] worker picked up job={} thread={}", jobId, Thread.currentThread().getName());
        MaterialVideoJob job = jobRepo.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[material-video] job {} not found, skip", jobId);
            return;
        }
        if (isTerminal(job.getStatus())) {
            log.info("[material-video] job {} already terminal ({}), skip", jobId, job.getStatus());
            return;
        }
        try {
            runGeneration(job);
        } catch (Throwable t) {
            log.error("[material-video] job {} failed", jobId, t);
            String msg = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
            markFailed(jobId, msg);
            // 提交阶段（submit）抛错时积分已 hold 但 runGeneration 内部没机会 release；
            // 这里兜底退款。releaseHold 幂等：若内部失败路径已退过，这次是 no-op。
            releaseCredits(job, msg);
        }
    }

    private void runGeneration(MaterialVideoJob job) throws InterruptedException {
        String jobId = job.getId();
        updateStatus(jobId, "submitting", 5, null);

        MaterialVideoModelClient.SubmitResult submit =
                modelClient.submit(job.getPrompt(), job.getDurationSec(), job.getAspectRatio());
        markGenerating(jobId, submit.taskId(), submit.providerUsed(), submit.modelUsed());

        long start = System.currentTimeMillis();
        long maxWaitMs = props.getMaxWaitSeconds() * 1000L;
        long intervalMs = Math.max(2, props.getPollIntervalSeconds()) * 1000L;

        while (true) {
            Thread.sleep(intervalMs);
            long elapsed = System.currentTimeMillis() - start;

            MaterialVideoModelClient.PollResult poll = modelClient.poll(submit.taskId());
            if (poll.succeeded()) {
                if (poll.videoUrl() == null || poll.videoUrl().isBlank()) {
                    markFailed(jobId, "视频大模型返回成功但未给出成片 URL（taskId=" + submit.taskId() + "）");
                    releaseCredits(job, "视频生成无成片 URL");
                    return;
                }
                markSucceeded(jobId, poll.videoUrl(), poll.thumbnailUrl());
                commitCredits(job);
                log.info("[material-video] job {} succeeded · url={}", jobId, poll.videoUrl());
                return;
            }
            if (poll.failed()) {
                markFailed(jobId, "视频大模型返回失败（status=" + poll.rawStatus() + "，taskId=" + submit.taskId() + "）");
                releaseCredits(job, "视频生成失败");
                return;
            }
            // 仍在生成：按 elapsed/maxWait 估算进度（封顶 95%，留给出片那一刻置 100）。
            int pct = (int) Math.min(95, 10 + (elapsed * 85.0 / Math.max(1, maxWaitMs)));
            updateStatus(jobId, "generating", pct, null);

            if (elapsed >= maxWaitMs) {
                markFailed(jobId, "视频生成超时（已等待 " + props.getMaxWaitSeconds() + "s，taskId=" + submit.taskId() + "）");
                releaseCredits(job, "视频生成超时");
                return;
            }
        }
    }

    // ── 状态更新（load-mutate-save；仓库默认事务即提交） ─────────────────────────

    private void updateStatus(String jobId, String status, int progress, String error) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus(status);
            j.setProgress(Math.max(0, Math.min(100, progress)));
            if (error != null) j.setErrorMessage(truncate(error, 1000));
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    private void markGenerating(String jobId, String taskId, String provider, String model) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("generating");
            j.setProgress(Math.max(j.getProgress(), 10));
            j.setExternalTaskId(taskId);
            j.setProviderUsed(provider);
            j.setModelUsed(model);
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    private void markSucceeded(String jobId, String videoUrl, String thumb) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("succeeded");
            j.setProgress(100);
            j.setVideoUrl(videoUrl);
            if (thumb != null) j.setThumbnailUrl(thumb);
            j.setErrorMessage(null);
            j.setCompletedAt(OffsetDateTime.now());
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    private void markFailed(String jobId, String message) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("failed");
            j.setErrorMessage(truncate(message, 1000));
            j.setCompletedAt(OffsetDateTime.now());
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    // ── 积分 ────────────────────────────────────────────────────────────────

    private void commitCredits(MaterialVideoJob job) {
        if (job.getCreditsHeld() <= 0) return;
        try {
            creditService.commitHold(MaterialVideoJobService.CREDIT_REF_TYPE, job.getId(),
                    job.getCreditsHeld(), "带货视频生成 · " + safe(job.getName()));
        } catch (Exception e) {
            log.warn("[material-video] commit credits failed job={} err={}", job.getId(), e.getMessage());
        }
    }

    private void releaseCredits(MaterialVideoJob job, String reason) {
        if (job.getCreditsHeld() <= 0) return;
        try {
            creditService.releaseHold(MaterialVideoJobService.CREDIT_REF_TYPE, job.getId(),
                    "带货视频生成失败 · 退回积分 · " + truncate(reason, 200));
        } catch (Exception e) {
            log.warn("[material-video] release credits failed job={} err={}", job.getId(), e.getMessage());
        }
    }

    private static boolean isTerminal(String status) {
        return "succeeded".equals(status) || "failed".equals(status);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String safe(String s) {
        return (s == null || s.isBlank()) ? "视频" : s;
    }
}
