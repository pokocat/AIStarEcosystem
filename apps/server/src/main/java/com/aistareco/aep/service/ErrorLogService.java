package com.aistareco.aep.service;

import com.aistareco.aep.model.ErrorLog;
import com.aistareco.aep.repository.ErrorLogRepository;
import com.aistareco.common.TraceContext;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * 写错误日志的唯一入口。
 *
 * 设计要点：
 *   - record(...) 必须**永不抛**：自身写库失败时只 ERROR 一行 log 后吞掉，
 *     绝不能让本应返回给用户的真错误响应被「记错误日志失败」二次覆盖。
 *   - hostname 启动时一次解析、缓存为字段，避免每次写入都查 DNS。
 *   - stacktrace 截到 8KB，防止某些「自我堆叠」异常（如 ClassNotFoundException）写爆 DB。
 *   - requestParams 用 sanitizeQuery 脱敏关键字（password / token / secret / authorization / otp / code）。
 *     body 不读 —— InputStream 已被业务 controller 消费过，再读是空的；再者就算能读也不安全。
 */
@Service
public class ErrorLogService {

    private static final Logger log = LoggerFactory.getLogger(ErrorLogService.class);

    /** 启动时解析一次。容器环境 hostname = pod name，符合「记录发生机器」诉求。 */
    private static final String HOSTNAME = resolveHostname();

    /** 短追查号字符集：避开易混淆字符（0/O、1/I/l）。 */
    private static final char[] LOG_ID_ALPHABET =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int LOG_ID_LEN = 12;

    /** stacktrace 截断阈值：DB TEXT 列 hold 8KB 妥妥够，多了反而吓人。 */
    private static final int STACKTRACE_CAP = 8 * 1024;

    private final ErrorLogRepository repo;
    private final SecureRandom random = new SecureRandom();

    public ErrorLogService(ErrorLogRepository repo) {
        this.repo = repo;
    }

    /**
     * 记录一次异常。永不抛；返回生成的 logId（写库失败时返回 null）。
     *
     * @param ex          异常本体
     * @param errorCode   业务码（非 BusinessException 传 null）
     * @param httpStatus  最终返回给客户端的 HTTP 状态码
     * @param request     当前 HTTP 请求（拿 endpoint / method / UA / IP / query 用）
     * @return 写库成功的 logId；失败为 null
     */
    public String record(Throwable ex,
                         String errorCode,
                         int httpStatus,
                         HttpServletRequest request) {
        try {
            String logId = generateLogId();
            ErrorLog entry = ErrorLog.builder()
                    .id(UUID.randomUUID().toString())
                    .logId(logId)
                    .traceId(TraceContext.current())
                    .occurredAt(Instant.now())
                    .hostname(HOSTNAME)
                    .userId(currentUserId())
                    .username(currentUsername())
                    .httpMethod(request == null ? null : request.getMethod())
                    .endpoint(request == null ? null : request.getRequestURI())
                    .httpStatus(httpStatus)
                    .errorType(ex.getClass().getSimpleName())
                    .errorCode(errorCode)
                    .message(truncate(ex.getMessage(), 4096))
                    .stacktrace(stackTrace(ex))
                    .requestParams(request == null ? null : sanitizeQuery(request.getQueryString()))
                    .userAgent(request == null ? null : truncate(request.getHeader("User-Agent"), 512))
                    .clientIp(request == null ? null : clientIp(request))
                    .build();
            repo.save(entry);
            return logId;
        } catch (Exception persistEx) {
            // 永不抛：写库失败只本地 log，吞掉
            log.error("写 ErrorLog 自身失败（原异常 {} 仍会按 GlobalExceptionHandler 处理）",
                    ex.getClass().getSimpleName(), persistEx);
            return null;
        }
    }

    private String generateLogId() {
        char[] buf = new char[LOG_ID_LEN];
        for (int i = 0; i < LOG_ID_LEN; i++) {
            buf[i] = LOG_ID_ALPHABET[random.nextInt(LOG_ID_ALPHABET.length)];
        }
        return new String(buf);
    }

    private static String resolveHostname() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException e) {
            return "unknown";
        }
    }

    private static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Object principal = auth.getPrincipal();
        if (principal == null || "anonymousUser".equals(principal)) return null;
        return auth.getName();
    }

    private static String currentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        Object details = auth.getDetails();
        if (details instanceof Map<?, ?> m && m.get("username") instanceof String s) {
            return s;
        }
        return null;
    }

    private static String stackTrace(Throwable ex) {
        StringWriter sw = new StringWriter();
        ex.printStackTrace(new PrintWriter(sw));
        return truncate(sw.toString(), STACKTRACE_CAP);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        if (s.length() <= max) return s;
        return s.substring(0, max) + "\n…[truncated " + (s.length() - max) + " chars]";
    }

    /**
     * 脱敏 query string：把 key 命中黑名单的 value 替成 "***"。
     * 黑名单：password / token / secret / authorization / apikey / otp / code（大小写不敏感）。
     * 不做完整 URL decode，只按 & 拆 key=value，足够安全也足够便宜。
     */
    static String sanitizeQuery(String query) {
        if (query == null || query.isEmpty()) return null;
        String[] pairs = query.split("&");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < pairs.length; i++) {
            if (i > 0) sb.append('&');
            String pair = pairs[i];
            int eq = pair.indexOf('=');
            if (eq <= 0) { sb.append(pair); continue; }
            String key = pair.substring(0, eq);
            String lower = key.toLowerCase();
            if (lower.contains("password") || lower.contains("token") || lower.contains("secret")
                    || lower.contains("authorization") || lower.contains("apikey") || lower.equals("otp")
                    || lower.equals("code")) {
                sb.append(key).append("=***");
            } else {
                sb.append(pair);
            }
        }
        return truncate(sb.toString(), 2048);
    }

    private static String clientIp(HttpServletRequest req) {
        String xf = req.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            int comma = xf.indexOf(',');
            return truncate(comma > 0 ? xf.substring(0, comma).trim() : xf.trim(), 64);
        }
        return truncate(req.getRemoteAddr(), 64);
    }
}
