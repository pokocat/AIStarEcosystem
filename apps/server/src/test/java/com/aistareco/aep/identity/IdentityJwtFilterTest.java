package com.aistareco.aep.identity;

import com.aistareco.aep.config.JwtAuthenticationFilter;
import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.model.AepUser;
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
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 双验鉴权入口的行为契约（docs/unified-identity-plan.md §12.1）。
 *
 * <p>RS256 令牌在测试内**真实签发**：现场生成一把 RSA 密钥，用 JDK 自带 HttpServer 把公钥
 * 以 JWKS 形式挂在 127.0.0.1 上，`aep.identity.jwks-uri` 直接指过去 —— 不打桩验签逻辑，
 * 走的是真正的 Nimbus 远端取公钥 + 验签 + iss/exp/aud 校验。
 *
 * <p>本地档案层用内存 map 模拟 `aep_users`，这样能精确断言「第一次建档、第二次复用」。
 *
 * <p>关于「消费者令牌进不了 /api/admin/**」：`/api/admin/**` 的门禁是
 * `hasAnyRole(SUPER_ADMIN, OPERATOR, FINANCE_ADMIN)`（AepSecurityConfig）。本测试断言的是
 * 上游那一步 —— 令牌被映射成什么权限：消费者令牌拿到**空权限**（已认证但无角色 → 403），
 * operator-login 令牌拿到 `ROLE_OPERATOR`（→ 放行）。
 */
class IdentityJwtFilterTest {

    private static final String ISSUER = "https://id.aibuzz.test";
    private static final String AUDIENCE = "aistar-api";
    private static final String KID = "test-kid-1";

    private static HttpServer jwksServer;
    private static RSAKey rsaKey;
    private static String jwksUri;

    private JwtUtil jwtUtil;
    private IdentityProperties props;
    private IdentityTokenVerifier verifier;
    private IdentityProvisioningService provisioning;
    private JwtAuthenticationFilter filter;

    /** 内存版 aep_users（identityUid → 行）。 */
    private final Map<String, AepUser> byUid = new ConcurrentHashMap<>();
    private final AtomicInteger inserts = new AtomicInteger();

    @BeforeAll
    static void startJwks() throws Exception {
        rsaKey = new RSAKeyGenerator(2048).keyID(KID).generate();
        String jwks = new JWKSet(rsaKey.toPublicJWK()).toString();
        jwksServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        jwksServer.createContext("/jwks", exchange -> {
            byte[] body = jwks.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(body); }
        });
        jwksServer.start();
        jwksUri = "http://127.0.0.1:" + jwksServer.getAddress().getPort() + "/jwks";
    }

    @AfterAll
    static void stopJwks() {
        if (jwksServer != null) jwksServer.stop(0);
    }

    @BeforeEach
    void setUp() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");
        jwtUtil = new JwtUtil("unit-test-secret-key-please-change-32chars+", 3_600_000L, env);

        props = new IdentityProperties();
        props.setIssuer(ISSUER);
        props.setJwksUri(jwksUri);
        props.setAudience(AUDIENCE);
        verifier = new IdentityTokenVerifier(props);

        IdentityCenterClient client = mock(IdentityCenterClient.class);
        when(client.isEnabled()).thenReturn(false);

        var repo = mock(com.aistareco.aep.repository.AepUserRepository.class);
        when(repo.findByIdentityUid(anyString()))
                .thenAnswer(inv -> java.util.Optional.ofNullable(byUid.get(inv.getArgument(0, String.class))));

        IdentityUserInserter inserter = mock(IdentityUserInserter.class);
        when(inserter.insert(anyString(), anyString())).thenAnswer(inv -> {
            String uid = inv.getArgument(0);
            String username = inv.getArgument(1);
            inserts.incrementAndGet();
            AepUser user = AepUser.builder()
                    .id("local-" + inserts.get())
                    .username(username)
                    .kind(AepUser.AccountKind.PERSONAL)
                    .status(AepUser.UserStatus.ACTIVE)
                    .platforms("")
                    .identityUid(uid)
                    .createdAt(Instant.now())
                    .build();
            byUid.put(uid, user);
            return user;
        });

        provisioning = new IdentityProvisioningService(repo, inserter, client, noEnrollment());
        filter = new JwtAuthenticationFilter(jwtUtil, verifier, provisioning, props);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------------------ RS256 happy path

    @Test
    void rs256Token_jitProvisionsLocalUser_andSecondRequestReusesIt() throws Exception {
        String token = mintToken(claims -> claims
                .issuer(ISSUER).subject("01HZUID1234567890").audience(AUDIENCE)
                .claim("amr", List.of("sms")));

        Authentication first = runFilter("/api/me", token);
        assertThat(first).isNotNull();
        assertThat(first.getName()).isEqualTo("local-1");
        assertThat(inserts.get()).isEqualTo(1);
        AepUser created = byUid.get("01HZUID1234567890");
        assertThat(created.getUsername()).isEqualTo("id_01hzuid12345");
        assertThat(created.getPlatforms()).isEmpty();
        assertThat(created.getKind()).isEqualTo(AepUser.AccountKind.PERSONAL);

        SecurityContextHolder.clearContext();
        Authentication second = runFilter("/api/me", token);
        assertThat(second).isNotNull();
        assertThat(second.getName()).isEqualTo("local-1");
        assertThat(inserts.get()).as("第二次请求必须复用同一行，不再建档").isEqualTo(1);
    }

    @Test
    void rs256Token_authoritiesComeFromKindOnly_neverAdmin() throws Exception {
        String token = mintToken(c -> c.issuer(ISSUER).subject("uid-kind").audience(AUDIENCE)
                .claim("amr", List.of("sms")));
        Authentication auth = runFilter("/api/me", token);
        assertThat(roles(auth)).containsExactly("ROLE_PERSONAL");
    }

    // ------------------------------------------------------------ RS256 rejections

    @Test
    void rs256Token_wrongAudience_rejected() throws Exception {
        String token = mintToken(c -> c.issuer(ISSUER).subject("uid-aud").audience("junshi-api")
                .claim("amr", List.of("sms")));
        assertThat(runFilter("/api/me", token)).isNull();
        assertThat(inserts.get()).isZero();
    }

    @Test
    void rs256Token_wrongIssuer_rejected() throws Exception {
        String token = mintToken(c -> c.issuer("https://evil.example").subject("uid-iss").audience(AUDIENCE)
                .claim("amr", List.of("sms")));
        assertThat(runFilter("/api/me", token)).isNull();
    }

    @Test
    void rs256Token_expired_rejected() throws Exception {
        String token = mintToken(c -> c.issuer(ISSUER).subject("uid-exp").audience(AUDIENCE)
                .claim("amr", List.of("sms"))
                .expirationTime(Date.from(Instant.now().minusSeconds(120))));
        assertThat(runFilter("/api/me", token)).isNull();
    }

    @Test
    void machineToken_withoutAmr_getsNoUserContext() throws Exception {
        // client_credentials 令牌没有 amr → 不建用户上下文 → /api/me/** 落 401
        String token = mintToken(c -> c.issuer(ISSUER).subject("aistar-server").audience(AUDIENCE));
        assertThat(runFilter("/api/me/wallet", token)).isNull();
        assertThat(inserts.get()).isZero();
    }

    @Test
    void issuerUnset_rs256TokenRejected() throws Exception {
        props.setIssuer("");
        verifier.reset();
        String token = mintToken(c -> c.issuer(ISSUER).subject("uid-off").audience(AUDIENCE)
                .claim("amr", List.of("sms")));
        assertThat(runFilter("/api/me", token)).isNull();
        assertThat(inserts.get()).isZero();
    }

    @Test
    void suspendedLocalUser_gets401JsonShell() throws Exception {
        byUid.put("uid-suspended", AepUser.builder()
                .id("local-suspended").username("id_uid-suspended")
                .kind(AepUser.AccountKind.PERSONAL)
                .status(AepUser.UserStatus.SUSPENDED)
                .identityUid("uid-suspended").build());
        String token = mintToken(c -> c.issuer(ISSUER).subject("uid-suspended").audience(AUDIENCE)
                .claim("amr", List.of("sms")));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/me");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("ACCOUNT_DISABLED");
        assertThat(chain.getRequest()).as("停用账号不得进入业务链").isNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    // ------------------------------------------------------------ HS256 admin vs consumer

    @Test
    void consumerToken_ofOperatorAccount_hasNoAdminAuthority() throws Exception {
        AepUser operatorAccount = AepUser.builder()
                .id("u-op").username("operator")
                .kind(AepUser.AccountKind.STUDIO)
                .operatorRole(AepUser.OperatorRole.OPERATOR)
                .status(AepUser.UserStatus.ACTIVE)
                .build();
        String token = jwtUtil.consumerToken(operatorAccount);

        Authentication auth = runFilter("/api/admin/users", token);
        assertThat(auth).isNotNull();
        assertThat(auth.getName()).isEqualTo("u-op");
        assertThat(roles(auth))
                .as("消费者令牌只带账号类型，/api/admin/** 的 hasAnyRole 拿不到 → 403")
                .containsExactly("ROLE_STUDIO");
    }

    @Test
    void operatorLoginToken_hasAdminAuthority() throws Exception {
        String token = jwtUtil.adminToken("u-op", "operator", "OPERATOR");
        Authentication auth = runFilter("/api/admin/users", token);
        assertThat(roles(auth)).containsExactly("ROLE_OPERATOR");
    }

    @Test
    void legacyAdminTokenWithoutTyp_isRejectedByDefault() throws Exception {
        // v0.150：垫片默认关闭 —— 旧令牌不再当后台身份，管理员重新登录一次即可。
        // 为「不打断在线运营」留 7 天窗口，代价是任何持有旧格式令牌的人都能进 /api/admin/**，不值得。
        String token = jwtUtil.generateToken("u-admin", "admin", "SUPER_ADMIN");
        Authentication auth = runFilter("/api/admin/users", token);
        assertThat(auth).isNotNull();
        assertThat(roles(auth)).as("降为无权限 → /api/admin/** 出 403").isEmpty();
    }

    @Test
    void legacyAdminTokenWithoutTyp_acceptedOnlyWhenShimExplicitlyEnabled() throws Exception {
        ReflectionTestUtils.setField(filter, "legacyAdminRolesEnabled", true);
        String token = jwtUtil.generateToken("u-admin", "admin", "SUPER_ADMIN");
        Authentication auth = runFilter("/api/admin/users", token);
        assertThat(roles(auth)).containsExactly("ROLE_SUPER_ADMIN");
    }

    @Test
    void registerTicket_neverAuthenticates() throws Exception {
        String ticket = jwtUtil.generateRegisterTicket("13800138000");
        assertThat(runFilter("/api/me", ticket)).isNull();
    }

    // ------------------------------------------------------------ helpers

    private Authentication runFilter(String path, String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.addHeader("Authorization", "Bearer " + token);
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        return SecurityContextHolder.getContext().getAuthentication();
    }

    private static Set<String> roles(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }

    private interface ClaimCustomizer {
        JWTClaimsSet.Builder apply(JWTClaimsSet.Builder builder);
    }

    private static String mintToken(ClaimCustomizer customizer) throws Exception {
        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                .issueTime(Date.from(Instant.now()))
                .expirationTime(Date.from(Instant.now().plusSeconds(600)));
        JWTClaimsSet claims = customizer.apply(builder).build();
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KID).type(JOSEObjectType.JWT).build(),
                claims);
        jwt.sign(new RSASSASigner(rsaKey));
        return jwt.serialize();
    }

    /** 单测不装 EnrollmentService：ObjectProvider 返回空，JIT 后的开通策略静默跳过。 */
    private static org.springframework.beans.factory.ObjectProvider<com.aistareco.aep.enrollment.service.EnrollmentService> noEnrollment() {
        return new org.springframework.beans.factory.support.DefaultListableBeanFactory()
                .getBeanProvider(com.aistareco.aep.enrollment.service.EnrollmentService.class);
    }
}
