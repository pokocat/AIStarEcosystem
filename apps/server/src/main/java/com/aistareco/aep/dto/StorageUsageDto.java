package com.aistareco.aep.dto;

import java.util.List;

/**
 * 存储用量视图（通用，v0.92）。usedMb/quotaMb/remainingMb + 分类明细。
 */
public record StorageUsageDto(
        String app,
        long usedMb,
        long quotaMb,
        long remainingMb,
        List<Slice> breakdown
) {
    public record Slice(String category, long mb) {}
}
