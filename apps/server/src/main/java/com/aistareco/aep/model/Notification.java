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

    @Column(columnDefinition = "LONGTEXT")
    private String description;

    /**
     * v0.5.1：关联的 AI Bot 同事 id（pian/shen/shu/ada/zhang），未关联时为 null。
     * 用于消息首页按 botId 聚合"未读数"和"最新预览"。
     */
    @Column(name = "bot_id")
    private String botId;

    /**
     * v0.34.x：viewedAt 替代旧 boolean read 字段。
     *
     *   viewedAt IS NULL    → 未读
     *   viewedAt IS NOT NULL → 已读 + 何时被读（事件模型替代贫血 boolean）
     *
     * 设计：
     *   1) 列名 viewed_at 避开 MySQL 保留字 read（旧版本撞 DDL 语法错误）
     *   2) Instant 而非 boolean 自带审计 + 排序能力，标读不可逆事件语义清晰
     *   3) nullable 兼容老数据迁移期 + 表达「未读」无需 NOT NULL + 默认值
     *
     * 模型迁移见 db/migration/V2__notification_use_viewed_at_instead_of_read.sql
     */
    @Column(name = "viewed_at")
    private Instant viewedAt;

    private Instant createdAt;

    public enum NotificationType {
        REVENUE, FAN, CONTENT, SYSTEM, ACHIEVEMENT
    }
}
