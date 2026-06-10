package com.aistareco.aep.config;

import com.aistareco.common.TraceContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Security 链上的 401 出口（未登录 / token 失效访问受限资源）。
 *
 * <p>Spring Security 的 {@link AuthenticationException} 在 filter chain 内抛出，
 * 不经过 {@code GlobalExceptionHandler}（那只覆盖进了 controller 之后的异常）——
 * 不自定义 entry point 时默认空 body，前端 {@code apiFetch} 只能报 PARSE_ERROR。
 * 这里输出与 GlobalExceptionHandler 相同的失败壳 {@code {error:{code,message,traceId}}}，
 * traceId 取自 {@link TraceContext}（TraceFilter 在链最前面已注入 MDC + 响应头），
 * 用户复述给运维即可按 traceId 串起该请求的全部日志行。
 */
@Component
public class SecurityJsonEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper mapper;

    public SecurityJsonEntryPoint(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        write(mapper, response, HttpServletResponse.SC_UNAUTHORIZED,
                "UNAUTHORIZED", "登录状态无效或已过期");
    }

    /** 401/403 共用的失败壳 writer（{@link SecurityJsonAccessDeniedHandler} 复用）。 */
    static void write(ObjectMapper mapper, HttpServletResponse response,
                      int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("message", message);
        String traceId = MDC.get(TraceContext.MDC_KEY);
        if (traceId != null && !traceId.isBlank()) {
            error.put("traceId", traceId);
        }
        response.getWriter().write(mapper.writeValueAsString(Map.of("error", error)));
    }
}
