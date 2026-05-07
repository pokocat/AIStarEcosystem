package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/**
 * Frontend mirror: apps/web/src/types/notification.ts {@code ChatMessage}（discriminated union by `type`）.
 *
 * 单一 record 容纳所有消息类型，按 type 解构使用对应字段：
 *   - time/text/user-text:  { type, text }
 *   - card-cta:   { type, title, body, [accent], [highlight], [cta] }
 *   - card-form:  { type, title, [tag], fields, [cta] }
 *   - card-grid:  { type, title, [sub], items, [cta] }
 *
 * NON_NULL 序列化：用不到的字段自动从 JSON 中省略，避免前端处理 null 字段噪声。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ChatMessageDto(
        String type,
        String text,
        Boolean accent,
        String title,
        String body,
        String sub,
        Map<String, Object> highlight,
        Map<String, Object> tag,
        List<Map<String, Object>> fields,
        List<Map<String, Object>> items,
        Map<String, Object> cta
) {
    /** 时间分隔条："上午 10:23" */
    public static ChatMessageDto time(String text) {
        return new ChatMessageDto("time", text, null, null, null, null, null, null, null, null, null);
    }

    /** Bot 文本气泡 */
    public static ChatMessageDto text(String text) {
        return new ChatMessageDto("text", text, null, null, null, null, null, null, null, null, null);
    }

    /** 用户发送的文本（右对齐） */
    public static ChatMessageDto userText(String text) {
        return new ChatMessageDto("user-text", text, null, null, null, null, null, null, null, null, null);
    }

    /** 富 CTA 卡片（accent=true 时左侧加霓虹绿条） */
    public static ChatMessageDto cardCta(String title, String body, boolean accent,
                                         Map<String, Object> highlight, Map<String, Object> cta) {
        return new ChatMessageDto("card-cta", null, accent ? Boolean.TRUE : null, title, body,
                null, highlight, null, null, null, cta);
    }

    /** 表单卡片（资质待完善等） */
    public static ChatMessageDto cardForm(String title, Map<String, Object> tag,
                                          List<Map<String, Object>> fields, Map<String, Object> cta) {
        return new ChatMessageDto("card-form", null, null, title, null, null, null, tag, fields, null, cta);
    }

    /** 2×N 网格卡片 */
    public static ChatMessageDto cardGrid(String title, String sub,
                                          List<Map<String, Object>> items, Map<String, Object> cta) {
        return new ChatMessageDto("card-grid", null, null, title, null, sub, null, null, null, items, cta);
    }
}
