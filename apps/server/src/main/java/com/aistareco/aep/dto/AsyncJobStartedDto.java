package com.aistareco.aep.dto;

/**
 * Frontend mirror: apps/web/src/types/_shared.ts {@code AsyncJobStarted}.
 * 用于 startGeneration / batchDistribute 等异步任务的统一返回。
 */
public record AsyncJobStartedDto(
        String jobId,
        String status,
        String pollUrl,
        Integer pollIntervalMs,
        Integer estimatedSeconds
) {
}
