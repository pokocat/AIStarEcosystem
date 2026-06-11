package com.aistareco.aep.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Security 链上的 403 出口（已登录但角色不够，如非管理员访问 /api/admin/**）。
 * 失败壳与 traceId 约定见 {@link SecurityJsonEntryPoint}。
 */
@Component
public class SecurityJsonAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper mapper;

    public SecurityJsonAccessDeniedHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        SecurityJsonEntryPoint.write(mapper, response, HttpServletResponse.SC_FORBIDDEN,
                "FORBIDDEN", "当前账号没有执行该操作的权限");
    }
}
