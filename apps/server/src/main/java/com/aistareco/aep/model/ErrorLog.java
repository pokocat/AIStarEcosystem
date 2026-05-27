package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 错误日志：所有被全局 @ExceptionHandler 兜底的异常（业务 + 系统）都落这张表。
 * 用户报错时报给运维「LogId: xxx」即可在 admin 后台精准追查。
 *
 * 与 {@link AuditLog} 的区别：
 *   - AuditLog 记「正常操作（成功/失败）」用于合规审计（谁/什么时间/做了什么）
 *   - ErrorLog 记「真异常 + 含 stacktrace」用于故障定位（运维/开发用）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
        name = "aep_error_logs",
        indexes = {
                @Index(name = "idx_error_logs_occurred", columnList = "occurredAt"),
                @Index(name = "idx_error_logs_logid", columnList = "logId"),
                @Index(name = "idx_error_logs_trace", columnList = "traceId"),
                @Index(name = "idx_error_logs_user", columnList = "userId"),
                @Index(name = "idx_error_logs_status", columnList = "httpStatus")
        }
)
public class ErrorLog {

    /** 内部主键（UUID）。对外引用一律用 {@link #logId}，更短更易复述。 */
    @Id
    private String id;

    /** 给用户/运维报错时引用的短追查号（nanoid，14 字符），全局唯一。 */
    @Column(nullable = false, unique = true, length = 32)
    private String logId;

    /**
     * 请求级 trace ID（{@link com.aistareco.common.TraceContext}）。一次请求可能产生多条 ErrorLog
     * （retry / partial-fail / 多步操作），但它们的 traceId 都相同。
     * 拿 traceId 去 grep server / sau-service / future workers 的 log 文件即可还原整条链路。
     */
    @Column(length = 64)
    private String traceId;

    @Column(nullable = false)
    private Instant occurredAt;

    /** 发生异常的机器（容器/Pod hostname），多实例部署时区分来源。 */
    @Column(length = 128)
    private String hostname;

    /** 当时已登录用户 id（未登录或 auth filter 之前的错则为 null）。 */
    @Column(length = 64)
    private String userId;

    /** 当时已登录用户名（冗余便于 admin 列表直读，无须再 join）。 */
    @Column(length = 128)
    private String username;

    /** "POST" / "GET" 等。 */
    @Column(length = 16)
    private String httpMethod;

    /** 请求 path（不含 host/query），如 "/api/me/mixcut/jobs/123"。 */
    @Column(length = 512)
    private String endpoint;

    /** 返回给客户端的 HTTP 状态码。 */
    private Integer httpStatus;

    /** 异常类简名，如 "BusinessException" / "NullPointerException"。 */
    @Column(length = 128)
    private String errorType;

    /** 业务错误码（BusinessException 才有），如 "ORDER_NOT_FOUND"。 */
    @Column(length = 64)
    private String errorCode;

    /** 给用户看的错误文案（异常 message）。 */
    @Column(columnDefinition = "LONGTEXT")
    private String message;

    /** 完整堆栈（已截到 8KB 内，避免 OOM）。 */
    @Column(columnDefinition = "LONGTEXT")
    private String stacktrace;

    /** 请求 query string + sanitized body 摘要（JSON 文本）。 */
    @Column(columnDefinition = "LONGTEXT")
    private String requestParams;

    @Column(length = 512)
    private String userAgent;

    @Column(length = 64)
    private String clientIp;
}
