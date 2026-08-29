package com.aistareco.aep.service.music;

import com.aistareco.aep.config.MusicGenProperties;
import com.aistareco.aep.model.MusicGenJob;
import com.aistareco.aep.service.CreditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/**
 * 音乐生成执行体：提交 → 轮询 → 镜像产物 → 结算积分 → 建歌曲行。
 *
 * <p>并发上限 = {@code musicGenExecutor} 线程池大小（默认 2，对齐火山公共资源池限制），
 * 因为轮询期间线程被 sleep 占住。
 *
 * <p>计费的关键细节：hold 时按**请求时长**冻结，成功后按上游回报的**实际成曲时长**
 * commit，差额 release。音乐模型的实际时长常与请求值不等（火山后付费正是按实际秒数计费），
 * 不这么做就会多扣或少扣。
 */
@Service
public class MusicGenWorker {

    private static final Logger log = LoggerFactory.getLogger(MusicGenWorker.class);

    private final MusicGenJobState state;
    private final MusicGenModelClient modelClient;
    private final MusicOutputStorage outputStorage;
    private final CreditService creditService;
    private final MusicGenProperties props;

    public MusicGenWorker(MusicGenJobState state,
                          MusicGenModelClient modelClient,
                          MusicOutputStorage outputStorage,
                          CreditService creditService,
                          MusicGenProperties props) {
        this.state = state;
        this.modelClient = modelClient;
        this.outputStorage = outputStorage;
        this.creditService = creditService;
        this.props = props;
    }

    @Async("musicGenExecutor")
    public void generateAsync(String jobId) {
        try {
            runGeneration(jobId);
        } catch (Exception e) {
            log.warn("[music-gen] job={} aborted: {}", jobId, e.toString());
            MusicGenJob job = state.find(jobId).orElse(null);
            state.markFailed(jobId, userFacing(e));
            releaseCredits(job, "音乐生成失败");
        }
    }

    private void runGeneration(String jobId) throws InterruptedException {
        MusicGenJob job = state.find(jobId).orElse(null);
        if (job == null) {
            log.warn("[music-gen] job={} disappeared before start", jobId);
            return;
        }
        // 镜像未开启就别开工：宁可当场失败退款，也不交付一个会过期的上游地址（§8.0）。
        if (!props.isUploadToCdn()) {
            state.markFailed(jobId, "音频存储未启用，无法交付作品，请联系运营。");
            releaseCredits(job, "音频存储未启用");
            return;
        }

        String endpointId = extractEndpointId(job.getOptionsJson());
        state.markStatus(jobId, "submitting", 5);

        var submit = modelClient.submit(new MusicGenModelClient.SubmitSpec(
                job.getPrompt(), job.getLyrics(), job.getGenre(), job.getMood(),
                job.getTimbre(), job.getGender(), job.getDurationSec(),
                job.isInstrumental(), endpointId));
        state.markGenerating(jobId, submit.taskId(), submit.providerUsed(), submit.modelUsed());
        log.info("[music-gen] job={} submitted task={} model={}", jobId, submit.taskId(), submit.modelUsed());

        long maxWaitMs = props.getMaxWaitSeconds() * 1000L;
        long intervalMs = Math.max(2, props.getPollIntervalSeconds()) * 1000L;
        long startedAt = System.currentTimeMillis();

        while (true) {
            Thread.sleep(intervalMs);
            long elapsed = System.currentTimeMillis() - startedAt;

            var poll = modelClient.poll(endpointId, submit.taskId());

            if (poll.succeeded()) {
                finish(jobId, job, poll);
                return;
            }
            if (poll.failed()) {
                String reason = poll.failReason() == null ? "音乐生成失败" : mapFailReason(poll.failReason());
                state.markFailed(jobId, reason);
                releaseCredits(job, "音乐生成失败");
                return;
            }
            // 上游有真实进度就用真实值，否则按耗时估算；两者都封顶 95，留给转存收尾。
            int pct = poll.progress() > 0
                    ? clamp(poll.progress(), 10, 95)
                    : (int) Math.min(95, 10 + elapsed * 85.0 / maxWaitMs);
            state.heartbeat(jobId, pct);

            if (elapsed >= maxWaitMs) {
                state.markFailed(jobId, "音乐生成超时，请稍后重试。");
                releaseCredits(job, "音乐生成超时");
                return;
            }
        }
    }

    /** 成功分支：先转存拿到我方 key，再结算积分，最后建歌曲行。 */
    private void finish(String jobId, MusicGenJob job, MusicGenModelClient.PollResult poll) {
        if (poll.audioUrl() == null || poll.audioUrl().isBlank()) {
            state.markFailed(jobId, "音乐生成完成但没有返回音频，请重试。");
            releaseCredits(job, "上游未返回音频");
            return;
        }
        state.heartbeat(jobId, 96);

        MusicOutputStorage.Stored stored;
        try {
            stored = outputStorage.persistAudio(job.getOwnerUserId(), poll.audioUrl());
        } catch (RuntimeException e) {
            log.warn("[music-gen] job={} persist failed: {}", jobId, e.toString());
            state.markFailed(jobId, "音频转存失败，请重试。");
            releaseCredits(job, "音频转存失败");
            return;
        }

        long settled = settleCredits(job, poll.durationSec());
        String title = deriveTitle(job);
        String songId = state.markSucceeded(jobId, stored.cdnKey(), stored.bytes(),
                poll.durationSec(), poll.lyrics(), poll.captions(), settled, title);
        log.info("[music-gen] job={} succeeded song={} duration={}s settled={}",
                jobId, songId, poll.durationSec(), settled);
    }

    /**
     * 按实际时长结算：commit 实际应付部分，剩余 release 退回。
     * hold 不存在（未计费任务）时直接返回 0。
     */
    private long settleCredits(MusicGenJob job, Integer actualDurationSec) {
        if (job == null || job.getCreditsHeld() <= 0) return 0L;
        long held = job.getCreditsHeld();
        long payable = held;
        if (actualDurationSec != null && actualDurationSec > 0 && job.getDurationSec() > 0) {
            // 单价 = held / 请求时长；按实际时长重算，且不超过已冻结额度。
            double perSec = (double) held / job.getDurationSec();
            payable = Math.min(held, Math.max(1L, Math.round(perSec * actualDurationSec)));
        }
        try {
            creditService.commitHold(MusicGenJobService.CREDIT_REF_TYPE, job.getId(), payable, "音乐创作结算");
        } catch (RuntimeException e) {
            log.warn("[music-gen] job={} commit failed: {}", job.getId(), e.toString());
            return 0L;
        }
        if (payable < held) {
            // 差额退回。releaseHold 幂等，失败只记日志不影响已完成的作品。
            try {
                creditService.releaseHold(MusicGenJobService.CREDIT_REF_TYPE, job.getId(), "音乐创作时长差额退回");
            } catch (RuntimeException e) {
                log.warn("[music-gen] job={} partial release failed: {}", job.getId(), e.toString());
            }
        }
        return payable;
    }

    private void releaseCredits(MusicGenJob job, String reason) {
        if (job == null || job.getCreditsHeld() <= 0) return;
        try {
            creditService.releaseHold(MusicGenJobService.CREDIT_REF_TYPE, job.getId(), reason);
        } catch (RuntimeException e) {
            log.warn("[music-gen] job={} release failed: {}", job.getId(), e.toString());
        }
    }

    /**
     * 僵死任务回收：进程重启会让 @Async 线程消失，任务永远停在 generating。
     * 心跳过期即判失败并退款 —— video 线缺这个兜底，这里一开始就补上。
     */
    @Scheduled(fixedDelayString = "${aep.music.gen.reaper-interval-ms:60000}",
            initialDelayString = "${aep.music.gen.reaper-initial-ms:120000}")
    public void reapStaleJobs() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusSeconds(Math.max(60, props.getStaleHeartbeatSeconds()));
        for (MusicGenJob job : state.findStale(cutoff)) {
            log.warn("[music-gen] reaping stale job={} status={} heartbeat={}",
                    job.getId(), job.getStatus(), job.getHeartbeatAt());
            state.markFailed(job.getId(), "生成任务已中断，积分已退回，请重新创作。");
            releaseCredits(job, "任务中断自动退回");
        }
    }

    private static String deriveTitle(MusicGenJob job) {
        String basis = job.getPrompt() != null && !job.getPrompt().isBlank()
                ? job.getPrompt() : job.getLyrics();
        if (basis == null || basis.isBlank()) return "未命名作品";
        String firstLine = basis.strip().split("\\R", 2)[0].strip();
        // 去掉歌词结构标签，避免标题变成 "[verse]"
        firstLine = firstLine.replaceAll("^\\[[^\\]]*\\]\\s*", "").strip();
        if (firstLine.isBlank()) return "未命名作品";
        return firstLine.length() <= 24 ? firstLine : firstLine.substring(0, 24);
    }

    /** 上游失败原因转成用户看得懂的话（不暴露内部枚举）。 */
    private static String mapFailReason(String raw) {
        if (raw == null) return "音乐生成失败，请重试。";
        String s = raw.toLowerCase();
        if (s.contains("plagiar") || s.contains("copy")) {
            return "歌词涉嫌与已有作品重复，请修改后重试。";
        }
        if (s.contains("sensitive") || s.contains("risk") || s.contains("audit")) {
            return "内容未通过安全审核，请调整创作内容后重试。";
        }
        return "音乐生成失败，请调整创作内容后重试。";
    }

    private static String userFacing(Exception e) {
        if (e instanceof com.aistareco.common.BusinessException be) {
            return be.getMessage();
        }
        return "音乐生成失败，请稍后重试。";
    }

    private static String extractEndpointId(String optionsJson) {
        if (optionsJson == null || optionsJson.isBlank()) return null;
        try {
            var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(optionsJson);
            String v = node.path("endpoint_id").asText(null);
            return (v == null || v.isBlank()) ? null : v;
        } catch (Exception e) {
            return null;
        }
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
