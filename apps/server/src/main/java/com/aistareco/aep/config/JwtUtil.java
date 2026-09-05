package com.aistareco.aep.config;

import com.aistareco.aep.model.AepUser;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;
import java.util.List;

@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    /** dev fallback；与 application.yml 的 default 完全一致。任何生产 profile 看到这个值就 fail-fast。 */
    private static final String DEV_DEFAULT_SECRET = "aep-dev-secret-key-change-in-prod-32chars";

    /** 任一 profile 命中即视为生产 → 强制校验密钥非 dev default。 */
    private static final List<String> PROD_PROFILES = List.of("mysql", "prod", "production");

    private final SecretKey key;
    private final long expirationMs;

    public JwtUtil(@Value("${aep.jwt.secret}") String secret,
                   @Value("${aep.jwt.expiration-ms}") long expirationMs,
                   Environment env) {
        // v0.34+ 生产 fail-fast：mysql / prod profile 下密钥不能是 dev default
        if (isProdProfile(env) && DEV_DEFAULT_SECRET.equals(secret)) {
            throw new IllegalStateException(
                "FATAL: aep.jwt.secret 仍是 dev default (\"" + DEV_DEFAULT_SECRET + "\") 但 active profile 是生产。" +
                " 请在 /etc/aistareco/server.env 设置 AEP_JWT_SECRET=<高熵随机 32+ 字符>。" +
                " 参考 infra/env/server.env.example §3 密钥段。");
        }
        if (isProdProfile(env) && secret.length() < 32) {
            throw new IllegalStateException(
                "FATAL: aep.jwt.secret 长度 " + secret.length() + " < 32 字符。生产必须 ≥ 32 字符高熵。");
        }
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, keyBytes.length);
            keyBytes = padded;
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;

        if (DEV_DEFAULT_SECRET.equals(secret)) {
            log.warn("⚠️  Using DEV-DEFAULT JWT secret. NEVER use in production.");
        }
    }

    private static boolean isProdProfile(Environment env) {
        String[] active = env.getActiveProfiles();
        return Arrays.stream(active).anyMatch(PROD_PROFILES::contains);
    }

    /**
     * v0.149+（统一账号中心 §12.1）：后台令牌标记。
     * 只有带 {@code typ=admin} 的令牌，{@link JwtAuthenticationFilter} 才会把 {@code role}
     * 映射成 {@code ROLE_*} 后台权限。消费者登录签的令牌一律没有这个 claim。
     */
    public static final String CLAIM_TOKEN_TYPE = "typ";
    public static final String TOKEN_TYPE_ADMIN = "admin";

    public String generateToken(String userId, String username, String role) {
        return build(userId, username, role, null);
    }

    /**
     * 后台令牌（{@code /api/admin/auth/login} 与 {@code /api/admin/auth/operator-login} 专用）。
     * 带 {@code typ=admin}，是**唯一**能拿到 {@code ROLE_SUPER_ADMIN} / {@code ROLE_OPERATOR} /
     * {@code ROLE_FINANCE_ADMIN} 的令牌种类。
     */
    public String adminToken(String subjectId, String username, String role) {
        return build(subjectId, username, role, TOKEN_TYPE_ADMIN);
    }

    /**
     * 消费者令牌（激活 / 短信 / 密码 / dev-login）。
     *
     * <p>§12.1：{@code role} 只放账号类型（{@code PERSONAL} / {@code STUDIO}），
     * **绝不**放 {@code operatorRole} —— 持有 operatorRole 的账号要进后台只能走
     * {@code /api/admin/auth/operator-login} 换一张 {@code typ=admin} 的令牌。
     */
    public String consumerToken(AepUser user) {
        String role = user.getKind() == null
                ? AepUser.AccountKind.PERSONAL.name()
                : user.getKind().name();
        return build(user.getId(), user.getUsername(), role, null);
    }

    private String build(String subject, String username, String role, String tokenType) {
        Date now = new Date();
        var builder = Jwts.builder()
                .subject(subject)
                .claim("username", username)
                .claim("role", role);
        if (tokenType != null) builder.claim(CLAIM_TOKEN_TYPE, tokenType);
        return builder
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }

    /** 注册凭证类型标记（与登录 JWT 区分，防止误用）。 */
    private static final String REGISTER_TICKET_TYPE = "sms-register";
    /** 注册凭证有效期：10 分钟。够用户从「验证码登录失败」切到「填激活码」完成注册。 */
    private static final long REGISTER_TICKET_TTL_MS = 10 * 60 * 1000L;

    /**
     * 签发一个短时效的「注册凭证」，绑定刚通过短信验证的手机号。
     * 用于：验证码登录通过但手机号未注册 → 引导走注册时，免去用户在注册页重新输验证码。
     * 凭证经 HMAC 签名不可伪造，subject=手机号，claim typ=sms-register，10 分钟过期。
     */
    public String generateRegisterTicket(String phone) {
        Date now = new Date();
        return Jwts.builder()
                .subject(phone)
                .claim("typ", REGISTER_TICKET_TYPE)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + REGISTER_TICKET_TTL_MS))
                .signWith(key)
                .compact();
    }

    /**
     * 校验注册凭证。成功返回凭证绑定的手机号；签名无效 / 过期 / 类型不符 → 返回 null。
     */
    public String verifyRegisterTicket(String ticket) {
        if (ticket == null || ticket.isBlank()) return null;
        try {
            Claims claims = parseToken(ticket.trim());
            if (!REGISTER_TICKET_TYPE.equals(claims.get("typ", String.class))) return null;
            return claims.getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
