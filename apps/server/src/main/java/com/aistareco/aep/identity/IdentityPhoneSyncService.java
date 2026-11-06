package com.aistareco.aep.identity;

import com.aistareco.aep.model.AepUser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HexFormat;
import java.util.Arrays;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 完整手机号只从已验签用户令牌的 /userinfo 读取，不假设 JWT 携带号码。
 * 本地 phone 是展示/搜索副本，身份始终按 uid 解析；失败不覆盖已有资料、不阻断登录。
 */
@Service
public class IdentityPhoneSyncService {
    private static final Logger log = LoggerFactory.getLogger(IdentityPhoneSyncService.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Duration USERINFO_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration UNREACHABLE_PAUSE = Duration.ofSeconds(30);
    private final IdentityProperties props;
    private final IdentityProvisioningService provisioning;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).followRedirects(HttpClient.Redirect.NEVER).build();
    // 只保留令牌摘要和下次读取时间，不缓存明文令牌、响应体或手机号。
    private final ConcurrentHashMap<String, Instant> nextReads = new ConcurrentHashMap<>();
    private final AtomicLong generation = new AtomicLong();
    // 账号中心连不上时，每 30 秒只放一个请求去试：资料同步不值得让用户的请求都等一次超时。
    private final AtomicReference<Instant> unreachableUntil = new AtomicReference<>(Instant.EPOCH);
    private final Clock clock;

    @Autowired
    public IdentityPhoneSyncService(IdentityProperties props, IdentityProvisioningService provisioning) {
        this(props, provisioning, Clock.systemUTC());
    }

    IdentityPhoneSyncService(IdentityProperties props, IdentityProvisioningService provisioning, Clock clock) {
        this.props = props;
        this.provisioning = provisioning;
        this.clock = clock;
    }

    /** 调用方必须已经完成签名、issuer、audience、过期时间和用户主体校验。 */
    public void sync(AepUser local, Jwt jwt, String token) {
        boolean phoneScope = hasPhoneScope(jwt);
        boolean profileScope = hasScope(jwt, "profile");
        if (!props.isEnabled() || (!phoneScope && !profileScope)) return;
        long readGeneration = generation.get();
        String key = readGeneration + ":" + digest(token);
        Instant now = clock.instant();
        Instant pausedUntil = unreachableUntil.get();
        if (now.isBefore(pausedUntil)) return;
        Instant next = nextReads.get(key);
        if (next != null && now.isBefore(next)) return;
        // 上次连不上：这一轮只有抢到的那个请求去试，其余直接走。
        if (!Instant.EPOCH.equals(pausedUntil)
                && !unreachableUntil.compareAndSet(pausedUntil, now.plus(UNREACHABLE_PAUSE))) return;
        try {
            if (!jwt.getSubject().equals(local.getIdentityUid())) throw new ProfileFailure("LOCAL_UID_MISMATCH");
            HttpRequest request = HttpRequest.newBuilder(URI.create(props.baseUrl() + "/userinfo"))
                    .timeout(USERINFO_TIMEOUT).header("Authorization", "Bearer " + token)
                    .header("Accept", "application/json").GET().build();
            HttpResponse<String> response = read(request, now);
            if (response.statusCode() != 200) throw new ProfileFailure("HTTP_" + response.statusCode());
            JsonNode body = JSON.readTree(response.body());
            if (body == null || !body.isObject() || !jwt.getSubject().equals(body.path("sub").asText())) {
                throw new ProfileFailure("USERINFO_SUB_MISMATCH");
            }
            String phone = null;
            boolean verified = false;
            if (phoneScope && body.hasNonNull("phone_number")) {
                if (!body.path("phone_number").isTextual() || !body.path("phone_number_verified").isBoolean()) {
                    throw new ProfileFailure("USERINFO_PHONE_SHAPE_INVALID");
                }
                phone = body.path("phone_number").asText().replaceFirst("^\\+86", "");
                if (!phone.matches("1[3-9]\\d{9}")) throw new ProfileFailure("USERINFO_PHONE_INVALID");
                verified = body.path("phone_number_verified").asBoolean();
            }
            // scope 明确含 phone 的成功响应不带号码，表示当前没有号码；不能保留换绑前的旧号。
            String name = null;
            String picture = null;
            boolean hasPicture = profileScope && body.has("picture");
            if (profileScope && body.has("name")) {
                if (!body.path("name").isTextual()) throw new ProfileFailure("USERINFO_NAME_INVALID");
                name = body.path("name").asText();
            }
            if (hasPicture && !body.path("picture").isNull()) {
                if (!body.path("picture").isTextual()) throw new ProfileFailure("USERINFO_PICTURE_INVALID");
                picture = body.path("picture").asText();
                if (picture.isBlank()) picture = null;
            }
            provisioning.syncUserInfo(local.getId(), jwt.getSubject(), phoneScope, phone, verified,
                    name, hasPicture, picture, () -> generation.get() == readGeneration);
            remember(key, now.plusSeconds(300), jwt.getExpiresAt());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            failed(key, now, local.getId(), "INTERRUPTED");
        } catch (Exception e) {
            // 不输出异常正文：HTTP/JSON 异常可能带响应体、手机号或 Authorization。
            failed(key, now, local.getId(), e instanceof ProfileFailure ? e.getMessage() : e.getClass().getSimpleName());
        }
    }

    /** 请求线程上最多等 {@link #USERINFO_TIMEOUT}，包括正文：{@code send} 的 timeout 只管到响应头。 */
    private HttpResponse<String> read(HttpRequest request, Instant now) throws Exception {
        var pending = http.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        try {
            HttpResponse<String> response = pending.get(USERINFO_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            unreachableUntil.set(Instant.EPOCH);
            return response;
        } catch (TimeoutException | ExecutionException e) {
            pending.cancel(true);
            unreachableUntil.set(now.plus(UNREACHABLE_PAUSE));
            throw new ProfileFailure("UNREACHABLE");
        }
    }

    /** outbox 换绑/合并后让下一次请求重新读取；在途请求的旧 generation 也不会命中新缓存。 */
    public void invalidate() {
        generation.incrementAndGet();
        nextReads.clear();
        // 能收到 outbox 说明账号中心已经连上了。
        unreachableUntil.set(Instant.EPOCH);
    }

    private void failed(String key, Instant now, String localUserId, String code) {
        log.warn("[identity] 手机号资料同步失败，保留已有资料并稍后重试 localUserId={} code={}", localUserId, code);
        remember(key, now.plusSeconds(15), null);
    }

    private void remember(String key, Instant next, Instant expires) {
        if (nextReads.size() >= 4096) nextReads.clear();
        nextReads.put(key, expires != null && expires.isBefore(next) ? expires : next);
    }

    static boolean hasPhoneScope(Jwt jwt) {
        return hasScope(jwt, "phone");
    }

    static boolean hasScope(Jwt jwt, String requested) {
        Object scope = jwt.getClaims().get("scope");
        if (scope instanceof Collection<?> values) return values.contains(requested);
        return scope instanceof String value && Arrays.asList(value.trim().split("\\s+")).contains(requested);
    }

    private static String digest(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static final class ProfileFailure extends RuntimeException {
        ProfileFailure(String code) { super(code); }
    }
}
