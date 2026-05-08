package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 用户对每个 AI Bot 同事的"已读位点"（v0.5.2 新增）。
 *
 * 设计：
 *   - 主键 = userId + botId（复合自然键，存为 "{userId}|{botId}"）
 *   - lastReadAt = 用户上次打开该 Bot chat 的时间
 *
 * 用途：
 *   - 打开 chat 时调 markBotConversationRead → 把 lastReadAt 更新为 now
 *   - 消息首页"未读 dot" = 该 Bot 的"数据源"里 createdAt > lastReadAt 的条目计数
 *
 * 这是"按需查询"代替"事件总线推送"的方案：不需要消息队列，
 *   server 每次都从业务实体（CelebrityProjectVideo / Authorization / Star ...）实时查"自上次已读以来的变化"。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "user_bot_read_state")
public class UserBotReadState {

    /** 复合键："{userId}|{botId}"。 */
    @Id
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String botId;

    @Column(nullable = false)
    private Instant lastReadAt;

    public static String compositeId(String userId, String botId) {
        return userId + "|" + botId;
    }
}
