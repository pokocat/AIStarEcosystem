package com.aistareco.aep.identity;

import com.aistareco.aep.model.PlatformConfig;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 账号中心断开时的验签（2026-11-06 事故）。假的账号中心可以正常回、回错误、接了请求不回。
 */
class IdentityJwkCacheTest {

    private static final String ISSUER = "https://id.aibuzz.test";
    private static final String AUDIENCE = "aistar-api";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static RSAKey keyA;
    private static RSAKey keyB;

    private HttpServer center;
    private ExecutorService centerThreads;
    private volatile String jwksBody;
    private volatile int jwksStatus;
    private final CountDownLatch release = new CountDownLatch(1);
    private volatile boolean hang;
    private final AtomicInteger jwksCalls = new AtomicInteger();
    private final AtomicInteger discoveryCalls = new AtomicInteger();

    private MutableClock clock;
    private IdentityProperties props;
    private PlatformConfigRepository repo;
    private IdentityJwkCache cache;
    private IdentityTokenVerifier verifier;

    @BeforeAll
    static void keys() throws Exception {
        keyA = new RSAKeyGenerator(2048).keyID("kid-a").generate();
        keyB = new RSAKeyGenerator(2048).keyID("kid-b").generate();
    }

    @BeforeEach
    void setUp() throws Exception {
        jwksBody = new JWKSet(keyA.toPublicJWK()).toString();
        jwksStatus = 200;
        center = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        centerThreads = Executors.newCachedThreadPool();
        center.setExecutor(centerThreads);
        center.createContext("/jwks", exchange -> {
            jwksCalls.incrementAndGet();
            if (hang) {
                try {
                    release.await(30, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            byte[] body = jwksBody.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(jwksStatus, body.length);
            try (OutputStream out = exchange.getResponseBody()) { out.write(body); }
        });
        center.createContext("/.well-known/openid-configuration", exchange -> {
            discoveryCalls.incrementAndGet();
            byte[] body = ("{\"jwks_uri\":\"" + jwksUri() + "\"}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream out = exchange.getResponseBody()) { out.write(body); }
        });
        center.start();

        clock = new MutableClock();
        props = new IdentityProperties();
        props.setIssuer(ISSUER);
        props.setJwksUri(jwksUri());
        props.setAudience(AUDIENCE);
        repo = mock(PlatformConfigRepository.class);
        when(repo.findByConfigKey(anyString())).thenReturn(Optional.empty());
        cache = new IdentityJwkCache(props, repo, MAPPER, clock);
        verifier = new IdentityTokenVerifier(props, cache);
    }

    @AfterEach
    void tearDown() {
        release.countDown();
        center.stop(0);
        centerThreads.shutdownNow();
    }

    private String jwksUri() {
        return "http://127.0.0.1:" + center.getAddress().getPort() + "/jwks";
    }

    // ------------------------------------------------------------ 重启

    @Test
    void afterRestartStoredKeysVerifyWithoutTouchingTheCenter() throws Exception {
        stored(ISSUER, new JWKSet(keyA.toPublicJWK()));
        cache.loadStored();

        Jwt jwt = verifier.verify(token(keyA, "uid-1"));

        assertThat(jwt.getSubject()).isEqualTo("uid-1");
        assertThat(jwksCalls.get()).isZero();
    }

    /** 事故现场：账号中心不回话时重启，大家不能排在一个卡住的请求后面。 */
    @Test
    void restartWhileTheCenterHangsDoesNotHoldUpSignedInUsers() throws Exception {
        hang = true;
        stored(ISSUER, new JWKSet(keyA.toPublicJWK()));
        cache.loadStored();
        cache.refreshInBackground();

        String token = token(keyA, "uid-busy");

        List<Duration> elapsed = concurrently(32, () -> {
            long start = System.nanoTime();
            verifier.verify(token);
            return Duration.ofNanos(System.nanoTime() - start);
        });

        // 上限放宽到 2 秒只是给 CI 的波动留余量（RSA 验签本身是毫秒级）；旧代码在这里会一直等。
        assertThat(elapsed).hasSize(32).allSatisfy(d -> assertThat(d).isLessThan(Duration.ofSeconds(2)));
    }

    /** 第一次部署或库里没有公钥：回「暂时不可用」，不是「令牌无效」，也不能挂住。 */
    @Test
    void noKeysAndAHangingCenterFailsFastAsUnavailable() throws Exception {
        hang = true;
        String token = token(keyA, "uid-cold");

        List<Duration> elapsed = concurrently(16, () -> {
            long start = System.nanoTime();
            assertThatThrownBy(() -> verifier.verify(token))
                    .isInstanceOf(IdentityKeysUnavailableException.class);
            return Duration.ofNanos(System.nanoTime() - start);
        });

        assertThat(elapsed).allSatisfy(d -> assertThat(d)
                .isLessThan(IdentityJwkCache.MISS_WAIT.plusSeconds(2)));
        assertThat(jwksCalls.get()).as("并发只发一个请求").isEqualTo(1);
    }

    @Test
    void unreachableCenterWithNoKeysFailsAsUnavailableAndDoesNotRetryEveryRequest() throws Exception {
        center.stop(0);
        String token = token(keyA, "uid-down");

        assertThatThrownBy(() -> verifier.verify(token)).isInstanceOf(IdentityKeysUnavailableException.class);
        long start = System.nanoTime();
        assertThatThrownBy(() -> verifier.verify(token)).isInstanceOf(IdentityKeysUnavailableException.class);

        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofMillis(500));
    }

    // ------------------------------------------------------------ 一直在跑

    /** Nimbus 自带缓存 15 分钟过期后就全部验不过；这里断开多久都不能丢公钥。 */
    @Test
    void keysOutliveARunningOutage() throws Exception {
        cache.refresh().get(5, TimeUnit.SECONDS);
        String token = token(keyA, "uid-long");
        center.stop(0);

        clock.advance(Duration.ofHours(6));
        assertThatThrownBy(() -> cache.refresh().get(5, TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class);

        assertThat(verifier.verify(token).getSubject()).isEqualTo("uid-long");
    }

    @Test
    void errorResponsesAndEmptySetsNeverReplaceGoodKeys() throws Exception {
        cache.refresh().get(5, TimeUnit.SECONDS);
        String token = token(keyA, "uid-keep");

        jwksStatus = 502;
        jwksBody = "<html>bad gateway</html>";
        assertThatThrownBy(() -> cache.refresh().get(5, TimeUnit.SECONDS)).hasMessageContaining("502");
        jwksStatus = 200;
        jwksBody = "{\"keys\":[]}";
        assertThatThrownBy(() -> cache.refresh().get(5, TimeUnit.SECONDS)).isInstanceOf(java.util.concurrent.ExecutionException.class);
        jwksBody = "not json";
        assertThatThrownBy(() -> cache.refresh().get(5, TimeUnit.SECONDS)).isInstanceOf(java.util.concurrent.ExecutionException.class);

        assertThat(verifier.verify(token).getSubject()).isEqualTo("uid-keep");
    }

    // ------------------------------------------------------------ 换钥

    @Test
    void rotationPicksUpTheNewKeyOnFirstSightAndDropsTheRetiredOne() throws Exception {
        cache.refresh().get(5, TimeUnit.SECONDS);
        String retired = token(keyA, "uid-old");
        jwksBody = new JWKSet(keyB.toPublicJWK()).toString();

        clock.advance(IdentityJwkCache.MISS_REFRESH_INTERVAL.plusSeconds(1));
        assertThat(verifier.verify(token(keyB, "uid-new")).getSubject()).isEqualTo("uid-new");

        clock.advance(IdentityJwkCache.MISS_REFRESH_INTERVAL.plusSeconds(1));
        assertThatThrownBy(() -> verifier.verify(retired))
                .isInstanceOf(BadJwtException.class)
                .isNotInstanceOf(IdentityKeysUnavailableException.class);
    }

    /** 乱填 kid 不能把账号中心打爆，也不能让请求等着。 */
    @Test
    void unknownKidsAreInvalidAndHitTheCenterAtMostOncePerInterval() throws Exception {
        cache.refresh().get(5, TimeUnit.SECONDS);
        int before = jwksCalls.get();
        RSAKey stranger = new RSAKeyGenerator(2048).keyID("kid-stranger").generate();

        clock.advance(IdentityJwkCache.MISS_REFRESH_INTERVAL.plusSeconds(1));
        for (int i = 0; i < 20; i++) {
            String forged = token(stranger, "uid-forged");
            assertThatThrownBy(() -> verifier.verify(forged))
                    .isInstanceOf(JwtException.class)
                    .isNotInstanceOf(IdentityKeysUnavailableException.class);
        }

        assertThat(jwksCalls.get() - before).isEqualTo(1);
    }

    @Test
    void unknownKidDuringAnOutageIsUnavailableNotInvalid() throws Exception {
        cache.refresh().get(5, TimeUnit.SECONDS);
        center.stop(0);
        String rotated = token(keyB, "uid-rotated");

        clock.advance(IdentityJwkCache.MISS_REFRESH_INTERVAL.plusSeconds(1));
        assertThatThrownBy(() -> verifier.verify(rotated)).isInstanceOf(IdentityKeysUnavailableException.class);
    }

    // ------------------------------------------------------------ 存库

    @Test
    void freshKeysAreStoredOnceAndOnlyWhenTheyChange() throws Exception {
        cache.refresh().get(5, TimeUnit.SECONDS);
        var saved = org.mockito.ArgumentCaptor.forClass(PlatformConfig.class);
        verify(repo, timeout(3000).times(1)).save(saved.capture());
        JsonNode doc = MAPPER.readTree(saved.getValue().getValueJson());
        assertThat(saved.getValue().getConfigKey()).isEqualTo(IdentityJwkCache.CONFIG_KEY);
        assertThat(doc.path("issuer").asText()).isEqualTo(ISSUER);
        assertThat(doc.path("jwks").path("keys").get(0).path("kid").asText()).isEqualTo("kid-a");
        assertThat(saved.getValue().getValueJson()).as("只存公钥").doesNotContain("\"d\"");

        cache.refresh().get(5, TimeUnit.SECONDS);
        verify(repo, after(300).times(1)).save(any());
    }

    @Test
    void aFailedSaveIsRetriedOnTheNextRefreshAndDoesNotAffectVerification() throws Exception {
        when(repo.save(any())).thenThrow(new RuntimeException("db down")).thenAnswer(inv -> inv.getArgument(0));

        cache.refresh().get(5, TimeUnit.SECONDS);
        verify(repo, timeout(3000).times(1)).save(any());
        assertThat(verifier.verify(token(keyA, "uid-db")).getSubject()).isEqualTo("uid-db");

        cache.refresh().get(5, TimeUnit.SECONDS);
        verify(repo, timeout(3000).times(2)).save(any());
    }

    /** 库可能是别的环境复制来的。 */
    @Test
    void storedKeysOfAnotherIssuerAreIgnored() throws Exception {
        stored("https://other.example", new JWKSet(keyA.toPublicJWK()));
        center.stop(0);

        cache.loadStored();

        assertThatThrownBy(() -> verifier.verify(token(keyA, "uid-other")))
                .isInstanceOf(IdentityKeysUnavailableException.class);
    }

    @Test
    void aCorruptStoredRowDoesNotStopTheServerAndIsReplaced() throws Exception {
        PlatformConfig row = PlatformConfig.builder().id("row").configKey(IdentityJwkCache.CONFIG_KEY)
                .valueJson("{broken").build();
        when(repo.findByConfigKey(IdentityJwkCache.CONFIG_KEY)).thenReturn(Optional.of(row));

        cache.loadStored();
        assertThat(verifier.verify(token(keyA, "uid-corrupt")).getSubject()).isEqualTo("uid-corrupt");

        verify(repo, timeout(3000)).save(row);
    }

    @Test
    void nothingIsReadOrFetchedWhenIdentityIsTurnedOff() {
        props.setIssuer("");

        cache.loadStored();
        cache.refreshInBackground();

        verify(repo, never()).findByConfigKey(anyString());
        assertThat(jwksCalls.get()).isZero();
    }

    /** 能经后台改这一行的人，就能伪造任何人的令牌。 */
    @Test
    void theStoredKeysCannotBeEditedThroughPlatformConfig() {
        var configs = new com.aistareco.aep.service.PlatformConfigService(repo, MAPPER);

        assertThatThrownBy(() -> configs.upsert(IdentityJwkCache.CONFIG_KEY, MAPPER.createObjectNode(), null, "admin"))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThatThrownBy(() -> configs.delete(IdentityJwkCache.CONFIG_KEY))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);

        verify(repo, never()).save(any());
        verify(repo, never()).delete(any());
    }

    // ------------------------------------------------------------ 伪造的令牌

    /** 换了取公钥的方式，验签本身不能变松。这些都要判无效，也不该去问账号中心。 */
    @Test
    void forgedTokensAreInvalidAndNeverReachTheCenter() throws Exception {
        cache.refresh().get(5, TimeUnit.SECONDS);
        int before = jwksCalls.get();
        RSAKey sameKid = new RSAKeyGenerator(2048).keyID("kid-a").generate();

        assertThatThrownBy(() -> verifier.verify(token(sameKid, "uid-forged")))
                .isInstanceOf(BadJwtException.class)
                .isNotInstanceOf(IdentityKeysUnavailableException.class);

        SignedJWT hmac = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.HS256).keyID("kid-a").build(),
                new JWTClaimsSet.Builder().issuer(ISSUER).subject("uid-hs").audience(AUDIENCE)
                        .expirationTime(Date.from(Instant.now().plusSeconds(600))).build());
        hmac.sign(new com.nimbusds.jose.crypto.MACSigner("0123456789abcdef0123456789abcdef"));
        assertThatThrownBy(() -> verifier.verify(hmac.serialize())).isInstanceOf(BadJwtException.class);

        String none = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                "{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8)) + "."
                + java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                ("{\"iss\":\"" + ISSUER + "\",\"sub\":\"uid-none\",\"aud\":\"" + AUDIENCE + "\"}")
                        .getBytes(StandardCharsets.UTF_8)) + ".";
        assertThatThrownBy(() -> verifier.verify(none)).isInstanceOf(BadJwtException.class);

        assertThat(jwksCalls.get()).isEqualTo(before);
    }

    @Test
    void wrongIssuerAudienceAndExpiryStillFailWithStoredKeys() throws Exception {
        stored(ISSUER, new JWKSet(keyA.toPublicJWK()));
        cache.loadStored();

        assertThatThrownBy(() -> verifier.verify(signed(keyA, "https://evil.example", AUDIENCE, 600)))
                .isInstanceOf(BadJwtException.class);
        assertThatThrownBy(() -> verifier.verify(signed(keyA, ISSUER, "junshi-api", 600)))
                .isInstanceOf(BadJwtException.class);
        assertThatThrownBy(() -> verifier.verify(signed(keyA, ISSUER, AUDIENCE, -600)))
                .isInstanceOf(BadJwtException.class);
    }

    // ------------------------------------------------------------ 发现

    @Test
    void discoveryRunsOnceThenTheAddressIsRemembered() throws Exception {
        props.setJwksUri("");
        props.setIssuer("http://127.0.0.1:" + center.getAddress().getPort() + "/");

        cache.refresh().get(5, TimeUnit.SECONDS);
        cache.refresh().get(5, TimeUnit.SECONDS);

        assertThat(discoveryCalls.get()).isEqualTo(1);
        assertThat(jwksCalls.get()).isEqualTo(2);
    }

    @Test
    void aFailedFetchForgetsTheDiscoveredAddress() throws Exception {
        props.setJwksUri("");
        props.setIssuer("http://127.0.0.1:" + center.getAddress().getPort());
        cache.refresh().get(5, TimeUnit.SECONDS);

        jwksStatus = 404;
        assertThatThrownBy(() -> cache.refresh().get(5, TimeUnit.SECONDS)).hasMessageContaining("404");
        jwksStatus = 200;
        cache.refresh().get(5, TimeUnit.SECONDS);

        assertThat(discoveryCalls.get()).isEqualTo(2);
    }

    // ------------------------------------------------------------ helpers

    private void stored(String issuer, JWKSet set) throws Exception {
        String json = MAPPER.writeValueAsString(MAPPER.createObjectNode()
                .put("issuer", issuer)
                .put("savedAt", "2026-11-06T02:00:00Z")
                .set("jwks", MAPPER.readTree(set.toString())));
        when(repo.findByConfigKey(IdentityJwkCache.CONFIG_KEY)).thenReturn(Optional.of(
                PlatformConfig.builder().id("row").configKey(IdentityJwkCache.CONFIG_KEY).valueJson(json).build()));
    }

    private interface Task<T> {
        T run() throws Exception;
    }

    private <T> List<T> concurrently(int threads, Task<T> task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<T>> futures = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return task.run();
                }));
            }
            start.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> future : futures) results.add(future.get(30, TimeUnit.SECONDS));
            return results;
        } finally {
            pool.shutdownNow();
        }
    }

    private static String token(RSAKey key, String uid) throws Exception {
        return signed(key, ISSUER, AUDIENCE, 600, uid);
    }

    private static String signed(RSAKey key, String issuer, String audience, long expiresIn) throws Exception {
        return signed(key, issuer, audience, expiresIn, "uid-claims");
    }

    private static String signed(RSAKey key, String issuer, String audience, long expiresIn, String uid) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer(issuer).subject(uid).audience(audience)
                .issueTime(Date.from(Instant.now().minusSeconds(Math.max(0, -expiresIn) + 5)))
                .expirationTime(Date.from(Instant.now().plusSeconds(expiresIn)))
                .build();
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).type(JOSEObjectType.JWT).build(),
                claims);
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }

    private static final class MutableClock extends Clock {
        private volatile Instant now = Instant.parse("2026-11-06T03:00:00Z");

        void advance(Duration by) {
            now = now.plus(by);
        }

        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
