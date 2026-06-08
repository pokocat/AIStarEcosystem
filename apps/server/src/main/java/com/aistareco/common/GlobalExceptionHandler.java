package com.aistareco.common;

import com.aistareco.aep.service.ErrorLogService;
import com.aistareco.aep.service.mixcut.MissingAssetsException;
import jakarta.servlet.http.HttpServletRequest;
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

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final ErrorLogService errorLogService;

    public GlobalExceptionHandler(ErrorLogService errorLogService) {
        this.errorLogService = errorLogService;
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String, Object>> handleBusiness(BusinessException ex, HttpServletRequest request) {
        String logId = errorLogService.record(ex, ex.getCode(), ex.getStatus().value(), request);
        return json(ex.getStatus(), ex.getCode(), appendLogId(ex.getMessage(), logId), ex.getDetails());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        String message = ex.getReason() != null ? ex.getReason() : status.getReasonPhrase();
        // 只记 5xx 与「业务级 4xx」(400/409/422)；401/403/404 一般是预期场景，记了反成噪音
        String logId = shouldRecordStatus(status)
                ? errorLogService.record(ex, status.name(), status.value(), request)
                : null;
        return json(status, status.name(), appendLogId(message, logId));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthentication(AuthenticationException ex) {
        // 预期场景：登录态过期 / 未登录访问受限资源。不入 ErrorLog（量大、无追查价值）。
        return json(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "登录状态无效或已过期");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        // 预期场景：权限不够。不入 ErrorLog。
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
        // 404 静态资源不入 ErrorLog（爬虫/老链接量极大且无价值）。
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

    /**
     * v0.30+: 「重跑」混剪任务时检测到原 binding 引用的 MixcutAsset 已被硬删。
     * 返回 409 + error.details.missing_assets[] —— 前端 RerunJobDialog 据此切错误态、
     * 列出缺失 slot/asset、给「去素材库重传 / 用模板从头做」两个出口。
     * 入 ErrorLog（is business 4xx 与 conflict 范畴）—— 重跑被阻挡是用户主动行为，但
     * 反复出现可暴露"用户删除频繁但渲染滞留"的产品问题。
     */
    @ExceptionHandler(MissingAssetsException.class)
    public ResponseEntity<Map<String, Object>> handleMissingAssets(MissingAssetsException ex, HttpServletRequest request) {
        String logId = errorLogService.record(ex, "MISSING_ASSETS", 409, request);
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("error", Map.of(
                        "code", "MISSING_ASSETS",
                        "message", appendLogId(ex.getMessage(), logId),
                        "details", Map.of("missing_assets", ex.getMissingAssets())
                )));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex, HttpServletRequest request) {
        // 这是真正的未处理异常 = 系统 bug，必落 ErrorLog
        log.error("未处理异常被 GlobalExceptionHandler 兜底", ex);
        String logId = errorLogService.record(ex, "INTERNAL_ERROR", 500, request);
        return json(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                appendLogId("服务器处理请求失败，请稍后重试", logId));
    }

    /**
     * 只记入会反映「真问题」的 4xx：业务参数错（400）、业务冲突（409）、参数语义错（422）。
     * 401/403/404 是预期场景，不入库。
     */
    private static boolean shouldRecordStatus(HttpStatus status) {
        if (status.is5xxServerError()) return true;
        return status == HttpStatus.BAD_REQUEST
                || status == HttpStatus.CONFLICT
                || status == HttpStatus.UNPROCESSABLE_ENTITY;
    }

    /**
     * 把 logId 拼到客户端可见的 message 末尾。用户报错时把这串复述给运维即可秒查。
     * logId 为 null（写库失败）时 message 不变，不污染响应。
     */
    private static String appendLogId(String message, String logId) {
        if (logId == null) return message;
        if (message == null || message.isBlank()) return "出错了 · 追查号 " + logId;
        return message + " · 追查号 " + logId;
    }

    /**
     * 显式 setContentType(application/json) 覆盖任何前置 Content-Type（例如静态资源 handler 提前 sniff 的
     * video/mp4）。否则 Spring 找不到 Map → video/mp4 的 HttpMessageConverter 会二次抛
     * HttpMessageNotWritableException。
     */
    private static ResponseEntity<Map<String, Object>> json(HttpStatus status, String code, String message) {
        return json(status, code, message, null);
    }

    private static ResponseEntity<Map<String, Object>> json(HttpStatus status, String code, String message, Object details) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("message", message);
        if (details != null) {
            error.put("details", details);
        }
        return ResponseEntity
                .status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("error", error));
    }
}
