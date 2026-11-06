package com.aistareco.aep.identity;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class IdentityPhoneSyncServiceTest {
    private HttpServer server;
    private IdentityPhoneSyncService sync;
    private AepUserRepository repo;
    private AepUser user;
    private final AtomicInteger calls = new AtomicInteger();
    private String response;
    private int status;
    private volatile boolean dropConnection;
    private volatile boolean stallBody;
    private java.util.concurrent.atomic.AtomicReference<Instant> now;

    @BeforeEach
    void setup() throws Exception {
        response = "{\"sub\":\"uid-test\",\"phone_number\":\"13900000001\",\"phone_number_verified\":true}";
        status = 200;
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        server.createContext("/userinfo", exchange -> {
            calls.incrementAndGet();
            if (dropConnection) {
                exchange.close();
                return;
            }
            if (stallBody) {
                // 响应头发出去，正文一直不来：HttpRequest.timeout 管不到这一段。
                exchange.sendResponseHeaders(200, 100);
                exchange.getResponseBody().flush();
                try {
                    Thread.sleep(10_000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                exchange.close();
                return;
            }
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            try (var out = exchange.getResponseBody()) { out.write(bytes); }
        });
        server.start();
        IdentityProperties props = new IdentityProperties();
        props.setIssuer("http://127.0.0.1:" + server.getAddress().getPort());
        repo = mock(AepUserRepository.class);
        user = AepUser.builder().id("local-test").identityUid("uid-test")
                .status(AepUser.UserStatus.ACTIVE).build();
        when(repo.findByIdForUpdate(user.getId())).thenReturn(Optional.of(user));
        var provisioning = new IdentityProvisioningService(repo, mock(IdentityUserInserter.class),
                mock(IdentityCenterClient.class), mock(org.springframework.beans.factory.ObjectProvider.class));
        now = new java.util.concurrent.atomic.AtomicReference<>(Instant.parse("2026-11-06T03:00:00Z"));
        sync = new IdentityPhoneSyncService(props, provisioning, new java.time.Clock() {
            @Override public java.time.ZoneId getZone() { return java.time.ZoneOffset.UTC; }
            @Override public java.time.Clock withZone(java.time.ZoneId zone) { return this; }
            @Override public Instant instant() { return now.get(); }
        });
    }

    @Test
    void closedLocalUserCannotReceiveLateUserinfo() {
        user.setStatus(AepUser.UserStatus.DELETED);
        user.setPhone("13900000002");
        sync.sync(user, jwt("uid-test", "phone"), "closed-user-token");
        assertThat(user.getPhone()).isEqualTo("13900000002");
        verify(repo, never()).save(any());
    }

    @AfterEach
    void stop() { server.stop(0); }

    private Jwt jwt(String uid, Object scope) {
        return Jwt.withTokenValue("test-bearer").header("alg", "RS256").subject(uid)
                .claim("scope", scope).expiresAt(Instant.now().plusSeconds(3600)).build();
    }

    @Test
    void authorizedUserInfoFillsPhoneAndRepeatedRequestsUseBoundedCache() {
        Jwt token = jwt("uid-test", List.of("openid", "phone"));
        sync.sync(user, token, "test-bearer");
        sync.sync(user, token, "test-bearer");
        assertThat(user.getPhone()).isEqualTo("13900000001");
        assertThat(user.isPhoneVerified()).isTrue();
        assertThat(calls.get()).isEqualTo(1);
        verify(repo, times(1)).save(user);
    }

    @Test
    void changedPhoneInvalidatesCacheAndRefreshTokenAlsoReadsAgain() {
        Jwt token = jwt("uid-test", "openid phone phone");
        sync.sync(user, token, "test-bearer");
        response = "{\"sub\":\"uid-test\",\"phone_number\":\"+8613900000002\",\"phone_number_verified\":true}";
        sync.invalidate();
        sync.sync(user, token, "test-bearer");
        assertThat(user.getPhone()).isEqualTo("13900000002");
        sync.sync(user, token, "refreshed-bearer");
        assertThat(calls.get()).isEqualTo(3);
    }

    /** 账号中心断开时，不能让每个令牌的请求都等一次超时。 */
    @Test
    void anUnreachableCenterPausesReadsForEveryTokenUntilItIsBack() {
        Jwt token = jwt("uid-test", List.of("phone"));
        dropConnection = true;
        sync.sync(user, token, "token-1");
        // JDK HttpClient 对连接被断开的 GET 自己会重试一次，这里只看第一次之后不再发。
        int attempts = calls.get();
        sync.sync(user, token, "token-2");
        sync.sync(user, token, "token-3");
        assertThat(calls.get()).isEqualTo(attempts);

        // outbox 能收到，说明账号中心回来了。
        dropConnection = false;
        sync.invalidate();
        sync.sync(user, token, "token-1");
        assertThat(calls.get()).isEqualTo(attempts + 1);
        assertThat(user.getPhone()).isEqualTo("13900000001");
    }

    /** 断开期间每 30 秒只有一个请求要等，其余的不受影响。 */
    @Test
    void afterThePauseOnlyOneRequestProbesAndTheOthersDoNotWait() throws Exception {
        Jwt token = jwt("uid-test", List.of("phone"));
        dropConnection = true;
        sync.sync(user, token, "token-first");
        dropConnection = false;
        stallBody = true;
        now.set(now.get().plusSeconds(31));
        int before = calls.get();

        var pool = java.util.concurrent.Executors.newFixedThreadPool(8);
        try {
            var start = new java.util.concurrent.CountDownLatch(1);
            var waits = new java.util.ArrayList<java.util.concurrent.Future<Long>>();
            for (int i = 0; i < 8; i++) {
                String bearer = "token-" + i;
                waits.add(pool.submit(() -> {
                    start.await();
                    long begin = System.nanoTime();
                    sync.sync(user, token, bearer);
                    return java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - begin);
                }));
            }
            start.countDown();
            long waited = 0;
            for (var wait : waits) {
                if (wait.get(10, java.util.concurrent.TimeUnit.SECONDS) > 2000) waited++;
            }
            assertThat(waited).isEqualTo(1);
            assertThat(calls.get() - before).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void aSuccessfulProbeEndsThePause() {
        Jwt token = jwt("uid-test", List.of("phone"));
        dropConnection = true;
        sync.sync(user, token, "token-first");
        dropConnection = false;
        now.set(now.get().plusSeconds(31));

        sync.sync(user, token, "token-probe");
        int after = calls.get();
        sync.sync(user, token, "token-next");

        assertThat(calls.get()).isEqualTo(after + 1);
        assertThat(user.getPhone()).isEqualTo("13900000001");
    }

    @Test
    void aResponseBodyThatNeverFinishesDoesNotHoldTheRequestThread() {
        stallBody = true;
        long start = System.nanoTime();
        sync.sync(user, jwt("uid-test", List.of("phone")), "token-stall");
        assertThat(java.time.Duration.ofNanos(System.nanoTime() - start))
                .isLessThan(java.time.Duration.ofSeconds(5));
        assertThat(user.getPhone()).isNull();
    }

    @Test
    void missingPhoneScopeDoesNotReadOrClearExistingPhone() {
        user.setPhone("13900000001");
        sync.sync(user, jwt("uid-test", List.of("openid")), "test-bearer");
        assertThat(calls.get()).isZero();
        assertThat(user.getPhone()).isEqualTo("13900000001");
        verifyNoInteractions(repo);
    }

    @Test
    void missingPhoneInAuthorizedSuccessfulResponseClearsOldPhone() {
        user.setPhone("13900000001");
        response = "{\"sub\":\"uid-test\",\"phone_verified\":false}";
        sync.sync(user, jwt("uid-test", List.of("phone")), "test-bearer");
        assertThat(user.getPhone()).isNull();
        assertThat(user.isPhoneVerified()).isFalse();
    }

    @Test
    void mismatchedSubjectCannotWriteAnotherUsersPhone() {
        response = "{\"sub\":\"another-uid\",\"phone_number\":\"13900000002\",\"phone_number_verified\":true}";
        user.setPhone("13900000001");
        sync.sync(user, jwt("uid-test", List.of("phone")), "test-bearer");
        assertThat(user.getPhone()).isEqualTo("13900000001");
        verifyNoInteractions(repo);
    }

    @Test
    void mappingChangedDuringRequestCannotOverwriteSurvivingIdentity() {
        AepUser repointed = AepUser.builder().id("local-test").identityUid("surviving-uid").phone("13900000003").build();
        when(repo.findByIdForUpdate("local-test")).thenReturn(Optional.of(repointed));
        sync.sync(user, jwt("uid-test", List.of("phone")), "test-bearer");
        assertThat(repointed.getPhone()).isEqualTo("13900000003");
        verify(repo, never()).save(any());
    }

    @Test
    void upstreamFailurePreservesExistingPhoneAndRetriesAfterInvalidation() {
        status = 503;
        user.setPhone("13900000001");
        sync.sync(user, jwt("uid-test", List.of("phone")), "test-bearer");
        assertThat(user.getPhone()).isEqualTo("13900000001");
        verifyNoInteractions(repo);
        status = 200;
        sync.invalidate();
        sync.sync(user, jwt("uid-test", List.of("phone")), "test-bearer");
        assertThat(user.isPhoneVerified()).isTrue();
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test
    void maskedPhoneIsRejectedWithoutOverwritingExistingPhone() {
        response = "{\"sub\":\"uid-test\",\"phone_number\":\"139****0001\",\"phone_number_verified\":true}";
        user.setPhone("13900000001");
        sync.sync(user, jwt("uid-test", List.of("phone")), "test-bearer");
        assertThat(user.getPhone()).isEqualTo("13900000001");
        verifyNoInteractions(repo);
    }
    @Test
    void currentProfileRefreshesWithoutPhoneGrantAndOptionalAbsencePreservesPhone() {
        user.setPhone("13900000001");
        user.setDisplayName("old");
        user.setAvatarUrl("https://example.test/old.png");
        response = "{\"sub\":\"uid-test\",\"name\":\"new\",\"picture\":null}";
        sync.sync(user, jwt("uid-test", "openid profile"), "profile-bearer");
        assertThat(user.getDisplayName()).isEqualTo("new");
        assertThat(user.getAvatarUrl()).isNull();
        assertThat(user.getPhone()).isEqualTo("13900000001");
        response = "{\"sub\":\"uid-test\"}";
        sync.invalidate();
        sync.sync(user, jwt("uid-test", "openid profile"), "profile-bearer");
        assertThat(user.getDisplayName()).isEqualTo("new");
    }

    @Test
    void eventDuringUserInfoReadPreventsStaleProfileWrite() {
        user.setPhone("13900000003");
        when(repo.findByIdForUpdate(user.getId())).thenAnswer(invocation -> {
            sync.invalidate();
            return Optional.of(user);
        });
        sync.sync(user, jwt("uid-test", "openid phone"), "stale-bearer");
        assertThat(user.getPhone()).isEqualTo("13900000003");
        verify(repo, never()).save(any());
    }

}
