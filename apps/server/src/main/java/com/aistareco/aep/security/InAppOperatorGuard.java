package com.aistareco.aep.security;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * 子产品内「in-app 运营动作」的权限判定（短剧配方审核、短剧目录维护…）。
 *
 * <p>v0.149（{@code docs/unified-identity-plan.md} §12.1）起，消费者令牌不再携带
 * {@code operatorRole} —— 后台角色只走 {@code typ=admin} 令牌。所以这类**长在用户端里**的
 * 运营入口不能再读 JWT 权限，必须回到 {@link AepUser#getOperatorRole()} 这个真值上判断：
 * 同一个人用普通账号登录 web-drama，照样能审配方，但依然进不了 {@code /api/admin/**}。
 *
 * <p>后台令牌（{@code typ=admin}，带 {@code ROLE_OPERATOR} / {@code ROLE_SUPER_ADMIN}）
 * 也直接放行 —— 运营从 admin 后台调过来是合法路径。
 */
@Component
public class InAppOperatorGuard {

    private static final Set<String> ADMIN_AUTHORITIES = Set.of("ROLE_OPERATOR", "ROLE_SUPER_ADMIN");

    private final AepUserRepository userRepo;

    public InAppOperatorGuard(AepUserRepository userRepo) {
        this.userRepo = userRepo;
    }

    public boolean isOperator(Authentication auth) {
        if (auth == null || auth.getName() == null) return false;
        boolean adminToken = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(ADMIN_AUTHORITIES::contains);
        if (adminToken) return true;
        return userRepo.findById(auth.getName())
                .map(user -> user.getOperatorRole() != null
                        && user.getStatus() == AepUser.UserStatus.ACTIVE)
                .orElse(false);
    }

    /**
     * {@link java.security.Principal} 形态的入口（Spring MVC 注入的 Principal 实际就是 Authentication）；
     * 非 Authentication 实例时按名字查库判定。
     */
    public void require(java.security.Principal principal, String message) {
        if (principal instanceof Authentication auth) {
            require(auth, message);
            return;
        }
        boolean ok = principal != null && principal.getName() != null
                && userRepo.findById(principal.getName())
                        .map(user -> user.getOperatorRole() != null
                                && user.getStatus() == AepUser.UserStatus.ACTIVE)
                        .orElse(false);
        if (!ok) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OPERATOR_ONLY", message);
        }
    }

    /** 不是运营 → 403 {@code OPERATOR_ONLY}，message 由调用方给业务化文案。 */
    public void require(Authentication auth, String message) {
        if (!isOperator(auth)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OPERATOR_ONLY", message);
        }
    }
}
