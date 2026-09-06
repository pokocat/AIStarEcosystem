package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.service.CreditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * 僵死运行清理：{@code running} 且心跳超过 {@code aep.ipstudio.stale-minutes} 的运行
 * 置 failed 并释放冻结。
 *
 * <p>没有这道兜底，一次进程重启（或线程被 kill）就会留下永远 running 的行：
 * 前端轮询永远拿不到终态，用户的冻结额要等 CreditHoldSweeper 三小时后才回来。
 */
@Service
public class IpRunReaper {

    private static final Logger log = LoggerFactory.getLogger(IpRunReaper.class);

    private final IpRunRepository runRepo;
    private final CreditService credits;
    private final IpStudioProperties props;

    public IpRunReaper(IpRunRepository runRepo, CreditService credits, IpStudioProperties props) {
        this.runRepo = runRepo;
        this.credits = credits;
        this.props = props;
    }

    @Scheduled(fixedDelay = 120_000L, initialDelay = 90_000L)
    public void reapStale() {
        try {
            sweep();
        } catch (Exception e) {
            log.warn("[ipstudio] stale reaper 失败: {}", e.getMessage());
        }
    }

    /** 可直接调用的实现体（测试用）。返回被判失败的条数。 */
    public int sweep() {
        Instant cutoff = Instant.now().minus(Math.max(1, props.getStaleMinutes()), ChronoUnit.MINUTES);
        List<IpRun> stale = runRepo.findByStatusAndHeartbeatAtBefore(IpRun.STATUS_RUNNING, cutoff);
        int n = 0;
        for (IpRun run : stale) {
            try {
                credits.releaseHold(IpRunService.REF_TYPE, run.getId(), "IP 运行超时 · 释放冻结");
            } catch (Exception e) {
                log.warn("[ipstudio] 超时运行释放冻结失败 run={}: {}", run.getId(), e.getMessage());
            }
            run.setStatus(IpRun.STATUS_FAILED);
            run.setStage("failed");
            run.setErrorCode("IP_RUN_TIMEOUT");
            run.setErrorMessage("生成超时，未产生结果，已退回冻结积分，请重试");
            run.setCost(0);
            run.setFinishedAt(Instant.now());
            run.setHeartbeatAt(Instant.now());
            runRepo.save(run);
            n++;
            log.warn("[ipstudio] 运行超时判失败 run={} project={} node={}",
                    run.getId(), run.getProjectId(), run.getNodeId());
        }
        return n;
    }
}
