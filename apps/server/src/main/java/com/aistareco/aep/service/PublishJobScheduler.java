package com.aistareco.aep.service;

import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.model.PublishJobStatus;
import com.aistareco.aep.repository.PublishJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * v0.15+: 定时发布扫描器。
 *
 * 每 60s 扫一次 PublishJob 表，挑出 status=QUEUED 且 scheduledAt<=now 的行，调 startJob。
 *
 * 状态机零侵入：不新增 SCHEDULED 状态；scheduledAt=null 即时入口，scheduledAt!=null 等扫描器。
 * 失败：startJob 内部已写 FAILED + 不退款，scheduler 不重试（人为干预或 retry endpoint）。
 *
 * 单实例约束：@Scheduled 默认串行同 bean。多实例部署需 ShedLock（v0.16+ 候选）。
 * 启动延迟 30s，避开 server 启动期的 resumeInflight 竞态。
 */
@Component
public class PublishJobScheduler {

    private static final Logger log = LoggerFactory.getLogger(PublishJobScheduler.class);

    private final PublishJobRepository jobRepo;
    private final PublishJobService publishService;

    public PublishJobScheduler(PublishJobRepository jobRepo, PublishJobService publishService) {
        this.jobRepo = jobRepo;
        this.publishService = publishService;
    }

    // 频率选择：
    //   initialDelay 5s 避开 server 启动期 resumeInflight 竞态，但够快让"立即派单"短等
    //   fixedDelay 10s 让"立即派单"最多 10s 内启动；定时发布的精度 10s 也够用
    // 旧值 60s+30s 在 dev 环境太慢：用户立即派单 → 等 30s+ 才看到状态变化，会以为卡了
    @Scheduled(fixedDelay = 10_000L, initialDelay = 5_000L)
    public void dispatchDueJobs() {
        Instant now = Instant.now();
        List<PublishJob> due = jobRepo.findDueQueuedJobs(PublishJobStatus.QUEUED, now);
        if (due.isEmpty()) return;
        log.info("[publish-scheduler] {} due jobs at {}", due.size(), now);
        for (PublishJob job : due) {
            try {
                publishService.startJob(job.getUserId(), job.getId());
                log.info("[publish-scheduler] started jobId={} platform={} scheduledAt={}",
                        job.getId(), job.getPlatform(), job.getScheduledAt());
            } catch (Exception e) {
                // startJob 内部已落 FAILED；这里 catch 防止单条失败阻塞批
                log.warn("[publish-scheduler] start failed jobId={}: {}", job.getId(), e.getMessage());
            }
        }
    }
}
