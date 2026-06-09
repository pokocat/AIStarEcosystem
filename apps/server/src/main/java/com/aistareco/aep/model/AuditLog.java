package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 业务行为审计日志：登录 / 注册 / 关键资源 CRUD 等正常路径的成功 + 失败都落到这张表。
 *
 * <p>与 {@link ErrorLog} 的区别：
 * <ul>
 *   <li>ErrorLog：被全局 @ExceptionHandler 兜底的异常（含 stacktrace）→ 运维定位 bug；</li>
 *   <li>AuditLog：业务侧主动 record 的合规审计 → 谁 / 何时 / 何处 / 做了什么 / 成败。</li>
 * </ul>
 *
 * <p>v0.47：登录注册日志主入口。controller 拿 HttpServletRequest 取 IP/UA →
 * {@code AuditService.recordAuth(...)}。失败时 errorCode 落业务码（如
 * {@code ADMIN_CREDENTIALS_INVALID}）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
        name = "aep_audit_logs",
        indexes = {
                @Index(name = "idx_audit_created", columnList = "createdAt"),
                @Index(name = "idx_audit_action", columnList = "action"),
                @Index(name = "idx_audit_user", columnList = "userId"),
                @Index(name = "idx_audit_username", columnList = "username"),
                @Index(name = "idx_audit_app", columnList = "appCode")
        }
)
public class AuditLog {

    @Id
    private String id;

    @Column(length = 64)
    private String userId;

    /**
     * v0.47：username（admin / aep）/ 手机号 等用户在登录时输入的辨识串。
     * 失败场景下 userId 为空，靠 username 排查重复尝试 / 暴力枚举。
     */
    @Column(length = 128)
    private String username;

    @Column(length = 64)
    private String tenantId;

    @Column(length = 64)
    private String action;

    @Column(length = 64)
    private String resourceType;

    @Column(length = 128)
    private String resourceId;

    /**
     * v0.47：失败时的业务码（如 {@code ADMIN_CREDENTIALS_INVALID} / {@code SMS_CODE_INVALID}）。
     * 成功时为 null。便于 admin 列表按错因聚合统计。
     */
    @Column(length = 64)
    private String errorCode;

    @Column(length = 64)
    private String ipAddress;

    @Column(length = 512)
    private String userAgent;

    /**
     * 来源子应用短码：{@code music} / {@code drama} / {@code celebrity} /
     * {@code aiavatar}（与 {@code PlatformSupport.ALL} 对齐）/ {@code celebrity-mp}（微信小程序）/
     * {@code admin}（后台）。由客户端的 {@code X-App-Code} 请求头携带，
     * {@code AuditService.recordAuth(...)} 统一读取。老数据 / 未带头时为 null。
     */
    @Column(length = 32)
    private String appCode;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private AuditResult result;

    @Column(columnDefinition = "LONGTEXT")
    private String detail;

    private Instant createdAt;

    public enum AuditResult {
        SUCCESS, FAILURE
    }
}
