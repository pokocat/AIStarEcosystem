package com.aistareco.aep.security;

import com.aistareco.aep.repository.AdminUserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.security.Principal;

/**
 * v0.37+：账号来源识别 helper。
 *
 * 两套账号体系登录后都拿到 admin 后台的 JWT（role=SUPER_ADMIN / OPERATOR），但用户希望某些
 * 敏感菜单（秘钥批次 / 管理员 CRUD）**只对 admin_users 体系开放**，aep_users.operatorRole
 * 通道（v0.37 operator-login）不可见也不可调。
 *
 * 实现：principal.getName() 是 JWT subject (= user id)，按 id 在 admin_users 表里查一次。
 * 在则视为 ADMIN 来源；否则 OPERATOR（即 aep_users.operatorRole）来源。
 *
 * 用法：
 * <pre>
 *   {@code @PreAuthorize("@accountSourceResolver.isAdmin(authentication)")}
 *   public ApiResponse<...> sensitive() { ... }
 * </pre>
 */
@Component("accountSourceResolver")
public class AccountSourceResolver {

    public enum Source { ADMIN, OPERATOR, UNKNOWN }

    private final AdminUserRepository adminRepo;

    public AccountSourceResolver(AdminUserRepository adminRepo) {
        this.adminRepo = adminRepo;
    }

    public Source resolve(String userId) {
        if (userId == null || userId.isBlank()) return Source.UNKNOWN;
        return adminRepo.existsById(userId) ? Source.ADMIN : Source.OPERATOR;
    }

    public Source resolve(Principal principal) {
        if (principal == null) return Source.UNKNOWN;
        return resolve(principal.getName());
    }

    /** Spring Security SpEL @PreAuthorize 入口。 */
    public boolean isAdmin(Authentication authentication) {
        if (authentication == null) return false;
        return resolve(authentication.getName()) == Source.ADMIN;
    }
}
