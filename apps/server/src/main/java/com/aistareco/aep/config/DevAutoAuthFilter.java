package com.aistareco.aep.config;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.AdminUserRepository;
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
 * 若请求在安全链里仍未完成鉴权，则自动使用种子 studio 用户或 admin 用户作为 Principal。
 * 这样即便浏览器里残留了无效 / 过期 JWT，也不会把本地 dev 流程卡成 403。
 * <p>
 * 让前端在开发阶段无需登录就能完成 CRUD 流转验证。
 * ⚠️ 绝不能在生产环境启用。
 */
@Component
@Profile("dev")
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class DevAutoAuthFilter extends OncePerRequestFilter {

    private final AepUserRepository userRepo;
    private final AdminUserRepository adminUserRepo;

    public DevAutoAuthFilter(AepUserRepository userRepo, AdminUserRepository adminUserRepo) {
        this.userRepo = userRepo;
        this.adminUserRepo = adminUserRepo;
    }

    /**
     * 让 dev 自动登录覆盖 async dispatch。
     * Forge v3 的 SSE 会话在重新分发时若没有重新补 principal，会在授权层被打回 403。
     */
    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        boolean alreadyAuthed = SecurityContextHolder.getContext().getAuthentication() != null
                && SecurityContextHolder.getContext().getAuthentication().isAuthenticated();
        if (!alreadyAuthed) {
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
     * - 明确公开的端点排除：/api/auth/**、/api/admin/auth/login、/api/config/**
     * - /api/admin/auth/me 保留自动登录，否则 admin sidebar 拿不到 SUPER_ADMIN 角色，
     *   role-gated 菜单（错误日志 / 后台管理员）会在 dev 真后端模式下消失。
     * - 非 /api 前缀（如 /h2-console）不管
     */
    private static boolean shouldAutoAuth(String path) {
        if (path == null || !path.startsWith("/api/")) return false;
        if (path.startsWith("/api/auth/")) return false;
        if (path.startsWith("/api/admin/auth/login")) return false;
        if (path.startsWith("/api/config/")) return false;
        return true;
    }

    private void seedAuth(String path) {
        String role = path.startsWith("/api/admin/") ? "SUPER_ADMIN" : "USER";
        String userId = path.startsWith("/api/admin/")
                ? pickSeedAdminId()
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

    private String pickSeedAdminId() {
        return adminUserRepo.findAll().stream()
                .filter(u -> u.getRole() == AdminUser.AdminRole.SUPER_ADMIN)
                .findFirst()
                .map(AdminUser::getId)
                .orElseGet(() -> adminUserRepo.findAll().stream()
                        .findFirst()
                        .map(AdminUser::getId)
                        .orElse("dev-admin"));
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
