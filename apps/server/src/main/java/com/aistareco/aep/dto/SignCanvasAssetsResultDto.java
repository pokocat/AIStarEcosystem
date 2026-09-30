package com.aistareco.aep.dto;

import java.util.Map;

/**
 * 画布签名地址换新的结果（v0.198）：TS {@code SignCanvasAssetsResult} 1:1。
 * {@code urls} = key → 新的短期签名地址；只含属于本人的 key，不是本人的 / 不存在的不出现。
 */
public record SignCanvasAssetsResultDto(
        Map<String, String> urls
) {
}
