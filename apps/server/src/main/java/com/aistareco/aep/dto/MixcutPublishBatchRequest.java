package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import java.time.Instant;
import java.util.List;

/**
 * v0.15+: POST /api/me/mixcut/publish-batch
 *
 * 把混剪产出的 N 个变体 × M 个发布目标，一次性派单（N×M 条 PublishJob）。
 *
 * outputs[].cdnUrl 必填（用 cdn_url 作 PublishJob.videoUrl；本地 fileUrl 不通过外网发布）。
 * 任一 output 缺 cdnUrl → 该项进 failedItems，不影响其他 output。
 *
 * 字段命名沿 mixcut snake_case 风格（JsonProperty 显式映射）。
 *
 * v0.20+: 引入 ScheduleSpec 多态字段；TargetItem.scheduledAt 移除（时间由 schedule 决定）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MixcutPublishBatchRequest(
        @JsonProperty("source_mixcut_job_id") String sourceMixcutJobId,
        @JsonProperty("outputs") List<OutputItem> outputs,
        @JsonProperty("title") String title,
        @JsonProperty("description") String description,
        @JsonProperty("tags") List<String> tags,
        @JsonProperty("cover_url") String coverUrl,
        @JsonProperty("targets") List<TargetItem> targets,
        /**
         * v0.20+: 调度策略。缺省视为 { strategy: "immediate" }。
         * outputs[].顺序 = 铺开顺序（daily_recurring 时按 i/K 折成日 + i%K 折成时段）。
         */
        @JsonProperty("schedule") ScheduleSpec schedule,
        /** 可选 projectId；缺省时 service 端兜底为 "mixcut-batch-<sourceMixcutJobId>-<yyyyMMddHHmmss>" */
        @JsonProperty("project_id") String projectId
) {

    /** 一个 mixcut 变体。outputId 用于失败回传定位；cdnUrl 是真值（必填）。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record OutputItem(
            @JsonProperty("output_id") String outputId,
            @JsonProperty("cdn_url") String cdnUrl,
            @JsonProperty("thumbnail_url") String thumbnailUrl
    ) {}

    /** v0.20+: 仅账号信息；时间由顶层 ScheduleSpec 决定（不再每个 target 自己带 scheduled_at）。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TargetItem(
            @JsonProperty("platform") String platform,
            @JsonProperty("social_account_id") String socialAccountId
    ) {}

    /**
     * v0.20+: 调度策略。Jackson 用 strategy 字段做 discriminator。
     *  - immediate         立即派单（scheduledAt = now）
     *  - single            全部 N×M 条派单同一时间起飞（兼容 v0.15 行为）
     *  - daily_recurring   按时段 / 天数把 outputs 铺开成错峰 scheduledAt
     */
    @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "strategy")
    @JsonSubTypes({
            @JsonSubTypes.Type(value = ScheduleSpec.Immediate.class, name = "immediate"),
            @JsonSubTypes.Type(value = ScheduleSpec.Single.class, name = "single"),
            @JsonSubTypes.Type(value = ScheduleSpec.DailyRecurring.class, name = "daily_recurring")
    })
    public sealed interface ScheduleSpec
            permits ScheduleSpec.Immediate, ScheduleSpec.Single, ScheduleSpec.DailyRecurring {

        @JsonInclude(JsonInclude.Include.NON_NULL)
        record Immediate() implements ScheduleSpec {}

        @JsonInclude(JsonInclude.Include.NON_NULL)
        record Single(
                @JsonProperty("at") Instant at
        ) implements ScheduleSpec {}

        /**
         * 每天定时铺开。
         *  - startDate    "YYYY-MM-DD"（timezone 解释下的日历日）
         *  - timeSlots    ["09:00","12:00","18:00"]，HH:MM 24h；service 端排序去重
         *  - timezone     IANA, 例 "Asia/Shanghai"
         *  - maxDays      null = 直到 outputs 用完；非 null 时要 outputs.size <= maxDays * timeSlots.size
         *  - jitterMinutes null/0 = 无抖动；否则每条 slot 加 [-N, +N] 分钟随机偏移（最大 30）
         */
        @JsonInclude(JsonInclude.Include.NON_NULL)
        record DailyRecurring(
                @JsonProperty("start_date") String startDate,
                @JsonProperty("time_slots") List<String> timeSlots,
                @JsonProperty("timezone") String timezone,
                @JsonProperty("max_days") Integer maxDays,
                @JsonProperty("jitter_minutes") Integer jitterMinutes
        ) implements ScheduleSpec {}
    }
}
