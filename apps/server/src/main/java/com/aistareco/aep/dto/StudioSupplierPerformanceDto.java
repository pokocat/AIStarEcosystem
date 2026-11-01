package com.aistareco.aep.dto;

import java.time.Instant;
import java.util.List;

/** Read-only, bounded supplier-delivery analysis. No prompt, user id, or upstream credential is exposed. */
public record StudioSupplierPerformanceDto(
        Instant generatedAt,
        String timezone,
        Window window,
        Filters filters,
        Summary summary,
        List<TrendPoint> trend,
        List<LatencyBucket> latencyDistribution,
        List<ErrorSlice> errors,
        List<String> suppliers,
        List<String> models,
        DetailPage details
) {
    public record Window(Instant startInclusive, Instant endExclusive, String bucket, int maxRangeDays) {}
    public record Filters(String supplier, String model, String mediaType, String status,
                          List<String> excludedFailureCategories, String query) {}
    public record Summary(long tasks, long succeeded, long failed, long inFlight, long cancelled,
                          long unknown, long terminalSamples, Double deliverySuccessRate,
                          Long p50Seconds, Long p95Seconds, Long maxSeconds, long latencySamples,
                          long excludedTasks, String latencyDefinition, boolean smallSample) {}
    public record TrendPoint(Instant start, long succeeded, long failed, long inFlight,
                             long cancelled, long unknown, Double deliverySuccessRate) {}
    public record LatencyBucket(String key, String label, long count, double percentage) {}
    public record ErrorSlice(String category, String label, String ownership, long count,
                             double percentage) {}
    public record TaskDetail(String id, String source, String supplier, String model, String mediaType,
                             String status, String failureCategory, String failureLabel, String ownership,
                             String errorCode, Instant createdAt, Instant completedAt, Long durationSeconds) {}
    public record DetailPage(List<TaskDetail> items, int page, int size, long total, boolean hasMore) {}
}
