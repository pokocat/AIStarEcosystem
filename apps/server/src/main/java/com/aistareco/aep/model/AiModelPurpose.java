package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 大模型用途分类（v0.5 §D8 新增）。
 * AiModelInvocationService.invokeChat(purpose, ...) 按此选 provider。
 */
public enum AiModelPurpose {
    SCRIPT_DRAFT,           // 模板脚本起草（admin 编辑器"AI 改写"）
    SAFETY_REVIEW,          // 风控复检（敏感词 / 政策合规）
    VIDEO_REF_ANALYSIS,     // 视频参考分析（v0.6 自动抽帧用）
    TEMPLATE_REWRITE,       // 现有 prompt 改写
    GENERAL;                // 通用兜底

    @JsonValue
    public String wire() {
        return name();
    }

    @JsonCreator
    public static AiModelPurpose fromWire(String w) {
        if (w == null) return GENERAL;
        try {
            return AiModelPurpose.valueOf(w.toUpperCase());
        } catch (Exception e) {
            return GENERAL;
        }
    }
}
