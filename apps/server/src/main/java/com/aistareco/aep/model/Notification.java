package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_notifications")
public class Notification {

    @Id
    private String id;

    @Column(nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    /**
     * v0.5.1：关联的 AI Bot 同事 id（pian/shen/shu/ada/zhang），未关联时为 null。
     * 用于消息首页按 botId 聚合"未读数"和"最新预览"。
     */
    @Column(name = "bot_id")
    private String botId;

    @Builder.Default
    private boolean read = false;

    private Instant createdAt;

    public enum NotificationType {
        REVENUE, FAN, CONTENT, SYSTEM, ACHIEVEMENT
    }
}
