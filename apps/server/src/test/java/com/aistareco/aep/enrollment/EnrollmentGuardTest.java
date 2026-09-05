package com.aistareco.aep.enrollment;

import com.aistareco.aep.enrollment.config.EnrollmentGuard;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 子产品开通闸（docs/unified-identity-plan.md §12.2）的规则验证。
 *
 * <p>直接驱动 filter（不起 Spring 上下文）：判定只依赖「路径 + HTTP 方法 + X-App-Code 头 +
 * SecurityContext + enrollment 查询」五个输入，起整个应用只会让这组规则更难读。
 * 「每个真实 controller 都登记了」由 {@link ProductRouteTableCoverageTest} 在真上下文里守。</p>
 */
class EnrollmentGuardTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private EnrollmentService enrollmentService;
    private EnrollmentGuard guard;

    @BeforeEach
    void setUp() {
        enrollmentService = mock(EnrollmentService.class);
        guard = new EnrollmentGuard(enrollmentService, OM);
        ReflectionTestUtils.setField(guard, "enforce", true);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void loginAs(String userId, String... roles) {
        var authorities = java.util.Arrays.stream(roles)
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, authorities));
    }

    private MockHttpServletResponse run(String path, String appCode) throws Exception {
        return run("GET", path, appCode);
    }

    private MockHttpServletResponse run(String method, String path, String appCode) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(method, path);
        req.setRequestURI(path);
        if (appCode != null) req.addHeader(EnrollmentGuard.APP_CODE_HEADER, appCode);
        MockHttpServletResponse res = new MockHttpServletResponse();
        guard.doFilter(req, res, new MockFilterChain());
        return res;
    }

    private String codeOf(MockHttpServletResponse res) throws Exception {
        JsonNode body = OM.readTree(res.getContentAsString());
        return body.path("error").path("code").asText(null);
    }

    private JsonNode detailsOf(MockHttpServletResponse res) throws Exception {
        return OM.readTree(res.getContentAsString()).path("error").path("details");
    }

    // ── 白名单 ────────────────────────────────────────────────────────────────

    @Test
    void productAgnosticWhitelist_passesWithoutAppCode() throws Exception {
        loginAs("u1", "STUDIO");
        for (String path : List.of("/api/me", "/api/me/enrollments", "/api/me/wallet",
                "/api/me/notifications/123", "/api/me/clip/projects", "/api/me/license/activate",
                "/api/me/password", "/api/me/tenants", "/api/me/messages-overview", "/api/me/storage",
                "/api/notifications", "/api/auth/activate", "/api/admin/users", "/api/internal/ping",
                "/api/config/public", "/api/v1/admin/avatars", "/api/aiavatar/health/live")) {
            assertEquals(200, run(path, null).getStatus(), "白名单不应被拦：" + path);
        }
        verify(enrollmentService, never()).isActive(anyString(), anyString());
    }

    @Test
    void whitelistPrefixMatchesWholeSegmentsOnly() throws Exception {
        loginAs("u1", "STUDIO");
        // P2-1：同前缀异语义路径不得蹭白名单进来（这条路由未登记 → fail-closed）
        MockHttpServletResponse res = run("/api/me/license-of-someone-else", null);
        assertEquals(403, res.getStatus());
        assertEquals("PRODUCT_ROUTE_UNMAPPED", codeOf(res));
    }

    // ── 公开 GET：登录不该比不登录更难看到公开内容 ──────────────────────────────

    /**
     * {@code GET /api/store/catalog} 匿名 permitAll 就能读，
     * 从前只开通带货的登录账号反被 {@code /api/store/**}（music / drama）拦成 403 —— 倒挂。
     */
    @Test
    void publicStoreCatalog_isReachableByAnyEnrolledAccount() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "celebrity")).thenReturn(true);
        when(enrollmentService.isActive("u1", "music")).thenReturn(false);
        when(enrollmentService.isActive("u1", "drama")).thenReturn(false);

        // 带货端的头、也不带头，都应放行
        assertEquals(200, run("GET", "/api/store/catalog", "celebrity").getStatus());
        assertEquals(200, run("GET", "/api/store/catalog", null).getStatus());
        verify(enrollmentService, never()).isActive(anyString(), anyString());
    }

    /** 公开豁免只覆盖那一条 GET：商店写路径（真实扣积分）仍归 music / drama。 */
    @Test
    void storeWriteRoutesStayGated() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "music")).thenReturn(false);

        MockHttpServletResponse res = run("POST", "/api/store/items/SKIN/x/redeem", "music");
        assertEquals(403, res.getStatus());
        assertEquals("PRODUCT_NOT_ENROLLED", codeOf(res));

        // 同一 controller 的其它读接口也不豁免
        MockHttpServletResponse inv = run("GET", "/api/store/bundles", "music");
        assertEquals(403, inv.getStatus());
        assertEquals("PRODUCT_NOT_ENROLLED", codeOf(inv));
    }

    // ── 未登记路由 fail-closed ─────────────────────────────────────────────────

    @Test
    void unmappedBusinessPath_isRejectedFailClosed() throws Exception {
        loginAs("u1", "STUDIO");
        MockHttpServletResponse res = run("/api/brand-new-domain/things", "drama");
        assertEquals(403, res.getStatus());
        assertEquals("PRODUCT_ROUTE_UNMAPPED", codeOf(res));
        assertEquals("/api/brand-new-domain/things", detailsOf(res).path("path").asText());
        verify(enrollmentService, never()).isActive(anyString(), anyString());
    }

    @Test
    void previouslyUngatedBusinessPaths_areNowMappedToTheirProduct() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "celebrity")).thenReturn(true);
        // v0.149 时这两条完全不在管辖内（素材共享库 / 商品公共池），任何账号都能调
        assertEquals(200, run("/api/material/scripts", "celebrity").getStatus());
        assertEquals(200, run("/api/products/1", "celebrity").getStatus());
        // 形象锻造（真扣积分）同理，属 music / drama 共享面
        when(enrollmentService.isActive("u1", "music")).thenReturn(true);
        assertEquals(200, run("POST", "/api/appearance-forge/generate", "music").getStatus());
    }

    // ── 路径硬映射：客户端自报的头改变不了判定（P0-2）──────────────────────────

    @Test
    void dramaOnlyAccount_cannotReachCelebrityRoutesByClaimingDrama() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "drama")).thenReturn(true);
        when(enrollmentService.isActive("u1", "celebrity")).thenReturn(false);

        MockHttpServletResponse res = run("/api/celebrity/stars", "drama");

        assertEquals(403, res.getStatus());
        assertEquals("PRODUCT_NOT_ENROLLED", codeOf(res));
        assertEquals("celebrity", detailsOf(res).path("product").asText());
        // 关键：查的是 celebrity 的开通状态，不是请求头自报的 drama
        verify(enrollmentService).isActive("u1", "celebrity");
        verify(enrollmentService, never()).isActive("u1", "drama");
    }

    @Test
    void hardMappedPathsIgnoreHeaderEntirely() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "drama")).thenReturn(true);
        // 头写 music，路径决定 drama
        assertEquals(200, run("/api/me/drama/projects", "music").getStatus());
        verify(enrollmentService).isActive("u1", "drama");
    }

    @Test
    void hardMappedPathsDoNotNeedTheHeaderAtAll() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "celebrity")).thenReturn(true);
        assertEquals(200, run("/api/mixcut/jobs", null).getStatus());
        assertEquals(200, run("/api/celebrity/stars", null).getStatus());
    }

    @Test
    void starPrefixMapsToStarProduct_ignoringHeader() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "star")).thenReturn(false);
        MockHttpServletResponse res = run("/api/star/orders", "music");
        assertEquals(403, res.getStatus());
        assertEquals("star", detailsOf(res).path("product").asText());
    }

    // ── 共享路由：头必须落在允许集合里（P2-2）──────────────────────────────────

    @Test
    void dapAvatarListing_isSharedWithMusicAndDrama() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "music")).thenReturn(true);
        assertEquals(200, run("GET", "/api/v1/avatars", "music").getStatus());
        assertEquals(200, run("GET", "/api/v1/avatars/DH-1/looks", "music").getStatus());
        assertEquals(200, run("GET", "/api/v1/avatars/DH-1/derivatives", "music").getStatus());
        verify(enrollmentService, never()).isActive("u1", "aiavatar");
    }

    @Test
    void dapWriteRoutesStayAiavatarOnly() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "music")).thenReturn(true);
        when(enrollmentService.isActive("u1", "aiavatar")).thenReturn(false);

        // 同一个路径，POST 是「创建形象」，只属 aiavatar —— music 账号自报 music 也没用
        MockHttpServletResponse res = run("POST", "/api/v1/avatars", "music");
        assertEquals(403, res.getStatus());
        assertEquals("PRODUCT_NOT_ENROLLED", codeOf(res));
        assertEquals("aiavatar", detailsOf(res).path("product").asText());
    }

    @Test
    void aiavatarOwnListing_stillWorksWithoutHeaderBeingMusic() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "aiavatar")).thenReturn(true);
        assertEquals(200, run("GET", "/api/v1/avatars", "aiavatar").getStatus());
        assertEquals(200, run("GET", "/api/v1/compositions", "aiavatar").getStatus());
    }

    @Test
    void sharedRouteWithoutAppCodeHeader_isRejected() throws Exception {
        loginAs("u1", "STUDIO");
        MockHttpServletResponse res = run("/api/me/digital-ips", null);
        assertEquals(403, res.getStatus());
        assertEquals("APP_CODE_REQUIRED", codeOf(res));
        verify(enrollmentService, never()).isActive(anyString(), anyString());
    }

    @Test
    void sharedRouteWithUnknownAppCode_isRejected() throws Exception {
        loginAs("u1", "STUDIO");
        MockHttpServletResponse res = run("/api/me/digital-ips", "not-a-product");
        assertEquals(403, res.getStatus());
        assertEquals("APP_CODE_REQUIRED", codeOf(res));
    }

    @Test
    void sharedRouteWithAppCodeOutsideAllowedSet_isRejectedWithAllowedList() throws Exception {
        loginAs("u1", "STUDIO");
        // 数字 IP 壳只属 music / drama；带货账号自报 celebrity 不该借到这条路
        MockHttpServletResponse res = run("/api/me/digital-ips", "celebrity");
        assertEquals(403, res.getStatus());
        assertEquals("PRODUCT_NOT_ENROLLED", codeOf(res));
        JsonNode details = detailsOf(res);
        assertEquals("celebrity", details.path("product").asText());
        assertEquals(List.of("music", "drama"),
                OM.convertValue(details.path("allowed"), List.class));
        verify(enrollmentService, never()).isActive(anyString(), anyString());
    }

    @Test
    void sharedRouteWithActiveEnrollment_passes() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "drama")).thenReturn(true);
        assertEquals(200, run("/api/me/digital-ips", "drama").getStatus());
    }

    @Test
    void sharedRouteWithAllowedAppCodeButNoEnrollment_isRejected() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "drama")).thenReturn(false);
        MockHttpServletResponse res = run("/api/me/digital-ips", "drama");
        assertEquals(403, res.getStatus());
        assertEquals("PRODUCT_NOT_ENROLLED", codeOf(res));
        assertEquals("drama", detailsOf(res).path("product").asText());
    }

    // ── 未开通 ────────────────────────────────────────────────────────────────

    @Test
    void guardedPathWithoutEnrollment_isRejectedWithProductInDetails() throws Exception {
        loginAs("u1", "STUDIO");
        when(enrollmentService.isActive("u1", "drama")).thenReturn(false);

        MockHttpServletResponse res = run("/api/me/drama/projects", "drama");
        assertEquals(403, res.getStatus());
        assertEquals("PRODUCT_NOT_ENROLLED", codeOf(res));
        assertEquals("drama", detailsOf(res).path("product").asText());
    }

    // ── 旁路 ─────────────────────────────────────────────────────────────────

    @Test
    void nonApiPaths_arePassedThrough() throws Exception {
        loginAs("u1", "STUDIO");
        assertEquals(200, run("/cdn/media/foo.mp4", null).getStatus());
        assertEquals(200, run("/static/mixcut/out.mp4", null).getStatus());
        verify(enrollmentService, never()).isActive(anyString(), anyString());
    }

    @Test
    void unauthenticatedRequest_isLeftToSecurityChain() throws Exception {
        // 不设 SecurityContext：闸门放行，由随后的授权链出 401（不抢答成 403）
        assertEquals(200, run("/api/me/drama/projects", null).getStatus());
        verify(enrollmentService, never()).isActive(anyString(), anyString());
    }

    @Test
    void machineAndAdminIdentities_bypassGuard() throws Exception {
        for (String role : List.of("SUPER_ADMIN", "OPERATOR", "FINANCE_ADMIN", "INTERNAL")) {
            SecurityContextHolder.clearContext();
            loginAs("svc", role);
            assertEquals(200, run("/api/me/drama/projects", null).getStatus(), role + " 不应经开通闸");
        }
        verify(enrollmentService, never()).isActive(anyString(), anyString());
    }

    @Test
    void enforceDisabled_bypassesEverything() throws Exception {
        ReflectionTestUtils.setField(guard, "enforce", false);
        loginAs("u1", "STUDIO");
        assertEquals(200, run("/api/me/drama/projects", null).getStatus());
        verify(enrollmentService, never()).isActive(anyString(), anyString());
    }

    // ── 纯函数 ────────────────────────────────────────────────────────────────

    @Test
    void appCodeProduct_normalizesHeaderCaseAndWhitespace() {
        assertEquals("music", EnrollmentGuard.appCodeProduct(" Music "));
        assertNull(EnrollmentGuard.appCodeProduct(""));
        assertNull(EnrollmentGuard.appCodeProduct(null));
        assertNull(EnrollmentGuard.appCodeProduct("not-a-product"));
    }

    @Test
    void resolveProduct_prefersPathOverHeader() {
        assertEquals("celebrity", EnrollmentGuard.resolveProduct("/api/celebrity/stars", "drama"));
        assertEquals("star", EnrollmentGuard.resolveProduct("/api/star/profile", null));
        assertEquals("drama", EnrollmentGuard.resolveProduct("/api/me/digital-ips", "drama"));
        assertNull(EnrollmentGuard.resolveProduct("/api/me/digital-ips", "celebrity"));
        assertNull(EnrollmentGuard.resolveProduct("/api/nothing/here", "drama"));
        assertNotNull(EnrollmentGuard.resolveProduct("/api/v1/avatars/DH-1", null));
    }
}
