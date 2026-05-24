package com.aistareco.aep.dto;

import com.aistareco.aep.model.ErrorLog;

import java.time.Instant;

/**
 * 错误日志 DTO（admin 后台用）。字段名与前端 TS 类型 1:1 对齐（camelCase）。
 *
 * 注意 stacktrace / requestParams / message 三个长字段：列表接口正常返回；详情接口同源 DTO，无需额外页面。
 * 量大时如果 admin 列表卡顿，再单独出 ErrorLogSummaryDto（不带 stacktrace）。当前 v0.30 一份就够。
 */
public record ErrorLogDto(
        String id,
        String logId,
        /** 请求级 trace ID（{@code TraceContext}），用于跨日志文件 grep。 */
        String traceId,
        Instant occurredAt,
        String hostname,
        String userId,
        String username,
        String httpMethod,
        String endpoint,
        Integer httpStatus,
        String errorType,
        String errorCode,
        String message,
        String stacktrace,
        String requestParams,
        String userAgent,
        String clientIp
) {
    public static ErrorLogDto from(ErrorLog e) {
        return new ErrorLogDto(
                e.getId(),
                e.getLogId(),
                e.getTraceId(),
                e.getOccurredAt(),
                e.getHostname(),
                e.getUserId(),
                e.getUsername(),
                e.getHttpMethod(),
                e.getEndpoint(),
                e.getHttpStatus(),
                e.getErrorType(),
                e.getErrorCode(),
                e.getMessage(),
                e.getStacktrace(),
                e.getRequestParams(),
                e.getUserAgent(),
                e.getClientIp()
        );
    }
}
