package com.aistareco.aep.service;

import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.repository.CreditHoldRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 孤儿 hold 自动清扫（v2 §5 P0）。
 *
 * 业务任务（视频生成 / 分发等）下单时 {@code hold} 冻结积分到 pendingBalance，正常由 commit/release 收尾。
 * 但任务进程崩溃 / 重启丢内存态 / 异常路径漏 release 时，会留下 ACTIVE 的孤儿 hold —— pendingBalance
 * 一直占着，用户看到「可用积分变少」却找不到原因，转成客诉 → 又要运营去调差。本清扫器定时把
 * 超 TTL 仍 ACTIVE 的 hold 自动 {@code releaseHold} 退回原桶。
 *
 * TTL 必须大于最长合法任务时长（视频生成轮询上限 ~15min），默认 180min，避免误杀在途任务。
 * releaseHold 幂等：若 hold 在清扫间隙已 commit/release，本次为 no-op，安全。
 */
@Component
@ConditionalOnProperty(name = "aep.credit.stale-hold-sweeper.enabled", havingValue = "true", matchIfMissing = true)
public class CreditHoldSweeper {

    @org.springframework.beans.factory.annotation.Autowired private AiGenerationQueueService generationQueue;

    private static final Logger log = LoggerFactory.getLogger(CreditHoldSweeper.class);

    private final CreditHoldRepository holdRepo;
    private final CreditService creditService;
    private final long ttlMinutes;
    @org.springframework.beans.factory.annotation.Autowired
    private com.aistareco.aep.ipstudio.repository.IpRunRepository ipRuns;
    @org.springframework.beans.factory.annotation.Autowired
    private com.aistareco.aep.repository.MaterialVideoJobRepository videoJobs;
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.beans.factory.ObjectProvider<com.aistareco.aep.service.materialvideo.MaterialVideoJobService> videoService;

    public CreditHoldSweeper(CreditHoldRepository holdRepo,
                             CreditService creditService,
                             @Value("${aep.credit.stale-hold-ttl-minutes:180}") long ttlMinutes) {
        this.holdRepo = holdRepo;
        this.creditService = creditService;
        this.ttlMinutes = ttlMinutes;
    }

    /** 默认每 30 分钟扫一次，启动 2 分钟后首扫。 */
    @Scheduled(
            fixedDelayString = "${aep.credit.stale-hold-sweep-ms:1800000}",
            initialDelayString = "${aep.credit.stale-hold-sweep-initial-ms:120000}")
    public void sweep() {
        Instant cutoff = Instant.now().minus(Duration.ofMinutes(ttlMinutes));
        List<CreditHold> stale = holdRepo.findByStatusAndCreatedAtBefore(CreditHold.Status.ACTIVE, cutoff);
        if (stale.isEmpty()) {
            return;
        }
        log.info("[hold-sweeper] {} 个超 {}min 未结算的 ACTIVE hold，开始释放", stale.size(), ttlMinutes);
        int released = 0;
        for (CreditHold h : stale) {
            try {
                // A recorded/uncertain upstream video submission owns its hold until reconciliation.
                // A TTL does not establish supplier failure and must never fund a second submission.
                if(videoJobs!=null && "material_video_job".equals(h.getReferenceType())) {
                    var job=videoJobs.findById(h.getReferenceId()).orElse(null);
                    if(job!=null && ("submitting".equals(job.getStatus()) || "generating".equals(job.getStatus())))continue;
                    if(job!=null && "queued".equals(job.getStatus())) {
                        if(videoService!=null && videoService.getObject().expireQueued(job.getId(),job.getOwnerUserId(),"视频排队超时"))released++;
                        continue; // live tasks are canceled with their hold/auth; never refund and leave them dispatchable
                    }
                }
                if(generationQueue!=null && (("ip-run".equals(h.getReferenceType()) &&
                        (generationQueue.isWaiting(AiGenerationQueueService.IMAGE,h.getReferenceId()) || generationQueue.isWaiting(AiGenerationQueueService.WORKFLOW,h.getReferenceId()))) ||
                        ("material_video_job".equals(h.getReferenceType()) && generationQueue.isWaiting(AiGenerationQueueService.VIDEO,h.getReferenceId())))) continue;
                // An accepted audio Job remains recoverable after a long provider outage.
                // Its hold is owned by the durable speech worker, not an orphan.
                if(ipRuns!=null && com.aistareco.aep.ipstudio.service.IpRunService.REF_TYPE.equals(h.getReferenceType()) &&
                        ipRuns.findById(h.getReferenceId()).filter(r->"running".equals(r.getStatus()) && (com.aistareco.aep.ipstudio.service.StudioSpeechWorker.manages(r.getKind()) || com.aistareco.aep.ipstudio.service.IpRunWorker.hasNativeSubmission(r))).isPresent()) continue;
                // A dialogue task whose worker still heartbeats owns its hold and settles it itself; a task without a
                // heartbeat is expired (and released) by the dialogue reconciler, not here.
                if(ipRuns!=null && com.aistareco.aep.ipstudio.service.IpRunService.REF_TYPE.equals(h.getReferenceType()) &&
                        ipRuns.findById(h.getReferenceId()).filter(r->com.aistareco.aep.ipstudio.dialogue.StudioDialogueTurnWorker.isLive(r,Instant.now())).isPresent()) continue;
                creditService.releaseHold(h.getReferenceType(), h.getReferenceId(),
                        "超时自动释放（hold 超 " + ttlMinutes + " 分钟未结算）");
                released++;
            } catch (Exception e) {
                // 单笔失败不阻断整批；下一轮再试
                log.warn("[hold-sweeper] 释放失败 hold={} ref={}:{} err={}",
                        h.getId(), h.getReferenceType(), h.getReferenceId(), e.toString());
            }
        }
        log.info("[hold-sweeper] 已释放 {}/{} 笔孤儿 hold", released, stale.size());
    }
}
