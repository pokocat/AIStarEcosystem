package com.aistareco.aep.impersonation;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ImpersonationTest {
    AdminUserRepository admins;
    AepUserRepository users;
    AdminUser admin;
    AepUser target;
    ImpersonationService service;
    MockEnvironment env;
    MutableClock clock;
    MockHttpServletRequest req = new MockHttpServletRequest();
    @BeforeEach void setup() {
        admins = mock(AdminUserRepository.class); users = mock(AepUserRepository.class);
        admin = AdminUser.builder().id("admin-1").role(AdminUser.AdminRole.SUPER_ADMIN).status(AdminUser.AdminStatus.ACTIVE).build();
        target = AepUser.builder().id("user-1").username("target").displayName("测试用户").kind(AepUser.AccountKind.STUDIO).status(AepUser.UserStatus.ACTIVE).build();
        when(admins.findById("admin-1")).thenReturn(Optional.of(admin));
        when(users.findById("user-1")).thenReturn(Optional.of(target));
        env = new MockEnvironment(); clock = new MutableClock();
        service = new ImpersonationService(admins, users, new ImpersonationOrigins(env), mock(AuditService.class), clock);
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    UsernamePasswordAuthenticationToken auth(String role) {
        return new UsernamePasswordAuthenticationToken("admin-1", null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }
    String code() {
        return service.start(auth("SUPER_ADMIN"), "user-1", "drama", req).handoffUrl().split("#code=")[1];
    }
    ImpersonationService.LoggedIn login() { return service.exchange(code(), "drama", "https://drama.aibuzz.cn", req); }
    @Test void adminCanLoginWithoutTargetPasswordOrIdentityUid() {
        var session = login();
        assertThat(session.token()).startsWith("imp_");
        assertThat(session.expiresAt()).isEqualTo(clock.instant().plusSeconds(1800));
        assertThat(service.authenticate(session.token()).user().getId()).isEqualTo("user-1");
        assertThat(target.getIdentityUid()).isNull();
    }
    @Test void ordinaryUserAndOperatorCannotStart() {
        for (String role : List.of("PERSONAL", "OPERATOR", "FINANCE_ADMIN"))
            assertThatThrownBy(() -> service.start(auth(role), "user-1", "drama", req)).isInstanceOf(BusinessException.class);
    }
    @Test void staleAdminTokenDoesNotPreserveSuperAdminPrivileges() {
        admin.setRole(AdminUser.AdminRole.OPERATOR);
        assertThatThrownBy(this::code).isInstanceOf(BusinessException.class);
    }
    @Test void ticketExpiresAfterOneMinute() {
        String code = code(); clock.now = clock.now.plusSeconds(61);
        assertThatThrownBy(() -> service.exchange(code, "drama", "https://drama.aibuzz.cn", req)).isInstanceOf(BusinessException.class);
    }
    @Test void ticketCannotBeReplayed() {
        String code = code(); service.exchange(code, "drama", "https://drama.aibuzz.cn", req);
        assertThatThrownBy(() -> service.exchange(code, "drama", "https://drama.aibuzz.cn", req)).isInstanceOf(BusinessException.class);
    }
    @Test void concurrentExchangeIssuesOnlyOneSession() throws Exception {
        String code = code(); var gate = new CountDownLatch(1); var accepted = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Void> run = () -> { gate.await(); try { service.exchange(code, "drama", "https://drama.aibuzz.cn", req); accepted.incrementAndGet(); } catch (BusinessException ignored) {} return null; };
            var first = pool.submit(run); var second = pool.submit(run); gate.countDown();
            first.get(5, TimeUnit.SECONDS); second.get(5, TimeUnit.SECONDS);
            assertThat(accepted.get()).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void originAndProductMustMatchButWrongRequestDoesNotConsume() {
        String code = code();
        assertThatThrownBy(() -> service.exchange(code, "music", "https://music.aibuzz.cn", req)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.exchange(code, "drama", "https://other.example", req)).isInstanceOf(BusinessException.class);
        assertThat(service.exchange(code, "drama", "https://drama.aibuzz.cn", req).token()).startsWith("imp_");
    }
    @Test void accountSuspensionIsCheckedOnEveryRequest() {
        var session = login(); target.setStatus(AepUser.UserStatus.SUSPENDED);
        assertThatThrownBy(() -> service.authenticate(session.token())).isInstanceOf(BusinessException.class);
    }
    @Test void removingAdminPrivilegeEndsImpersonation() {
        var session = login(); admin.setStatus(AdminUser.AdminStatus.SUSPENDED);
        assertThatThrownBy(() -> service.authenticate(session.token())).isInstanceOf(BusinessException.class);
    }
    @Test void expiredSessionIsNotAuthenticated() {
        var session = login(); clock.now = clock.now.plusSeconds(1801);
        assertThatThrownBy(() -> service.authenticate(session.token())).isInstanceOf(BusinessException.class);
    }
    @Test void exitRevokesOnlyThisImpersonationAndIsIdempotent() {
        var first = login(); var other = login(); service.exit(first.token(), req); service.exit(first.token(), req);
        assertThatThrownBy(() -> service.authenticate(first.token())).isInstanceOf(BusinessException.class);
        assertThat(service.authenticate(other.token()).user()).isSameAs(target);
        assertThat(target.getStatus()).isEqualTo(AepUser.UserStatus.ACTIVE);
    }
    @Test void writesReachBusinessHandlersWithTargetUserNotAdministrator() throws Exception {
        var session = login(); var filter = new ImpersonationFilter(service, new ObjectMapper());
        for (String method : List.of("GET", "POST", "PATCH", "DELETE")) {
            var request = new MockHttpServletRequest(method, "/api/me/drama/projects/one");
            request.addHeader("Authorization", "Bearer " + session.token());
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, (r, s) -> {
                var current = SecurityContextHolder.getContext().getAuthentication();
                assertThat(current.getName()).isEqualTo("user-1");
                assertThat(current.getAuthorities()).extracting("authority").containsExactly("ROLE_STUDIO");
                ((jakarta.servlet.http.HttpServletResponse)s).setStatus(204);
            });
            assertThat(response.getStatus()).isEqualTo(204);
        }
    }
    @Test void targetInAppOperatorRoleIsNotStrippedOrPromotedToAdminToken() throws Exception {
        target.setOperatorRole(AepUser.OperatorRole.OPERATOR);
        assertThat(service.authenticate(login().token()).user().getOperatorRole()).isEqualTo(AepUser.OperatorRole.OPERATOR);
    }
    @Test void unknownTokenCannotFallThroughToAnonymousOrDevAuth() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/me/drama/projects");
        request.addHeader("Authorization", "Bearer imp_unknown"); var response = new MockHttpServletResponse();
        new ImpersonationFilter(service, new ObjectMapper()).doFilter(request, response, (r,s) -> { throw new AssertionError("不应继续鉴权链"); });
        assertThat(response.getStatus()).isEqualTo(401);
    }
    @Test void productionRejectsLocalAndInjectedRedirects() {
        env.setActiveProfiles("mysql", "dev"); env.setProperty("aep.impersonation.origins.drama", "http://localhost:3011");
        assertThatThrownBy(() -> new ImpersonationOrigins(env).get("drama")).isInstanceOf(BusinessException.class);
        env.setProperty("aep.impersonation.origins.drama", "https://drama.example/path");
        assertThatThrownBy(() -> new ImpersonationOrigins(env).get("drama")).isInstanceOf(BusinessException.class);
    }
    @Test void testAllowsExplicitLocalOrigin() {
        env.setActiveProfiles("test"); env.setProperty("aep.impersonation.origins.drama", "http://localhost:3011");
        assertThat(new ImpersonationOrigins(env).get("drama")).isEqualTo("http://localhost:3011");
    }
    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-09-17T00:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
