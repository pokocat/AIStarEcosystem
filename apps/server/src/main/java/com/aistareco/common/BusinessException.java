package com.aistareco.common;

import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final Object details;
    /**
     * 仅服务端排障用的技术细节（如上游响应体、HTTP 状态、端点名）。
     * ErrorLogService 会把它落进 ErrorLog（按「追查号」可查），但 GlobalExceptionHandler
     * **绝不**把它返回给客户端 —— 给用户的 message 必须是脱敏后的友好文案。
     */
    private final String internalDetail;

    public BusinessException(HttpStatus status, String code, String message) {
        this(status, code, message, null, null);
    }

    public BusinessException(HttpStatus status, String code, String message, Object details) {
        this(status, code, message, details, null);
    }

    public BusinessException(HttpStatus status, String code, String message, Object details, String internalDetail) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.internalDetail = internalDetail;
    }

    public HttpStatus getStatus()    { return status; }
    public String getCode()          { return code; }
    public Object getDetails()       { return details; }
    public String getInternalDetail() { return internalDetail; }

    /** 友好文案 + 仅服务端可见的技术细节（不出 wire）。用于 AI / 外部依赖调用失败场景。 */
    public static BusinessException wrapped(HttpStatus status, String code, String friendlyMessage, String internalDetail) {
        return new BusinessException(status, code, friendlyMessage, null, internalDetail);
    }

    public static BusinessException notFound(String code, String message) {
        return new BusinessException(HttpStatus.NOT_FOUND, code, message);
    }

    public static BusinessException badRequest(String code, String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, code, message);
    }
}
