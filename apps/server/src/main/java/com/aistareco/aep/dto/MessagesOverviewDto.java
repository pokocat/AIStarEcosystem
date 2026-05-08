package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * 消息首页聚合：待办中心 + Bot 同事会话预览（v0.5.1 新增）。
 *
 * 替代原 GET /notifications 的"列表 NotificationDto"返回，
 * 与小程序 messages 页期望的 shape 完全一致：
 *   { todos: [{title, sub, count, accent, route}], conversations: [BotConversationPreview] }
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MessagesOverviewDto(
        List<TodoItemDto> todos,
        List<BotConversationPreviewDto> conversations
) {

    /**
     * 待办中心条目。count 由 server 按当前用户的真实业务态聚合。
     */
    public record TodoItemDto(
            String title,
            String sub,
            int count,
            boolean accent,
            String route
    ) {}

    /**
     * Bot 同事会话列表行（消息首页一行）。
     * preview = 该 Bot 历史最近一条 text 类消息（来自 NotificationService.getConversation 的 canned 流）。
     * dot = 该用户对该 Bot 的未读计数。
     */
    public record BotConversationPreviewDto(
            String botId,
            String name,
            String role,
            String color,            // 头像背景色
            String roleBg,           // 角色 chip 背景色
            String roleColor,        // 角色 chip 文字色
            String avatarIcon,       // 头像内字符
            String preview,          // 一行预览
            String time,             // 相对时间或绝对时间文案
            int dot,                 // 未读数（红点）
            boolean accent           // 是否高亮（如未读 > 0）
    ) {}
}
