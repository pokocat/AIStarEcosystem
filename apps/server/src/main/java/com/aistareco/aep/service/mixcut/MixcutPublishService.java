package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.dto.CreatePublishJobInputDto;
import com.aistareco.aep.dto.MixcutPublishBatchRequest;
import com.aistareco.aep.dto.MixcutPublishBatchRequest.ScheduleSpec;
import com.aistareco.aep.dto.MixcutPublishBatchResultDto;
import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.model.MixcutRenderOutput;
import com.aistareco.aep.repository.MixcutRenderOutputRepository;
import com.aistareco.aep.service.PublishJobService;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

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
    private static final Pattern TIME_SLOT_PATTERN = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final int JITTER_MAX_MINUTES = 30;
    private static final DateTimeFormatter PROJECT_ID_SUFFIX_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.of("Asia/Shanghai"));

    private final PublishJobService publishJobService;
    private final MixcutRenderOutputRepository outputRepository;

    public MixcutPublishService(
            PublishJobService publishJobService,
            MixcutRenderOutputRepository outputRepository
    ) {
        this.publishJobService = publishJobService;
        this.outputRepository = outputRepository;
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
        Instant[] perOutputAt = expandSchedule(req.schedule(), req.outputs().size());

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
                        // 混剪批量发布暂不携带商品挂载；操作员后续手工编辑 (v0.16+) 或
                        // 走分发中心「手动分发」补登。
                        null,
                        null,
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
     * 把 ScheduleSpec 展开成 outputs.size 长的 Instant 数组。
     * 前端的预览算法 (BatchPublishDrawer expandDailyRecurringPreview) 必须与本函数 1:1 对齐。
     */
    Instant[] expandSchedule(ScheduleSpec spec, int n) {
        Instant[] result = new Instant[n];
        Instant now = Instant.now();

        if (spec == null || spec instanceof ScheduleSpec.Immediate) {
            for (int i = 0; i < n; i++) result[i] = now;
            return result;
        }
        if (spec instanceof ScheduleSpec.Single s) {
            if (s.at() == null) {
                throw BusinessException.badRequest("SCHEDULE_AT_REQUIRED", "single 策略需要 at");
            }
            for (int i = 0; i < n; i++) result[i] = s.at();
            return result;
        }
        if (spec instanceof ScheduleSpec.DailyRecurring d) {
            return expandDailyRecurring(d, n, now);
        }
        throw BusinessException.badRequest("SCHEDULE_INVALID", "不支持的 strategy");
    }

    private Instant[] expandDailyRecurring(ScheduleSpec.DailyRecurring d, int n, Instant now) {
        // 校验
        if (d.timeSlots() == null || d.timeSlots().isEmpty()) {
            throw BusinessException.badRequest("TIME_SLOTS_REQUIRED", "time_slots 至少一个");
        }
        LinkedHashSet<String> normalizedSet = new LinkedHashSet<>();
        for (String raw : d.timeSlots()) {
            if (raw == null || !TIME_SLOT_PATTERN.matcher(raw).matches()) {
                throw BusinessException.badRequest("TIME_SLOT_INVALID", "时段 " + raw + " 不是 HH:MM");
            }
            normalizedSet.add(raw);
        }
        List<String> slots = new ArrayList<>(normalizedSet);
        slots.sort(String::compareTo);
        int k = slots.size();

        if (d.timezone() == null || d.timezone().isBlank()) {
            throw BusinessException.badRequest("TZ_REQUIRED", "timezone 必填");
        }
        ZoneId zone;
        try {
            zone = ZoneId.of(d.timezone());
        } catch (Exception e) {
            throw BusinessException.badRequest("TZ_INVALID", "时区 " + d.timezone() + " 无法解析");
        }

        if (d.startDate() == null || d.startDate().isBlank()) {
            throw BusinessException.badRequest("START_DATE_REQUIRED", "start_date 必填");
        }
        LocalDate d0;
        try {
            d0 = LocalDate.parse(d.startDate());
        } catch (Exception e) {
            throw BusinessException.badRequest("START_DATE_INVALID", "start_date 不是 YYYY-MM-DD");
        }

        int jitterMin = d.jitterMinutes() == null ? 0 : d.jitterMinutes();
        if (jitterMin < 0 || jitterMin > JITTER_MAX_MINUTES) {
            throw BusinessException.badRequest("JITTER_OUT_OF_RANGE",
                    "jitter_minutes 必须在 [0, " + JITTER_MAX_MINUTES + "]");
        }

        if (d.maxDays() != null) {
            if (d.maxDays() <= 0) {
                throw BusinessException.badRequest("MAX_DAYS_INVALID", "max_days 必须 > 0");
            }
            long capacity = (long) d.maxDays() * (long) k;
            if (n > capacity) {
                throw BusinessException.badRequest("OUTPUTS_EXCEED_CAPACITY",
                        n + " 条变体超出 " + d.maxDays() + " 天 × " + k + " 槽 = " + capacity + " 容量");
            }
        }

        // 铺开
        Instant[] result = new Instant[n];
        ThreadLocalRandom rng = ThreadLocalRandom.current();
        for (int i = 0; i < n; i++) {
            LocalTime t = LocalTime.parse(slots.get(i % k));
            Instant slot = ZonedDateTime.of(d0.plusDays(i / k), t, zone).toInstant();
            if (jitterMin > 0) {
                int delta = rng.nextInt(-jitterMin, jitterMin + 1); // 上界排他 → +1
                slot = slot.plus(Duration.ofMinutes(delta));
            }
            // 过去 slot clamp 到 now：调度器下一个 tick 即起飞
            result[i] = slot.isBefore(now) ? now : slot;
        }
        return result;
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
