package com.aistareco.aep.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * /api/internal/** 走共享密钥（X-Internal-Secret header）。
 * 校验通过即注入 ROLE_INTERNAL principal，路由层就能拿到 Authentication。
 *
 * dev：default secret 写在 application.yml；prod 必须 env 注入。
 */
@Component
public class InternalAuthFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Internal-Secret";

    private final String expectedSecret;

    public InternalAuthFilter(@Value("${aep.internal.secret}") String expectedSecret) {
        this.expectedSecret = expectedSecret;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse resp, FilterChain chain)
            throws ServletException, IOException {
        String got = req.getHeader(HEADER);
        if (got == null || !got.equals(expectedSecret)) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.setContentType("application/json;charset=utf-8");
            resp.getWriter().write("{\"success\":false,\"error\":{\"code\":\"INTERNAL_AUTH\",\"message\":\"内部接口鉴权失败\"}}");
            return;
        }
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "internal", null,
                List.of(new SimpleGrantedAuthority("ROLE_INTERNAL")));
        SecurityContextHolder.getContext().setAuthentication(auth);
        chain.doFilter(req, resp);
    }
}
