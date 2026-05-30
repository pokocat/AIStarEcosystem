package com.aistareco.aep.config;

import com.aistareco.common.TraceContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;

/**
 * 请求级操作日志。
 *
 * 只记录操作元数据（method/path/status/user/ip/duration），不记录 query/body，避免把验证码、
 * token、API key、prompt 等敏感内容打进日志。
 */
@Component
public class ApiOperationLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiOperationLogFilter.class);
    private static final long SLOW_GET_THRESHOLD_MS = 1_000L;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        long startNanos = System.nanoTime();
        Throwable failure = null;
        try {
            chain.doFilter(request, response);
        } catch (ServletException | IOException | RuntimeException | Error t) {
            failure = t;
            throw t;
        } finally {
            long durationMs = (System.nanoTime() - startNanos) / 1_000_000L;
            if (shouldLog(request, durationMs, failure)) {
                int status = failure != null && response.getStatus() < 400 ? 500 : response.getStatus();
                logOperation(request, status, durationMs, failure);
            }
        }
    }

    private static boolean shouldLog(HttpServletRequest request, long durationMs, Throwable failure) {
        String path = request.getRequestURI();
        if (path == null || !path.startsWith("/api/")) return false;
        String method = request.getMethod();
        if ("OPTIONS".equalsIgnoreCase(method)) return false;
        if (failure != null) return true;
        if (!"GET".equalsIgnoreCase(method)) return true;
        return durationMs >= SLOW_GET_THRESHOLD_MS || isAlwaysInterestingGet(path);
    }

    private static boolean isAlwaysInterestingGet(String path) {
        return path.startsWith("/api/internal/")
                || path.startsWith("/api/appearance-forge/")
                || path.contains("/jobs/")
                || path.contains("/bind-poll");
    }

    private static void logOperation(HttpServletRequest request, int status, long durationMs, Throwable failure) {
        String method = request.getMethod();
        String path = request.getRequestURI();
        String user = currentUserId();
        String ip = clientIp(request);
        String traceId = TraceContext.current();
        if (failure != null || status >= 400) {
            log.warn("[api-op] method={} path={} status={} user={} ip={} durationMs={} traceId={} err={}",
                    method, path, status, user, ip, durationMs, traceId,
                    failure == null ? null : failure.getClass().getSimpleName());
        } else {
            log.info("[api-op] method={} path={} status={} user={} ip={} durationMs={} traceId={}",
                    method, path, status, user, ip, durationMs, traceId);
        }
    }

    private static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Object principal = auth.getPrincipal();
        if (principal == null || "anonymousUser".equals(principal)) return null;
        return auth.getName();
    }

    private static String clientIp(HttpServletRequest req) {
        String xf = req.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            int comma = xf.indexOf(',');
            return sanitizeIp(comma > 0 ? xf.substring(0, comma).trim() : xf.trim());
        }
        return sanitizeIp(req.getRemoteAddr());
    }

    private static String sanitizeIp(String ip) {
        if (ip == null) return null;
        String s = ip.trim().toLowerCase(Locale.ROOT);
        return s.length() > 64 ? s.substring(0, 64) : s;
    }

    @Configuration
    static class FilterRegistration {
        @Bean
        FilterRegistrationBean<ApiOperationLogFilter> disableAutoRegistrationOfApiOperationLogFilter(
                ApiOperationLogFilter filter) {
            FilterRegistrationBean<ApiOperationLogFilter> reg = new FilterRegistrationBean<>(filter);
            reg.setEnabled(false);
            reg.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
            return reg;
        }
    }
}
