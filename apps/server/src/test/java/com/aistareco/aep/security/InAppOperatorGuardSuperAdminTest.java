package com.aistareco.aep.security;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 「难发布、易撤回」这条分级的回归。
 *
 * <p>存为全局示例会**推给全平台每一个用户**，一键生效、无复核、素材复制进平台自有存储 ——
 * 所以发布要超管。而撤下故意维持运营级：为了删掉一个不合适的示例还得先找到超管，
 * 只会让它在线上多挂几天。这两条方向相反，容易在后续改动里被「统一」掉，故钉死。
 */
class InAppOperatorGuardSuperAdminTest {

    private AepUser user(AepUser.OperatorRole role, AepUser.UserStatus status) {
        AepUser u = new AepUser();
        u.setId("u1");
        u.setOperatorRole(role);
        u.setStatus(status);
        return u;
    }

    private InAppOperatorGuard guardFor(AepUser u) {
        AepUserRepository repo = mock(AepUserRepository.class);
        when(repo.findById("u1")).thenReturn(Optional.ofNullable(u));
        return new InAppOperatorGuard(repo);
    }

    private Authentication auth(String... authorities) {
        return new UsernamePasswordAuthenticationToken("u1", "x",
                List.of(authorities).stream().map(SimpleGrantedAuthority::new).toList());
    }

    @Test
    void 普通运营不能发布全局示例() {
        InAppOperatorGuard g = guardFor(user(AepUser.OperatorRole.OPERATOR, AepUser.UserStatus.ACTIVE));
        Authentication a = auth();
        assertTrue(g.isOperator(a), "运营仍然是运营");
        assertFalse(g.isSuperAdmin(a), "但不是超管");
        BusinessException e = assertThrows(BusinessException.class,
                () -> g.requireSuperAdmin(a, "只有超管能发"));
        assertEquals("SUPER_ADMIN_ONLY", e.getCode());
    }

    @Test
    void 超管可以发布() {
        InAppOperatorGuard g = guardFor(user(AepUser.OperatorRole.SUPER_ADMIN, AepUser.UserStatus.ACTIVE));
        g.requireSuperAdmin(auth(), "should pass");   // 不抛即通过
        assertTrue(g.isSuperAdmin(auth()));
    }

    @Test
    void 运营仍然可以撤下_难发布易撤回() {
        InAppOperatorGuard g = guardFor(user(AepUser.OperatorRole.OPERATOR, AepUser.UserStatus.ACTIVE));
        g.require(auth(), "should pass");             // 撤下走 require，不该被收紧
    }

    @Test
    void 停用的超管不算超管() {
        InAppOperatorGuard g = guardFor(user(AepUser.OperatorRole.SUPER_ADMIN, AepUser.UserStatus.SUSPENDED));
        assertFalse(g.isSuperAdmin(auth()), "账号停用后权限必须一起失效");
    }

    @Test
    void 普通用户两样都不是() {
        InAppOperatorGuard g = guardFor(user(null, AepUser.UserStatus.ACTIVE));
        assertFalse(g.isOperator(auth()));
        assertFalse(g.isSuperAdmin(auth()));
    }

    @Test
    void 后台超管令牌直接放行() {
        // 后台签的令牌带 ROLE_SUPER_ADMIN，不必再查库
        InAppOperatorGuard g = guardFor(null);
        assertTrue(g.isSuperAdmin(auth("ROLE_SUPER_ADMIN")));
        assertFalse(g.isSuperAdmin(auth("ROLE_OPERATOR")), "OPERATOR 令牌不能冒充超管");
    }
}
