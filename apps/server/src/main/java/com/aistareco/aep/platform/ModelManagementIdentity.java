package com.aistareco.aep.platform;

import com.aistareco.common.BusinessException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;

/** Dedicated short-lived management capability. Never establishes an admin or INTERNAL identity. */
@Component
public class ModelManagementIdentity {
    private final byte[] key;
    private final ConcurrentHashMap<String, Long> seen = new ConcurrentHashMap<>();
    public ModelManagementIdentity(@Value("${aep.platform.model-management-key:}") String value) {
        if (!value.isEmpty() && !value.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("Invalid model management key");
        key = value.isEmpty() ? null : HexFormat.of().parseHex(value);
    }
    public synchronized Claims require(String authorization, String commandJson, String action) {
        if (key == null) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "MODEL_MANAGEMENT_NOT_CONFIGURED", "模型配置服务暂不可用");
        try {
            if (authorization == null || !authorization.startsWith("Bearer ")) throw new IllegalArgumentException();
            var signed = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(key)).requireIssuer("aibuzz-platform")
                    .requireAudience("aistar-model-management-v1").build().parseSignedClaims(authorization.substring(7));
            if (!"HS256".equals(signed.getHeader().getAlgorithm())) throw new IllegalArgumentException();
            Claims c = signed.getPayload();
            long now = System.currentTimeMillis();
            if (c.getSubject() == null || c.getSubject().isBlank() || c.getSubject().length() > 64 || c.getId() == null || c.getIssuedAt() == null || c.getExpiration() == null || c.getExpiration().getTime() - c.getIssuedAt().getTime() > 30_000 || c.getIssuedAt().getTime() > now + 1000 || !"platform".equals(c.get("scope")) || !action.equals(c.get("action"))) throw new IllegalArgumentException();
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(commandJson.getBytes(StandardCharsets.UTF_8)));
            if (!MessageDigest.isEqual(hash.getBytes(StandardCharsets.US_ASCII), String.valueOf(c.get("commandHash")).getBytes(StandardCharsets.US_ASCII))) throw new IllegalArgumentException();
            seen.entrySet().removeIf(e -> e.getValue() < now);
            if (seen.size() >= 10000 || seen.putIfAbsent(c.getId(), c.getExpiration().getTime()) != null) throw new IllegalArgumentException();
            return c;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "MODEL_MANAGEMENT_UNAUTHORIZED", "模型配置授权已失效");
        }
    }
}
