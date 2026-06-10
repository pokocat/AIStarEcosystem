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

    /**
     * v0.58：运营收件箱的保留收件人。userId = 该常量的行只进 admin 消息中心
     * （AdminNotificationController），不会出现在任何真实用户的 /api/notifications 列表里。
     * 真实业务事件（充值下单 / 取消等）由 {@link com.aistareco.aep.service.NotificationPublisher}
     * 写入。
     */
    public static final String ADMIN_INBOX_USER_ID = "__admin__";

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

    /**
     * v0.58：推送对象（admin 消息中心「每条消息标注推送对象」）。
     * scope: all | studio | artist | account；targetId/targetName 指向触发事件的主体
     * （如充值下单的个人账号）。老数据三列为 null，DTO 出 wire 时回退 scope=all。
     */
    @Column(name = "audience_scope", length = 16)
    private String audienceScope;

    @Column(name = "audience_target_id", length = 64)
    private String audienceTargetId;

    @Column(name = "audience_target_name", length = 128)
    private String audienceTargetName;

    private Instant createdAt;

    public enum NotificationType {
        REVENUE, FAN, CONTENT, SYSTEM, ACHIEVEMENT
    }
}
