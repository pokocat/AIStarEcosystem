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

    @BeforeEach
    void setup() throws Exception {
        response = "{\"sub\":\"uid-test\",\"phone_number\":\"13900000001\",\"phone_number_verified\":true}";
        status = 200;
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/userinfo", exchange -> {
            calls.incrementAndGet();
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            try (var out = exchange.getResponseBody()) { out.write(bytes); }
        });
        server.start();
        IdentityProperties props = new IdentityProperties();
        props.setIssuer("http://127.0.0.1:" + server.getAddress().getPort());
        repo = mock(AepUserRepository.class);
        user = AepUser.builder().id("local-test").identityUid("uid-test").build();
        when(repo.findByIdForUpdate(user.getId())).thenReturn(Optional.of(user));
        var provisioning = new IdentityProvisioningService(repo, mock(IdentityUserInserter.class),
                mock(IdentityCenterClient.class), mock(org.springframework.beans.factory.ObjectProvider.class));
        sync = new IdentityPhoneSyncService(props, provisioning);
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
}
