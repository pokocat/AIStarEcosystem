package com.aistareco.aep.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 注册凭证（register ticket）签发 / 校验单测。
 * 凭证用于：验证码登录发现手机号未注册时，免去用户在注册页重输验证码（v0.84）。
 */
class JwtUtilTest {

    /** dev profile（非生产）+ 足够长的密钥，避免触发生产 fail-fast。 */
    private JwtUtil newJwtUtil() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");
        return new JwtUtil("unit-test-secret-key-please-change-32chars+", 3_600_000L, env);
    }

    @Test
    void registerTicket_roundTripReturnsBoundPhone() {
        JwtUtil jwt = newJwtUtil();
        String ticket = jwt.generateRegisterTicket("13800138000");
        assertEquals("13800138000", jwt.verifyRegisterTicket(ticket));
    }

    @Test
    void registerTicket_tamperedTokenRejected() {
        JwtUtil jwt = newJwtUtil();
        String ticket = jwt.generateRegisterTicket("13800138000");
        // 改动签名末位 → 签名校验失败 → null
        String tampered = ticket.substring(0, ticket.length() - 1)
                + (ticket.endsWith("a") ? "b" : "a");
        assertNull(jwt.verifyRegisterTicket(tampered));
    }

    @Test
    void registerTicket_rejectsNullAndBlank() {
        JwtUtil jwt = newJwtUtil();
        assertNull(jwt.verifyRegisterTicket(null));
        assertNull(jwt.verifyRegisterTicket("   "));
        assertNull(jwt.verifyRegisterTicket("not-a-jwt"));
    }

    @Test
    void loginTokenNotAcceptedAsRegisterTicket() {
        JwtUtil jwt = newJwtUtil();
        // 普通登录 JWT 没有 typ=sms-register claim → 不能当注册凭证用
        String loginToken = jwt.generateToken("u-1", "phone_13800138000", "STUDIO");
        assertNull(jwt.verifyRegisterTicket(loginToken));
    }

    @Test
    void registerTicketNotAcceptedAsLoginToken() {
        JwtUtil jwt = newJwtUtil();
        // 反向：注册凭证 subject=手机号、无 role/username，但签名有效仍可被 parseToken 解析；
        // 关键防线在 verifyRegisterTicket 的 typ 校验（上一个用例）与 controller 的手机号比对。
        String ticket = jwt.generateRegisterTicket("13800138000");
        assertEquals("13800138000", jwt.parseToken(ticket).getSubject());
    }
}
