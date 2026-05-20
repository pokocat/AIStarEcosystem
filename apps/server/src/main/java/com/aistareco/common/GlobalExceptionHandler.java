package com.aistareco.common;

import org.apache.catalina.connector.ClientAbortException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String, Object>> handleBusiness(BusinessException ex) {
        return json(ex.getStatus(), ex.getCode(), ex.getMessage());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        String message = ex.getReason() != null ? ex.getReason() : status.getReasonPhrase();
        return json(status, status.name(), message);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthentication(AuthenticationException ex) {
        return json(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "登录状态无效或已过期");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return json(HttpStatus.FORBIDDEN, "FORBIDDEN", "当前账号没有执行该操作的权限");
    }

    /**
     * 静态资源 handler（如 /static/mixcut/** 视频流、/cdn/** 等）未命中文件时抛 NoResourceFoundException。
     * Spring 默认会把 response Content-Type 按文件后缀 sniff 成 video/mp4 之类的；不单独 mapping 会落到
     * handleGeneric 然后试图用 video/mp4 写 JSON Map，二次崩成 HttpMessageNotWritableException。
     * 这里直接 404 + JSON，强制覆盖 Content-Type。
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoResource(NoResourceFoundException ex) {
        return json(HttpStatus.NOT_FOUND, "NOT_FOUND", "请求的资源不存在");
    }

    /**
     * 客户端在 server 还在写 response 时主动断开（关 tab / 视频快进 cancel / 网络中断 / 浏览器 stop）。
     * Tomcat 续写 socket 报 IOException("Connection reset by peer" / "Broken pipe") 包成 ClientAbortException。
     *
     * 这不是 server bug，是预期网络行为，尤其在 /static/mixcut/** 视频流场景下常见。response 已经断了，
     * 写错误体也写不出去；不能让它进 handleGeneric 的 ERROR 日志，否则真 bug 被日志淹没。
     *
     * 仅 DEBUG 记一行供排查；返回 void 让 Spring 知道这个异常已被处理（不要继续向 servlet container 抛）。
     */
    @ExceptionHandler(ClientAbortException.class)
    public void handleClientAbort(ClientAbortException ex) {
        if (log.isDebugEnabled()) {
            log.debug("客户端中止连接（视频快进 / 关 tab / 网络抖动）：{}", ex.getMessage());
        }
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        // 之前这里没日志，500 root cause 完全吞掉；加上方便 dev 复现
        log.error("未处理异常被 GlobalExceptionHandler 兜底", ex);
        return json(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "服务器处理请求失败，请稍后重试");
    }

    /**
     * 显式 setContentType(application/json) 覆盖任何前置 Content-Type（例如静态资源 handler 提前 sniff 的
     * video/mp4）。否则 Spring 找不到 Map → video/mp4 的 HttpMessageConverter 会二次抛
     * HttpMessageNotWritableException。
     */
    private static ResponseEntity<Map<String, Object>> json(HttpStatus status, String code, String message) {
        return ResponseEntity
                .status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("error", new ApiErrorBody(code, message)));
    }
}
