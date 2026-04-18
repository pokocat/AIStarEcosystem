package com.aistareco.aep.config;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * 仅在 dev profile 生效的自动登录 filter。
 * <p>
 * 若请求未带 Authorization header 且访问 /api/me/* 或 /api/admin/*（POST/PUT/PATCH/DELETE），
 * 自动使用种子 studio 用户或 admin 用户作为 Principal。
 * <p>
 * 让前端在开发阶段无需登录就能完成 CRUD 流转验证。
 * ⚠️ 绝不能在生产环境启用。
 */
@Component
@Profile("dev")
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class DevAutoAuthFilter extends OncePerRequestFilter {

    private final AepUserRepository userRepo;

    public DevAutoAuthFilter(AepUserRepository userRepo) {
        this.userRepo = userRepo;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        boolean alreadyAuthed = SecurityContextHolder.getContext().getAuthentication() != null
                && SecurityContextHolder.getContext().getAuthentication().isAuthenticated();
        String authHeader = request.getHeader("Authorization");

        if (!alreadyAuthed && (authHeader == null || !authHeader.startsWith("Bearer "))) {
            String path = request.getRequestURI();
            if (shouldAutoAuth(path)) {
                seedAuth(path);
            }
        }
        chain.doFilter(request, response);
    }

    /**
     * 哪些路径需要在 dev 环境下"自动登录"：
     * - 默认是所有 /api/* 接口（因为绝大多数 controller 会注入 Principal）
     * - 明确公开的端点排除：/api/auth/**、/api/admin/auth/**、/api/config/**
     * - 非 /api 前缀（如 /h2-console）不管
     */
    private static boolean shouldAutoAuth(String path) {
        if (path == null || !path.startsWith("/api/")) return false;
        if (path.startsWith("/api/auth/")) return false;
        if (path.startsWith("/api/admin/auth/")) return false;
        if (path.startsWith("/api/config/")) return false;
        return true;
    }

    private void seedAuth(String path) {
        String role = path.startsWith("/api/admin/") ? "SUPER_ADMIN" : "USER";
        String userId = path.startsWith("/api/admin/")
                ? "dev-admin"
                : pickSeedUserId();

        var auth = new UsernamePasswordAuthenticationToken(
                userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private String pickSeedUserId() {
        // 选一个 STUDIO 种子账号；拿不到就退化为第一个用户。
        return userRepo.findAll().stream()
                .filter(u -> u.getKind() == AepUser.AccountKind.STUDIO)
                .findFirst()
                .map(AepUser::getId)
                .orElseGet(() -> userRepo.findAll().stream()
                        .findFirst()
                        .map(AepUser::getId)
                        .orElse("dev-anonymous"));
    }

    /**
     * 阻止 Spring Boot 把本 filter 作为普通 servlet filter 自动注册。
     * 它只应该在 Spring Security chain 内部（via {@code addFilterAfter(...)}）生效，
     * 否则会被 SecurityContextHolderFilter 清掉上下文，导致 {@code /api/me/**} 401/403。
     */
    @Configuration
    @Profile("dev")
    public static class Registration {
        @Bean
        public FilterRegistrationBean<DevAutoAuthFilter> devAutoAuthFilterRegistration(DevAutoAuthFilter filter) {
            FilterRegistrationBean<DevAutoAuthFilter> reg = new FilterRegistrationBean<>(filter);
            reg.setEnabled(false);
            return reg;
        }
    }
}
