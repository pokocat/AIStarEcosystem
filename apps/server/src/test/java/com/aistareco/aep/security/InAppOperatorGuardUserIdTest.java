package com.aistareco.aep.security;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 只拿得到 uid 的服务层（视频生成区发布官方模板）用的运营判定：只看库 ——
 * operatorRole 为 operator / super_admin 且账号 ACTIVE。与令牌入口 {@code isOperator} 是同一条规则。
 */
class InAppOperatorGuardUserIdTest {

    private InAppOperatorGuard guard(AepUser.OperatorRole role, AepUser.UserStatus status) {
        AepUser u = new AepUser();
        u.setId("u1");
        u.setOperatorRole(role);
        u.setStatus(status);
        AepUserRepository repo = mock(AepUserRepository.class);
        when(repo.findById("u1")).thenReturn(Optional.of(u));
        return new InAppOperatorGuard(repo);
    }

    @Test
    @DisplayName("operator / super_admin 且在职 → 是运营；没有角色、停用、查无此人、空 uid → 不是")
    void readsOperatorRoleFromTheDatabase() {
        assertTrue(guard(AepUser.OperatorRole.OPERATOR, AepUser.UserStatus.ACTIVE).isOperatorUserId("u1"));
        assertTrue(guard(AepUser.OperatorRole.SUPER_ADMIN, AepUser.UserStatus.ACTIVE).isOperatorUserId("u1"));
        assertFalse(guard(null, AepUser.UserStatus.ACTIVE).isOperatorUserId("u1"));
        assertFalse(guard(AepUser.OperatorRole.OPERATOR, AepUser.UserStatus.SUSPENDED).isOperatorUserId("u1"));
        assertFalse(guard(AepUser.OperatorRole.OPERATOR, AepUser.UserStatus.ACTIVE).isOperatorUserId("u2"));
        assertFalse(guard(AepUser.OperatorRole.OPERATOR, AepUser.UserStatus.ACTIVE).isOperatorUserId(null));
        assertFalse(guard(AepUser.OperatorRole.OPERATOR, AepUser.UserStatus.ACTIVE).isOperatorUserId(" "));
    }
}
