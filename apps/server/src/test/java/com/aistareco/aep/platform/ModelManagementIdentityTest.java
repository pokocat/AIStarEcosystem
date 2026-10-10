package com.aistareco.aep.platform;

import com.aistareco.common.BusinessException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.*;

class ModelManagementIdentityTest {
    private static final String KEY = "0123456789abcdef".repeat(4);
    private static final String BODY = "{\"action\":\"endpoints\"}";
    private static final String ISSUER = "aibuzz-platform";
    private static final String AUDIENCE = "aistar-model-management-v1";

    @Test
    void acceptsMatchingActionAndBodyHash() throws Exception {
        var identity = new ModelManagementIdentity(KEY);
        var claims = identity.require(token("valid", "endpoints", BODY, ISSUER, AUDIENCE, Instant.now()), BODY, "endpoints");
        assertEquals("operator-1", claims.getSubject());
        assertEquals("valid", claims.getId());
    }

    @Test
    void rejectsTamperedBodyAndDifferentAction() throws Exception {
        var identity = new ModelManagementIdentity(KEY);
        String authorization = token("tampered", "endpoints", BODY, ISSUER, AUDIENCE, Instant.now());
        unauthorized(() -> identity.require(authorization, "{\"action\":\"endpoints\",\"extra\":true}", "endpoints"));
        unauthorized(() -> identity.require(authorization, BODY, "endpointDelete"));
    }

    @Test
    void rejectsExpiredTokenWrongAudienceAndWrongIssuer() throws Exception {
        var identity = new ModelManagementIdentity(KEY);
        String expired = token("expired", "endpoints", BODY, ISSUER, AUDIENCE, Instant.now().minusSeconds(60));
        String wrongAudience = token("audience", "endpoints", BODY, ISSUER, "other-service", Instant.now());
        String wrongIssuer = token("issuer", "endpoints", BODY, "other-platform", AUDIENCE, Instant.now());
        unauthorized(() -> identity.require(expired, BODY, "endpoints"));
        unauthorized(() -> identity.require(wrongAudience, BODY, "endpoints"));
        unauthorized(() -> identity.require(wrongIssuer, BODY, "endpoints"));
    }

    @Test
    void rejectsRepeatedJtiEvenWithAnotherValidCommand() throws Exception {
        var identity = new ModelManagementIdentity(KEY);
        identity.require(token("replayed", "endpoints", BODY, ISSUER, AUDIENCE, Instant.now()), BODY, "endpoints");
        String otherBody = "{\"action\":\"bindings\"}";
        String replay = token("replayed", "bindings", otherBody, ISSUER, AUDIENCE, Instant.now());
        unauthorized(() -> identity.require(replay, otherBody, "bindings"));
    }

    @Test
    void missingConfigurationReturnsServiceUnavailable() {
        var identity = new ModelManagementIdentity("");
        var error = assertThrows(BusinessException.class, () -> identity.require(null, BODY, "endpoints"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatus());
        assertEquals("MODEL_MANAGEMENT_NOT_CONFIGURED", error.getCode());
    }

    private static void unauthorized(org.junit.jupiter.api.function.Executable call) {
        var error = assertThrows(BusinessException.class, call);
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatus());
        assertEquals("MODEL_MANAGEMENT_UNAUTHORIZED", error.getCode());
    }

    private static String token(String jti, String action, String body, String issuer, String audience, Instant issuedAt) throws Exception {
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8)));
        return "Bearer " + Jwts.builder().subject("operator-1").issuer(issuer).audience().add(audience).and()
                .id(jti).issuedAt(Date.from(issuedAt)).expiration(Date.from(issuedAt.plusSeconds(25)))
                .claim("scope", "platform").claim("action", action).claim("commandHash", hash)
                .signWith(Keys.hmacShaKeyFor(HexFormat.of().parseHex(KEY)), Jwts.SIG.HS256).compact();
    }
}
