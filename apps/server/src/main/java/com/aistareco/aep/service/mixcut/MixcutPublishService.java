package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.dto.CreatePublishJobInputDto;
import com.aistareco.aep.dto.MixcutPublishBatchRequest;
import com.aistareco.aep.dto.MixcutPublishBatchResultDto;
import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.model.MixcutRenderOutput;
import com.aistareco.aep.repository.MixcutRenderOutputRepository;
import com.aistareco.aep.service.PublishJobService;
import com.aistareco.aep.service.publish.ScheduleExpander;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * v0.15+: 把混剪变体批量派单成 PublishJob。
 *
 * 每个 (output × target) 一条 PublishJob。
 * 失败处理：逐 output 独立 try/catch，单条失败不影响其他 output 派单（部分成功）。
 * 不开顶层事务（PublishJobService.createBatch 自己有事务边界）—— 避免一条失败整批回滚。
 *
 * v0.20+: ScheduleSpec 三种 strategy:
 *   - immediate (默认；缺 schedule 时回落)        → 全部 perOutputAt[i] = now
 *   - single (兼容 v0.15 行为)                    → 全部 perOutputAt[i] = spec.at
 *   - daily_recurring (新)                        → 按 timeSlots × maxDays 把 outputs 错峰铺开；
 *                                                   可选 jitter_minutes 在 slot 时间附近做 [-N, +N] 抖动
 * outputs[] 顺序即铺开顺序：第 i 条 → 第 (i/K) 天的第 (i%K) 槽（K=timeSlots.size）。
 * scheduledAt 早于 now 的 slot 会 clamp 到 now（调度器 10s 内吃掉），防止 UI 显示过去时间。
 */
@Service
public class MixcutPublishService {

    private static final Logger log = LoggerFactory.getLogger(MixcutPublishService.class);
    private static final DateTimeFormatter PROJECT_ID_SUFFIX_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.of("Asia/Shanghai"));

    private final PublishJobService publishJobService;
    private final MixcutRenderOutputRepository outputRepository;
    private final ScheduleExpander scheduleExpander;

    public MixcutPublishService(
            PublishJobService publishJobService,
            MixcutRenderOutputRepository outputRepository,
            ScheduleExpander scheduleExpander
    ) {
        this.publishJobService = publishJobService;
        this.outputRepository = outputRepository;
        this.scheduleExpander = scheduleExpander;
    }

    public MixcutPublishBatchResultDto batchPublish(String userId, MixcutPublishBatchRequest req) {
        if (userId == null || userId.isBlank()) {
            throw BusinessException.badRequest("UNAUTHENTICATED", "未登录");
        }
        if (req == null) {
            throw BusinessException.badRequest("INPUT_REQUIRED", "缺少请求体");
        }
        if (req.outputs() == null || req.outputs().isEmpty()) {
            throw BusinessException.badRequest("OUTPUTS_REQUIRED", "outputs 至少一个");
        }
        if (req.targets() == null || req.targets().isEmpty()) {
            throw BusinessException.badRequest("TARGETS_REQUIRED", "targets 至少一个");
        }
        if (req.title() == null || req.title().isBlank()) {
            throw BusinessException.badRequest("TITLE_REQUIRED", "title 必填");
        }

        // v0.20: 先把 schedule 算成 per-output Instant 数组（DB 写入前做全部校验）。
        Instant[] perOutputAt = scheduleExpander.expandSchedule(req.schedule(), req.outputs().size());

        String projectId = resolveProjectId(req);

        List<PublishJobDto> successJobs = new ArrayList<>();
        List<MixcutPublishBatchResultDto.FailedItem> failed = new ArrayList<>();
        int totalRequested = 0;

        List<MixcutPublishBatchRequest.OutputItem> outputs = req.outputs();
        for (int i = 0; i < outputs.size(); i++) {
            var output = outputs.get(i);
            Instant slotAt = perOutputAt[i];

            // 每个 output 独立 targets snapshot，注入本 output 的 scheduledAt
            // —— 同一 output 在 slotAt 时刻同时派到所有账号（不跨账号错峰）。
            List<CreatePublishJobInputDto.Target> outputTargets = new ArrayList<>(req.targets().size());
            for (var t : req.targets()) {
                outputTargets.add(new CreatePublishJobInputDto.Target(
                        t.platform(), t.socialAccountId(), slotAt
                ));
            }
            totalRequested += outputTargets.size();

            if (output.cdnUrl() == null || output.cdnUrl().isBlank()) {
                failed.add(new MixcutPublishBatchResultDto.FailedItem(
                        output.outputId(),
                        "MISSING_CDN_URL",
                        "该变体尚未上传到 CDN，无法发布"));
                continue;
            }
            try {
                CreatePublishJobInputDto input = new CreatePublishJobInputDto(
                        projectId,
                        output.cdnUrl(),
                        req.title(),
                        req.description(),
                        req.tags() != null ? req.tags() : List.of(),
                        output.thumbnailUrl() != null ? output.thumbnailUrl() : req.coverUrl(),
                        // v0.22: 商品挂载顶层透传 —— 同一商品挂到 N 条混剪变体上，
                        // 非 douyin 目标 sau-service 会静默忽略。两项都为空 = 非带货视频。
                        req.productLink(),
                        req.productTitle(),
                        outputTargets
                );
                List<PublishJobDto> created = publishJobService.createBatch(userId, input);
                successJobs.addAll(created);
                log.info("[mixcut-publish] output {} (idx={}, slotAt={}) → {} jobs queued",
                        output.outputId(), i, slotAt, created.size());
                // v0.19: 落 publish_count / last_published_at；视频库 UI 用此显示「已发 ×N」。
                // tracker 失败不应影响业务结果 —— 派单本身已成功。
                bumpPublishTracker(output.outputId(), created.size());
            } catch (BusinessException be) {
                failed.add(new MixcutPublishBatchResultDto.FailedItem(
                        output.outputId(),
                        be.getCode() != null ? be.getCode() : "BUSINESS_ERROR",
                        be.getMessage()
                ));
                log.warn("[mixcut-publish] output {} failed: {} {}", output.outputId(), be.getCode(), be.getMessage());
            } catch (Exception e) {
                failed.add(new MixcutPublishBatchResultDto.FailedItem(
                        output.outputId(),
                        "INTERNAL_ERROR",
                        e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()
                ));
                log.warn("[mixcut-publish] output {} failed: {}", output.outputId(), e.getMessage());
            }
        }

        return new MixcutPublishBatchResultDto(successJobs, failed, totalRequested);
    }

    /**
     * projectId 防撞：调用方未指定时拼 "mixcut-batch-<source>-<yyyyMMddHHmmss>"。
     * 避免同源混剪任务多次铺开（cadence 复用），所有 PublishJob 撞在同一 project_id。
     */
    private String resolveProjectId(MixcutPublishBatchRequest req) {
        if (req.projectId() != null && !req.projectId().isBlank()) {
            return req.projectId();
        }
        String source = req.sourceMixcutJobId() != null ? req.sourceMixcutJobId() : "ad-hoc";
        return "mixcut-batch-" + source + "-" + PROJECT_ID_SUFFIX_FORMAT.format(Instant.now());
    }

    /** 累加 output 的 publish_count，并把 last_published_at 推到 now。outputId 不存在或无效时静默跳过。 */
    private void bumpPublishTracker(String outputId, int delta) {
        if (outputId == null || outputId.isBlank() || delta <= 0) return;
        try {
            MixcutRenderOutput o = outputRepository.findById(outputId).orElse(null);
            if (o == null) {
                log.warn("[mixcut-publish] tracker skip: output {} not found", outputId);
                return;
            }
            o.setPublishCount(o.getPublishCount() + delta);
            o.setLastPublishedAt(OffsetDateTime.now());
            outputRepository.save(o);
        } catch (Exception e) {
            log.warn("[mixcut-publish] tracker update failed for {}: {}", outputId, e.getMessage());
        }
    }
}
