package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 单个可用模型条目（落 AiModelProvider.modelsJson 的元素 / 模型发现返回项）。
 * 字段名与前端 AiModelEntry 1:1。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiModelEntryDto(
        String id,
        String label,
        Integer contextWindow,
        Boolean supportsVision,
        /** 能直接读视频（拉片 v2，StudioVisualContext.supportsVideo）。 */
        Boolean supportsVideo
) {
    public AiModelEntryDto(String id, String label, Integer contextWindow, Boolean supportsVision) {
        this(id, label, contextWindow, supportsVision, null);
    }
}
