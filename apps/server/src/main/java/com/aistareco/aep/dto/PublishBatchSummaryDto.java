package com.aistareco.aep.dto;

import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.model.PublishJobStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * v0.22: 分发中心「任务追踪」按 projectId 聚合的卡片数据。
 *
 * 不在 DB 落表 —— 服务端按页拉 PublishJob，Java 层 fold 成本 DTO 后回前端。
 *
 * source 派生（不是真值列）：
 *   - projectId 以 "mixcut-batch-" 开头 → "mixcut"
 *   - projectId 以 "manual-batch-" 开头，或字面等于 "manual" → "manual"
 *   - 其他 → "other"
 *
 * 字段对齐 packages/types/src/publish-job.ts 的 `PublishBatchSummary`（camelCase）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PublishBatchSummaryDto(
        String projectId,
        String source,
        String displayTitle,
        int totalJobs,
        Map<String, Integer> statusCounts,
        int progressPct,
        Instant firstCreatedAt,
        Instant lastCreatedAt,
        Instant firstScheduledAt,
        Instant lastScheduledAt,
        List<String> platforms,
        boolean hasInflight
) {

    /**
     * 从同一 projectId 下的若干 PublishJob 行 fold 成 summary。
     * rows 不为空 + 同 projectId，调用方保证。
     */
    public static PublishBatchSummaryDto from(String projectId, List<PublishJob> rows) {
        if (rows == null || rows.isEmpty()) {
            throw new IllegalArgumentException("rows must not be empty for projectId=" + projectId);
        }

        EnumMap<PublishJobStatus, Integer> bucket = new EnumMap<>(PublishJobStatus.class);
        for (PublishJobStatus s : PublishJobStatus.values()) bucket.put(s, 0);

        // platform 去重保留首次出现顺序（同源批次内通常 1-3 个平台，LinkedHashSet 廉价）
        LinkedHashSet<String> platforms = new LinkedHashSet<>();

        Instant firstCreatedAt = null, lastCreatedAt = null;
        Instant firstScheduledAt = null, lastScheduledAt = null;
        String firstNonBlankTitle = null;

        int total = rows.size();

        for (PublishJob j : rows) {
            PublishJobStatus s = j.getStatus();
            if (s != null) bucket.merge(s, 1, Integer::sum);

            String platform = j.getPlatform() != null ? j.getPlatform().wire() : null;
            if (platform != null && !platform.isBlank()) platforms.add(platform);

            Instant c = j.getCreatedAt();
            if (c != null) {
                if (firstCreatedAt == null || c.isBefore(firstCreatedAt)) firstCreatedAt = c;
                if (lastCreatedAt == null || c.isAfter(lastCreatedAt)) lastCreatedAt = c;
            }
            Instant sc = j.getScheduledAt();
            if (sc != null) {
                if (firstScheduledAt == null || sc.isBefore(firstScheduledAt)) firstScheduledAt = sc;
                if (lastScheduledAt == null || sc.isAfter(lastScheduledAt)) lastScheduledAt = sc;
            }
            if (firstNonBlankTitle == null && j.getTitle() != null && !j.getTitle().isBlank()) {
                firstNonBlankTitle = j.getTitle();
            }
        }

        // 8 个 wire key（lowercase）展开成 Map<String,Integer>，0 也保留方便前端对齐。
        // 顺序按 enum ordinal 排（与 PublishJobStatus 注释里的状态机一致）。
        Map<String, Integer> statusCounts = new TreeMap<>();
        for (PublishJobStatus s : PublishJobStatus.values()) {
            statusCounts.put(s.wire(), bucket.get(s));
        }

        int terminalDone = bucket.get(PublishJobStatus.LIVE)
                + bucket.get(PublishJobStatus.FAILED)
                + bucket.get(PublishJobStatus.CANCELLED);
        int progressPct = total == 0 ? 0 : (int) Math.floor(terminalDone * 100.0 / total);

        boolean hasInflight = bucket.get(PublishJobStatus.QUEUED) > 0
                || bucket.get(PublishJobStatus.UPLOADING) > 0
                || bucket.get(PublishJobStatus.TRANSCODING) > 0
                || bucket.get(PublishJobStatus.PUBLISHING) > 0
                || bucket.get(PublishJobStatus.AWAITING_USER) > 0;

        String displayTitle = firstNonBlankTitle != null
                ? firstNonBlankTitle + " ×" + total
                : "未命名 ×" + total;

        return new PublishBatchSummaryDto(
                projectId,
                deriveSource(projectId),
                displayTitle,
                total,
                statusCounts,
                progressPct,
                firstCreatedAt,
                lastCreatedAt,
                firstScheduledAt,
                lastScheduledAt,
                new ArrayList<>(platforms),
                hasInflight
        );
    }

    /** 根据 projectId 前缀派生 source 标签。 */
    public static String deriveSource(String projectId) {
        if (projectId == null) return "other";
        if (projectId.startsWith("mixcut-batch-")) return "mixcut";
        if (projectId.startsWith("manual-batch-") || "manual".equals(projectId)) return "manual";
        return "other";
    }
}
