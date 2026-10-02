package com.aistareco.aep.videostudio.service;

import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.materialvideo.VideoGenSpec;
import com.aistareco.aep.videostudio.model.StudioPromptOptimization;
import com.aistareco.aep.videostudio.repository.StudioPromptOptimizationRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * 智能优化的后台执行（docs/video-studio-plan.md §9）。独立 bean（@Async 自调用会失效），跑在
 * {@code videoStudioOptimizationExecutor} 上，不占出片的线程。
 *
 * <p>开工是一次条件更新（queued → running），抢不到就不调厂商。收尾（成功扣 / 失败退）都交给
 * {@link VideoStudioOptimizationSettlement}：改状态和动积分在同一个事务里，与兜底回收、拒绝派发走同一套条件更新，
 * 同一笔冻结只会被结算一次。结算回滚时记录保持原状态（running），这里只记 WARN，留给
 * {@link VideoStudioOptimizationReaper} 判失败并退冻结。
 */
@Service
public class VideoStudioOptimizationWorker {

    private static final Logger log = LoggerFactory.getLogger(VideoStudioOptimizationWorker.class);

    private final StudioPromptOptimizationRepository repo;
    private final MaterialVideoModelClient modelClient;
    private final VideoStudioOptimizationSettlement settlement;
    private final ObjectMapper om;

    public VideoStudioOptimizationWorker(StudioPromptOptimizationRepository repo,
                                         MaterialVideoModelClient modelClient,
                                         VideoStudioOptimizationSettlement settlement,
                                         ObjectMapper om) {
        this.repo = repo;
        this.modelClient = modelClient;
        this.settlement = settlement;
        this.om = om;
    }

    @Async("videoStudioOptimizationExecutor")
    public void runAsync(String id) {
        run(id);
    }

    /** 实现体（测试直接调）。 */
    public void run(String id) {
        StudioPromptOptimization row = repo.findById(id).orElse(null);
        if (row == null) {
            log.warn("[video-studio] 优化记录不存在 id={}", id);
            return;
        }
        if (repo.claimRunning(id, Instant.now()) != 1) {
            log.info("[video-studio] 优化记录已不在排队（status={}），跳过 id={}", row.getStatus(), id);
            return;
        }
        MaterialVideoModelClient.OptimizeResult result;
        String ledgerLabel;
        try {
            JsonNode spec = om.readTree(row.getSpecJson());
            result = modelClient.optimizePrompt(
                    row.getId(),
                    row.getOriginalPrompt(),
                    spec.path(VideoStudioOptimizationService.SPEC_SECONDS).asInt(0),
                    spec.path(VideoStudioOptimizationService.SPEC_ASPECT_RATIO).asText(null),
                    row.getOwnerUserId(),
                    row.getEndpointId(),
                    VideoGenSpec.fromVariantConfig(spec));
            ledgerLabel = VideoStudioOptimizationService.CREDIT_LABEL + " · "
                    + VideoStudioService.modeName(spec.path(VideoGenSpec.KEY_GENERATION_MODE).asText(null));
        } catch (BusinessException e) {
            String message = "VIDEO_STUDIO_OPTIMIZATION_TIMEOUT".equals(e.getCode())
                    ? timeoutMessage(row.getCreditsHeld()) : e.getMessage();
            log.warn("[video-studio] 智能优化失败 id={} code={} message={} detail={}",
                    id, e.getCode(), e.getMessage(), e.getInternalDetail());
            fail(row, message);
            return;
        } catch (Throwable t) {
            log.error("[video-studio] 智能优化异常 id={}", id, t);
            fail(row, VideoStudioOptimizationSettlement.DEFAULT_FAILURE_MESSAGE);
            return;
        }
        succeed(row, result, ledgerLabel);
    }

    private void succeed(StudioPromptOptimization row, MaterialVideoModelClient.OptimizeResult result, String ledgerLabel) {
        boolean settled;
        try {
            settled = settlement.succeed(row, result.optimizedPrompt(), result.vendorOptimizationId(), ledgerLabel);
        } catch (RuntimeException e) {
            log.warn("[video-studio] 智能优化成功但结算回滚（扣积分失败），记录保持 running，等兜底回收判失败并退冻结 "
                    + "id={} credits={} err={}", row.getId(), row.getCreditsHeld(), e.toString());
            return;
        }
        if (!settled) {
            // 回收已经判它失败并退了冻结：结果作废，别再扣。
            log.warn("[video-studio] 优化结果回来时记录已不在 running（已被兜底回收判失败），结果丢弃 id={}", row.getId());
            return;
        }
        log.info("[video-studio] 智能优化完成 id={} user={} credits={}", row.getId(), row.getOwnerUserId(),
                row.getCreditsHeld());
    }

    private void fail(StudioPromptOptimization row, String message) {
        try {
            settlement.fail(row, message);
        } catch (RuntimeException e) {
            log.warn("[video-studio] 智能优化判失败时结算回滚（退冻结失败），记录保持 running，等兜底回收再退 "
                    + "id={} credits={} err={}", row.getId(), row.getCreditsHeld(), e.toString());
        }
    }

    /** 超时的说法：收了钱的提醒已退回，没收钱的不提积分。 */
    static String timeoutMessage(long creditsHeld) {
        return creditsHeld > 0 ? "智能优化超时，积分已退回" : "智能优化超时，请重新优化";
    }
}
