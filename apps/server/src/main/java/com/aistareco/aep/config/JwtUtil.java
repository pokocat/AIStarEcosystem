package com.aistareco.aep.config;

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

    public String generateToken(String userId, String username, String role) {
        Date now = new Date();
        return Jwts.builder()
                .subject(userId)
                .claim("username", username)
                .claim("role", role)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
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
