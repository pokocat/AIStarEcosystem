package com.aistareco.aep.videostudio.service;

import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.videostudio.model.StudioPromptOptimization;
import com.aistareco.aep.videostudio.repository.StudioPromptOptimizationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 智能优化的结算：<b>改状态和扣 / 退积分在同一个短事务里</b>。worker、兜底回收、线程池拒绝派发三条路都只走这里
 * （回收走 {@link #failIfStale}，多判一次「还卡着」）。
 *
 * <ul>
 *   <li>先做条件更新（{@code where status = …}）：返回 1 才去扣 / 退；返回 0 说明别人已经把它改成终态了
 *       （回收先判了失败、重复派发、拒绝路径先到），什么都不动 —— 同一笔冻结不会被结算两次；</li>
 *   <li>扣 / 退抛异常就<b>整个回滚</b>：记录回到原来的 queued / running，冻结原样留着，兜底回收下一轮还能判失败并退冻结。
 *       这里<b>不吞异常</b>：吞了就会出现「成功了却没扣钱」或「显示已退回却还冻着」，而且记录已是终态，回收再也看不见它。
 *       调用方接住异常时记 WARN（带 id），不要再补做别的结算；</li>
 *   <li>两个方法都是 {@code REQUIRES_NEW}，谁来调都是自己一个事务。这是给 afterCommit 回调准备的：那时上一个事务已经提交、
 *       资源还绑在线程上，{@code REQUIRED} 会「加入」那个已经结束的事务，写进去的东西不会被提交
 *       （真跑出来是 {@code no transaction is in progress}）。worker 线程和定时回收本来就没有外层事务，
 *       对它们来说两者一样。</li>
 * </ul>
 */
@Service
public class VideoStudioOptimizationSettlement {

    static final String DEFAULT_FAILURE_MESSAGE = "智能优化失败，请稍后重新优化";

    private final StudioPromptOptimizationRepository repo;
    private final CreditService credits;

    public VideoStudioOptimizationSettlement(StudioPromptOptimizationRepository repo, CreditService credits) {
        this.repo = repo;
        this.credits = credits;
    }

    /**
     * running → succeeded，同一个事务里按冻结额扣积分。
     *
     * @return true = 这次迁移是它做的（已扣）；false = 记录已不在 running，结果作废，没动积分
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean succeed(StudioPromptOptimization row, String optimizedPrompt, String vendorOptimizationId,
                           String ledgerLabel) {
        if (repo.finishSucceeded(row.getId(), optimizedPrompt, vendorOptimizationId, Instant.now()) != 1) {
            return false;
        }
        if (row.getCreditsHeld() > 0) {
            credits.commitHold(VideoStudioOptimizationService.CREDIT_REF_TYPE, row.getId(), row.getCreditsHeld(),
                    ledgerLabel);
        }
        return true;
    }

    /**
     * queued / running → failed，同一个事务里退冻结。
     *
     * @return true = 这次迁移是它做的（已退）；false = 已经是终态，什么都没动
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean fail(StudioPromptOptimization row, String message) {
        String msg = failureMessage(message);
        if (repo.finishFailed(row.getId(), msg, Instant.now()) != 1) {
            return false;
        }
        release(row, msg);
        return true;
    }

    /**
     * 兜底回收专用：和 {@link #fail} 一样，但只在记录的 updated_at 仍早于 {@code cutoff}（还是卡住的）时才判失败。
     * 回收先列出卡住的记录再逐条调这里，中间 worker 可能刚把某一条领走、正在调厂商 —— 那一条这里返回 false，什么都不动。
     *
     * @return true = 判了失败并退了冻结；false = 已是终态，或刚被 worker 领走（不再卡住）
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean failIfStale(StudioPromptOptimization row, String message, Instant cutoff) {
        String msg = failureMessage(message);
        if (repo.finishFailedIfStale(row.getId(), msg, Instant.now(), cutoff) != 1) {
            return false;
        }
        release(row, msg);
        return true;
    }

    private void release(StudioPromptOptimization row, String msg) {
        if (row.getCreditsHeld() > 0) {
            credits.releaseHold(VideoStudioOptimizationService.CREDIT_REF_TYPE, row.getId(),
                    VideoStudioOptimizationService.CREDIT_LABEL + "失败 · 退回积分 · " + truncate(msg, 200));
        }
    }

    private static String failureMessage(String message) {
        return message == null || message.isBlank() ? DEFAULT_FAILURE_MESSAGE : truncate(message, 1000);
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
