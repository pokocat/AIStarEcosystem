package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 大模型用途分类（v0.5 §D8 新增）。
 * AiModelInvocationService.invokeChat(purpose, ...) 按此选 provider。
 */
public enum AiModelPurpose {
    SCRIPT_DRAFT,           // 模板脚本起草（admin 编辑器"AI 改写" + 素材运营起稿中心 AI 起稿）
    SELLING_POINTS,         // 商品卖点提取（素材运营商品表单「AI 提取卖点」）
    VARIABLE_EXTRACT,       // 脚本可替换变量抽取（素材运营派生变体）
    VIDEO_GENERATION,       // 带货视频生成（素材运营派生视频；异步 submit+poll，见 MaterialVideoModelClient）
    SAFETY_REVIEW,          // 风控复检（敏感词 / 政策合规）
    VIDEO_REF_ANALYSIS,     // 视频参考分析（v0.6 自动抽帧用）
    TEMPLATE_REWRITE,       // 现有 prompt 改写
    APPEARANCE_FORGE,       // 形象锻造对话（music/drama 形象顾问；流式 chat，见 ForgeChatService）
    DRAMA_SCRIPT_DRAFT,     // 短剧脚本起草（drama 短剧生成；分场景 + 分镜 + 台词，见 DramaScriptService）
    DAP_PERSONA,            // 数字人平台 · 人设解析 / 指令翻译（chat，见 AgnesClient）
    DAP_IMAGE,              // 数字人平台 · 图片生成（t2i / i2i，见 AgnesClient）
    DAP_VIDEO,              // 数字人平台 · 视频生成（异步 submit+poll，见 AgnesClient）
    GENERAL;                // 通用兜底

    @JsonValue
    public String wire() {
        return name();
    }

    /** 中文展示名（admin「AI 应用绑定」用）。 */
    public String label() {
        return switch (this) {
            case SCRIPT_DRAFT -> "脚本起草";
            case SELLING_POINTS -> "卖点提取";
            case VARIABLE_EXTRACT -> "变量抽取";
            case VIDEO_GENERATION -> "视频生成";
            case SAFETY_REVIEW -> "风控复检";
            case VIDEO_REF_ANALYSIS -> "视频参考分析";
            case TEMPLATE_REWRITE -> "模板改写";
            case APPEARANCE_FORGE -> "形象锻造对话";
            case DRAMA_SCRIPT_DRAFT -> "短剧脚本起草";
            case DAP_PERSONA -> "数字人 · 人设/翻译";
            case DAP_IMAGE -> "数字人 · 图片生成";
            case DAP_VIDEO -> "数字人 · 视频生成";
            case GENERAL -> "通用";
        };
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
