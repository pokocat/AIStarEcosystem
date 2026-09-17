package com.aistareco.aep.impersonation;

import com.aistareco.aep.model.AepUser;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;
import java.util.Map;

/** 只建立目标用户的普通登录态；方法、开通、余额、数据归属继续由现有业务规则判断。 */
@Component
public class ImpersonationFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(ImpersonationFilter.class);
    private final ImpersonationService service;
    private final ObjectMapper mapper;
    public ImpersonationFilter(ImpersonationService service, ObjectMapper mapper) { this.service = service; this.mapper = mapper; }
    @Override protected boolean shouldNotFilterAsyncDispatch() { return false; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (header == null || !header.startsWith("Bearer " + ImpersonationService.TOKEN_PREFIX)
                || "/api/auth/impersonation/exit".equals(path)) { chain.doFilter(request, response); return; }
        ImpersonationService.Acting acting;
        try { acting = service.authenticate(header.substring(7).trim()); }
        catch (BusinessException e) {
            SecurityContextHolder.clearContext();
            response.setStatus(e.getStatus().value()); response.setContentType("application/json;charset=UTF-8");
            response.setHeader("Cache-Control", "no-store");
            mapper.writeValue(response.getWriter(), Map.of("success", false, "error", Map.of("code", e.getCode(), "message", e.getMessage())));
            return;
        }
        AepUser user = acting.user();
        String role = user.getKind() == null ? "PERSONAL" : user.getKind().name();
        var auth = new UsernamePasswordAuthenticationToken(user.getId(), null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        auth.setDetails(Map.of("username", user.getUsername(), "role", role, "impersonation", true, "actorId", acting.actorId()));
        SecurityContextHolder.getContext().setAuthentication(auth);
        response.setHeader("Cache-Control", "no-store");
        try { chain.doFilter(request, response); }
        finally {
            log.info("[impersonation] actor={} source={} target={} method={} path={} status={}",
                    acting.actorId(), acting.actorSource(), user.getId(), request.getMethod(), path, response.getStatus());
        }
    }
    @Configuration
    static class Registration {
        @Bean FilterRegistrationBean<ImpersonationFilter> disableImpersonationServletRegistration(ImpersonationFilter filter) {
            var bean = new FilterRegistrationBean<>(filter); bean.setEnabled(false); return bean;
        }
    }
}
