package com.aistareco.aep.service.publish;

import com.aistareco.aep.dto.MixcutPublishBatchRequest.ScheduleSpec;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

/**
 * 把 {@link ScheduleSpec} 展开成 N 长的 Instant[]。
 *
 * v0.15 起内嵌在 MixcutPublishService；v0.22 抽出来共享 —— 让 PublishJobBatchService
 * 的 rescheduleBatch 也能复用同一份铺开算法（防止两端逻辑漂移）。
 *
 * 前端 BatchPublishDrawer.expandDailyRecurringPreview 必须与本类 1:1 对齐 ——
 * 前端做预览不带 jitter（不可重放）；后端是真值源。
 */
@Service
public class ScheduleExpander {

    private static final Pattern TIME_SLOT_PATTERN = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final int JITTER_MAX_MINUTES = 30;

    /**
     * 展开 spec → 长度 n 的 Instant 数组。
     *
     * 行为：
     *  - null / Immediate → 全部 = now
     *  - Single           → 全部 = spec.at（缺则报 SCHEDULE_AT_REQUIRED）
     *  - DailyRecurring   → 按 outputs.顺序 折成 day×slot；可加 jitter；过去 slot clamp 到 now
     */
    public Instant[] expandSchedule(ScheduleSpec spec, int n) {
        if (n <= 0) return new Instant[0];
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

        Instant[] result = new Instant[n];
        ThreadLocalRandom rng = ThreadLocalRandom.current();
        for (int i = 0; i < n; i++) {
            LocalTime t = LocalTime.parse(slots.get(i % k));
            Instant slot = ZonedDateTime.of(d0.plusDays(i / k), t, zone).toInstant();
            if (jitterMin > 0) {
                int delta = rng.nextInt(-jitterMin, jitterMin + 1);
                slot = slot.plus(Duration.ofMinutes(delta));
            }
            result[i] = slot.isBefore(now) ? now : slot;
        }
        return result;
    }
}
