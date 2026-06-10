package com.aistareco.aep.service;

import com.aistareco.aep.dto.AuditLogDto;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    /** v0.47：账号体系登录注册类动作的中央常量表 —— 用于 controller / admin UI 过滤。 */
    public static final class Actions {
        public static final String ADMIN_LOGIN = "admin.login";
        public static final String OPERATOR_LOGIN = "admin.operator_login";
        public static final String ADMIN_CHANGE_PASSWORD = "admin.change_password";
        public static final String SMS_REQUEST_CODE = "auth.sms.request_code";
        public static final String SMS_LOGIN = "auth.sms.login";
        public static final String SMS_REGISTER = "auth.sms.register";
        public static final String PASSWORD_LOGIN = "auth.password.login";
        public static final String DEV_LOGIN = "auth.dev_login";
        public static final String LICENSE_ACTIVATE = "auth.license.activate";

        /** 所有「登录注册」类动作 —— admin /platform/auth-logs 页默认筛选项。 */
        public static final List<String> AUTH_ALL = List.of(
                ADMIN_LOGIN, OPERATOR_LOGIN, ADMIN_CHANGE_PASSWORD,
                SMS_REQUEST_CODE, SMS_LOGIN, SMS_REGISTER,
                PASSWORD_LOGIN, DEV_LOGIN, LICENSE_ACTIVATE
        );

        private Actions() {}
    }

    private final AuditLogRepository auditRepo;

    public AuditService(AuditLogRepository auditRepo) {
        this.auditRepo = auditRepo;
    }

    public Page<AuditLogDto> list(String userId, String action, AuditLog.AuditResult result, Pageable pageable) {
        Page<AuditLog> page;
        if (userId != null && action != null && result != null) {
            page = auditRepo.findByUserIdAndActionAndResult(userId, action, result, pageable);
        } else if (userId != null && action != null) {
            page = auditRepo.findByUserIdAndAction(userId, action, pageable);
        } else if (userId != null && result != null) {
            page = auditRepo.findByUserIdAndResult(userId, result, pageable);
        } else if (action != null && result != null) {
            page = auditRepo.findByActionAndResult(action, result, pageable);
        } else if (userId != null) {
            page = auditRepo.findByUserId(userId, pageable);
        } else if (action != null) {
            page = auditRepo.findByAction(action, pageable);
        } else if (result != null) {
            page = auditRepo.findByResult(result, pageable);
        } else {
            page = auditRepo.findAll(pageable);
        }
        return page.map(AuditLogDto::from);
    }

    /**
     * v0.47：多维度过滤入口（用于 admin /platform/auth-logs 列表）。
     * 任一参数为 null 即该维度不过滤。
     */
    public Page<AuditLogDto> search(List<String> actions, String userId, String username,
                                    String ipAddress, String appCode, AuditLog.AuditResult result,
                                    String errorCode, Instant since, Instant until, Pageable pageable) {
        List<String> safeActions = (actions == null || actions.isEmpty()) ? null : actions;
        return auditRepo.search(safeActions,
                blankToNull(userId), blankToNull(username), blankToNull(ipAddress),
                blankToNull(appCode), result, blankToNull(errorCode), since, until, pageable)
                .map(AuditLogDto::from);
    }

    public AuditLog record(String userId, String tenantId, String action,
                            String resourceType, String resourceId,
                            String ipAddress, String userAgent,
                            AuditLog.AuditResult result, String detail) {
        AuditLog log = AuditLog.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .username(truncate(firstNonBlank(currentUsername(), userId), 128))
                .tenantId(tenantId)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .result(result)
                .detail(detail)
                .createdAt(Instant.now())
                .build();
        return auditRepo.save(log);
    }

    /**
     * v0.47：登录 / 注册类审计专用入口。
     * <ul>
     *   <li>从 {@link HttpServletRequest} 自动抽 IP（含 X-Forwarded-For 兼容）/ UA；</li>
     *   <li>{@code username} 哪怕 userId 解析失败也要落，便于排查暴力枚举；</li>
     *   <li>失败场景 {@code errorCode} 落业务码，便于聚合统计；</li>
     *   <li>**永不抛**：写库失败 ERROR 日志后吞掉，不影响业务返回。</li>
     * </ul>
     */
    public void recordAuth(String action, AuditLog.AuditResult result,
                           String userId, String username,
                           String errorCode, String detail,
                           HttpServletRequest request) {
        try {
            AuditLog entry = AuditLog.builder()
                    .id(UUID.randomUUID().toString())
                    .userId(blankToNull(userId))
                    .username(truncate(blankToNull(username), 128))
                    .tenantId(null)
                    .action(action)
                    .resourceType("auth")
                    .resourceId(null)
                    .errorCode(truncate(blankToNull(errorCode), 64))
                    .ipAddress(clientIp(request))
                    .userAgent(request == null ? null : truncate(request.getHeader("User-Agent"), 512))
                    .appCode(appCode(request))
                    .result(result)
                    .detail(truncate(detail, 4000))
                    .createdAt(Instant.now())
                    .build();
            auditRepo.save(entry);
        } catch (Exception persistEx) {
            // 永不抛：登录失败的 401/403 真错才是用户要看到的，记日志失败不该把它二次覆盖
            log.error("写 AuditLog 自身失败 action={} username={} → 忽略", action, username, persistEx);
        }
    }

    /** 便捷成功记录。 */
    public void recordAuthSuccess(String action, String userId, String username,
                                  String detail, HttpServletRequest request) {
        recordAuth(action, AuditLog.AuditResult.SUCCESS, userId, username, null, detail, request);
    }

    /** 便捷失败记录。 */
    public void recordAuthFailure(String action, String username, String errorCode,
                                  String detail, HttpServletRequest request) {
        recordAuth(action, AuditLog.AuditResult.FAILURE, null, username, errorCode, detail, request);
    }

    /**
     * 来源子应用短码：读 {@code X-App-Code} 请求头。审计场景按「清洗后原样存」
     * （trim + 小写 + 截断 32），不做白名单硬校验 —— 宁可留下未知来源也不静默丢数据。
     */
    public static String appCode(HttpServletRequest req) {
        if (req == null) return null;
        String raw = req.getHeader("X-App-Code");
        if (raw == null || raw.isBlank()) return null;
        return truncate(raw.trim().toLowerCase(java.util.Locale.ROOT), 32);
    }

    /** v0.47：与 ErrorLogService 同款 IP 抽取，处理反代场景。 */
    public static String clientIp(HttpServletRequest req) {
        if (req == null) return null;
        String xf = req.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            int comma = xf.indexOf(',');
            return truncate(comma > 0 ? xf.substring(0, comma).trim() : xf.trim(), 64);
        }
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) {
            return truncate(real.trim(), 64);
        }
        return truncate(req.getRemoteAddr(), 64);
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String firstNonBlank(String first, String second) {
        String normalized = blankToNull(first);
        return normalized != null ? normalized : blankToNull(second);
    }

    private static String currentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Object details = auth.getDetails();
        if (details instanceof Map<?, ?> m && m.get("username") instanceof String s) {
            return s;
        }
        return null;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        if (s.length() <= max) return s;
        return s.substring(0, max);
    }
}
