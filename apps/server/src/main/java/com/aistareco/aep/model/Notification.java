package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

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

    /**
     * 注意：列名 `read` 是 MySQL 8 / MariaDB 保留字，必须用反引号转义，否则
     * Hibernate ddl-auto=update 生成 DDL 时会撞「SQL syntax error near 'read bit'」。
     * H2 dev profile（MODE=MySQL 兼容）也接受反引号。Java 字段名 read 不动以保持
     * 与 Notification.isRead() / setRead(...) 一致 + 兼容现有 DTO/Service。
     */
    @Builder.Default
    @Column(name = "`read`", nullable = false)
    @ColumnDefault("false")
    private boolean read = false;

    private Instant createdAt;

    public enum NotificationType {
        REVENUE, FAN, CONTENT, SYSTEM, ACHIEVEMENT
    }
}
