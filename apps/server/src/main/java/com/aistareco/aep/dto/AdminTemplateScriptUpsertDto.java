package com.aistareco.aep.dto;

import java.util.List;
import java.util.Map;

/**
 * admin POST/PUT /api/admin/template-scripts[/{id}] 请求体。
 * 字段全集（含 metrics / experiment 等内部字段，仅 admin 可写）。
 */
public record AdminTemplateScriptUpsertDto(
        String templateId,
        String kind,                                    // "text" | "video_ref"
        String language,                                // 默认 "zh-CN"
        Map<String, Object> persona,
        String systemPrompt,
        List<Map<String, Object>> scenes,
        Map<String, Object> visualStyle,
        String negativePrompt,
        List<Map<String, Object>> variables,
        Map<String, Object> engineAdapters,
        Map<String, Object> durationVariants,
        Map<String, Object> postProcess,
        Map<String, Object> safety,
        Map<String, Object> referenceClip,              // VIDEO_REF 模式必填
        Map<String, Object> experiment,
        Map<String, Object> metrics
) {}
