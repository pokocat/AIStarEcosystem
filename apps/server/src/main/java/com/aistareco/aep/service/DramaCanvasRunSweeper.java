package com.aistareco.aep.service;

import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.model.DramaCanvasRun;
import com.aistareco.aep.repository.CreditHoldRepository;
import com.aistareco.aep.repository.DramaCanvasRunRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 画布运行的超时回收（v0.198）：queued / running 且最后一次写入超过时限的收尾并退回冻结 ——
 * 文字、出图 10 分钟，合成 20 分钟。没有这道兜底，一次进程重启就会留下永远在跑的记录：前端轮询拿不到终态，
 * 冻结额要等 CreditHoldSweeper 三小时后才回来（同 {@code IpRunReaper}）。
 *
 * <ul>
 *   <li>收尾都是<b>条件更新</b>（仍在途、且 updatedAt 还是这里读到的值）：读到之后 worker 动过 = 它还活着，
 *       影响 0 行就放弃、不退款；worker 那边每次结算 / 收尾同样是条件更新，两边只有一方生效（{@code DramaCanvasRunWorker}）。</li>
 *   <li>出图已经结算过几张的，按「部分成功」收尾：保留已出的图、退剩余，refs.notes 写明只出了几张。</li>
 *   <li><b>视频</b>以 MaterialVideoJob 为准：先按任务同步；底层任务排队 30 分钟还没交给厂商（进程重启丢了派发）
 *       → 条件更新判失败并退款；已经交给厂商的不动（只能管理端对账），只在 refs.notes 里说「比平时久」。
 *       另外每轮把「画布已判失败、底层任务后来被对账恢复成功」的视频运行改回成功（只读原任务，不重提）。</li>
 *   <li><b>批量出图</b>共用一个冻结：同一批里还有项在 10 分钟内动过（worker 每跑一项都会给后面的项刷心跳）
 *       就先不动；整批都僵了才在一个事务里把在途的收尾、把共用冻结退一次。</li>
 * </ul>
 */
@Service
public class DramaCanvasRunSweeper {

    private static final Logger log = LoggerFactory.getLogger(DramaCanvasRunSweeper.class);

    static final Duration TEXT_IMAGE_TIMEOUT = Duration.ofMinutes(10);
    static final Duration ASSEMBLE_TIMEOUT = Duration.ofMinutes(20);
    /** 每轮最多核对多少条「对账恢复」的视频运行。 */
    static final int RECOVER_BATCH = 100;
    /** 批量冻结创建多久之后才去核对「整批都终态了没退」（刚受理的批次各项还在排队，本来就不该动）。 */
    static final Duration ORPHAN_BATCH_HOLD_AFTER = Duration.ofMinutes(5);

    private final DramaCanvasRunRepository runs;
    private final DramaCanvasRunWorker worker;
    private final CreditHoldRepository holds;

    public DramaCanvasRunSweeper(DramaCanvasRunRepository runs, DramaCanvasRunWorker worker, CreditHoldRepository holds) {
        this.runs = runs;
        this.worker = worker;
        this.holds = holds;
    }

    @Scheduled(fixedDelay = 60_000L, initialDelay = 90_000L)
    public void reapStale() {
        try {
            sweep(OffsetDateTime.now());
        } catch (Exception e) {
            log.warn("[drama-canvas] 超时回收失败: {}", e.getMessage());
        }
        try {
            int n = worker.recoverVideos(RECOVER_BATCH);
            if (n > 0) log.info("[drama-canvas] 对账恢复后改回成功的视频运行 {} 条", n);
        } catch (Exception e) {
            log.warn("[drama-canvas] 视频对账恢复核对失败: {}", e.getMessage());
        }
        try {
            releaseOrphanBatchHolds(OffsetDateTime.now());
        } catch (Exception e) {
            log.warn("[drama-canvas] 批量冻结补退失败: {}", e.getMessage());
        }
    }

    /**
     * 补退批量出图的共用冻结：整批每一项都已终态、共用 hold 却仍 ACTIVE（批次跑完时那次退回失败了，或进程在最后一项
     * 收尾之后、退回之前挂了）→ 把剩余退回。退回是幂等的（hold 已终态就是空操作），和 worker 撞上也只退一次。
     * 批次从 hold 引用反推第 0 项（{@code DramaCanvasRunService.batchHoldRefOf}），再按第 0 项记着的 batchRunIds 收齐。
     *
     * @return 补退了几个批次
     */
    public int releaseOrphanBatchHolds(OffsetDateTime now) {
        List<CreditHold> active = holds.findByStatusAndCreatedAtBefore(CreditHold.Status.ACTIVE,
                now.minus(ORPHAN_BATCH_HOLD_AFTER).toInstant());
        int n = 0;
        for (CreditHold h : active) {
            if (!DramaCanvasRunService.REF_TYPE.equals(h.getReferenceType())) continue;
            String lead = DramaCanvasRunService.batchLeadRunIdOf(h.getReferenceId());
            if (lead == null) continue;
            DramaCanvasRun first = runs.findById(lead).orElse(null);
            if (first == null) continue;
            List<String> ids = new ArrayList<>();
            worker.execOf(first).path("batchRunIds").forEach(x -> ids.add(x.asText()));
            if (ids.isEmpty()) continue;
            List<DramaCanvasRun> members = runs.findAllById(ids);
            if (members.size() < ids.size() || members.stream().anyMatch(m -> !m.isTerminal())) continue;
            worker.release(h.getReferenceId(), "画布 · 批量出图已全部结束，补退没用掉的冻结");
            log.warn("[drama-canvas] 批量出图共用冻结补退 ref={} members={}", h.getReferenceId(), ids.size());
            n++;
        }
        return n;
    }

    /** 可直接调用的实现体（测试用）。返回收了尾的条数。 */
    public int sweep(OffsetDateTime now) {
        OffsetDateTime cutoff = now.minus(TEXT_IMAGE_TIMEOUT);
        OffsetDateTime assembleCutoff = now.minus(ASSEMBLE_TIMEOUT);
        List<DramaCanvasRun> stale = runs.findByStatusInAndUpdatedAtBefore(
                List.of(DramaCanvasRun.STATUS_QUEUED, DramaCanvasRun.STATUS_RUNNING), cutoff);
        int n = 0;
        Set<String> handledBatches = new HashSet<>();
        for (DramaCanvasRun run : stale) {
            try {
                switch (run.getKind()) {
                    case DramaCanvasRun.KIND_VIDEO -> {
                        if (worker.reapVideo(run, now)) n++;
                    }
                    case DramaCanvasRun.KIND_ASSEMBLE -> {
                        // 合成免费，没有冻结
                        if (run.getUpdatedAt() != null && run.getUpdatedAt().isBefore(assembleCutoff)
                                && worker.expireStale(run, false)) {
                            n++;
                        }
                    }
                    default -> {
                        JsonNode exec = worker.execOf(run);
                        if (exec.has("batchRunIds")) {
                            String holdRef = exec.path("holdRef").asText("");
                            if (!handledBatches.add(holdRef)) continue;
                            n += expireBatch(exec, holdRef, cutoff);
                        } else if (worker.expireStale(run, true)) {
                            n++;
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("[drama-canvas] 回收单条失败 run={}: {}", run.getId(), e.getMessage());
            }
        }
        return n;
    }

    /** 整批都僵了才回收：交给 worker 在一个事务里收尾全部在途项并退一次共用冻结。 */
    private int expireBatch(JsonNode exec, String holdRef, OffsetDateTime cutoff) {
        List<String> ids = new ArrayList<>();
        exec.path("batchRunIds").forEach(x -> ids.add(x.asText()));
        List<DramaCanvasRun> members = runs.findAllById(ids);
        for (DramaCanvasRun m : members) {
            if (!m.isTerminal() && m.getUpdatedAt() != null && !m.getUpdatedAt().isBefore(cutoff)) {
                return 0; // 这一批还有项在动
            }
        }
        return worker.expireBatch(members, holdRef);
    }
}
