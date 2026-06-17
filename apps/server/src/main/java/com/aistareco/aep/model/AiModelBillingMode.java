package com.aistareco.aep.model;

/** AI 模型端点成本估算口径。null/auto 时按用途推断。 */
public enum AiModelBillingMode {
    TOKENS,     // 文本模型：输入 / 输出 token 单价
    PER_CALL,   // 图片/部分视频：按次、按张、按条
    PER_SECOND; // 视频：按生成时长秒数

    public static AiModelBillingMode fromWire(String value) {
        if (value == null || value.isBlank() || "AUTO".equalsIgnoreCase(value)) return null;
        try {
            return AiModelBillingMode.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (Exception ignored) {
            return TOKENS;
        }
    }
}
