package com.aistareco.aep.videostudio.service;

import com.aistareco.aep.videostudio.model.StudioPromptOptimization;
import com.aistareco.aep.videostudio.repository.StudioPromptOptimizationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 智能优化的兜底回收：每 5 分钟把 {@code updated_at} 超过 20 分钟仍是 queued / running 的记录判失败并退冻结。
 *
 * <p>没有它，一次服务重启（线程被杀在等厂商的半路）或一次结算回滚就会留下永远「正在优化」的记录：前端一直转圈，
 * 冻结要等 {@code CreditHoldSweeper} 三小时后才回来。20 分钟大于 worker 的重试预算（12 分钟，每次调用的超时都按
 * 剩余预算截短，预算从上传素材之前算起），所以活着的 worker 一定先结束。判失败走
 * {@link VideoStudioOptimizationSettlement#failIfStale}：条件更新里再带一次同一个 cutoff（列出来之后刚被 worker 领走的
 * 那条不再卡住，不动它），改状态与退冻结同一个事务，不会和 worker 抢着扣 / 退；退冻结失败时这一条整个回滚，下一轮再试。
 */
@Service
public class VideoStudioOptimizationReaper {

    private static final Logger log = LoggerFactory.getLogger(VideoStudioOptimizationReaper.class);

    static final Duration STALE_AFTER = Duration.ofMinutes(20);

    private final StudioPromptOptimizationRepository repo;
    private final VideoStudioOptimizationSettlement settlement;

    public VideoStudioOptimizationReaper(StudioPromptOptimizationRepository repo,
                                         VideoStudioOptimizationSettlement settlement) {
        this.repo = repo;
        this.settlement = settlement;
    }

    @Scheduled(fixedDelay = 300_000L, initialDelay = 120_000L)
    public void reap() {
        try {
            sweep(Instant.now());
        } catch (Exception e) {
            log.warn("[video-studio] 智能优化兜底回收失败: {}", e.getMessage());
        }
    }

    /** 实现体（测试直接调）。返回这一轮判失败的条数（没抢到的、结算回滚的不算）。 */
    public int sweep(Instant now) {
        Instant cutoff = now.minus(STALE_AFTER);
        List<StudioPromptOptimization> stale = repo.findByStatusInAndUpdatedAtBefore(
                List.of(StudioPromptOptimization.STATUS_QUEUED, StudioPromptOptimization.STATUS_RUNNING), cutoff);
        int n = 0;
        for (StudioPromptOptimization row : stale) {
            boolean failed;
            try {
                // 同一个 cutoff 再判一次：列出来之后 worker 可能刚把它领走（排队超过 20 分钟的那种），别把刚开工的判死
                failed = settlement.failIfStale(row, VideoStudioOptimizationWorker.timeoutMessage(row.getCreditsHeld()),
                        cutoff);
            } catch (RuntimeException e) {
                log.warn("[video-studio] 兜底回收判失败时结算回滚（退冻结失败），记录保持 {}，下一轮再试 id={} credits={} err={}",
                        row.getStatus(), row.getId(), row.getCreditsHeld(), e.toString());
                continue;
            }
            if (failed) {
                n++;
                log.warn("[video-studio] 智能优化卡住超过 {} 分钟，判失败并退冻结 id={} user={} status={} credits={}",
                        STALE_AFTER.toMinutes(), row.getId(), row.getOwnerUserId(), row.getStatus(), row.getCreditsHeld());
            }
        }
        return n;
    }
}
