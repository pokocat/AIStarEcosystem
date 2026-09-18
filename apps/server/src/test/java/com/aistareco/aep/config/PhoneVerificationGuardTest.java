package com.aistareco.aep.config;

import com.aistareco.aep.identity.IdentityProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 未绑手机号的账号只读（微信游客）。
 *
 * <p>直接驱动 filter，不起 Spring 上下文：判定只依赖「HTTP 方法 + 路径 + SecurityContext
 * 里的 phoneVerified 标记」三个输入。
 */
class PhoneVerificationGuardTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final String ISSUER = "https://id.aibuzz.cn";

    private PhoneVerificationGuard guard;

    @BeforeEach
    void setUp() {
        IdentityProperties props = new IdentityProperties();
        props.setIssuer(ISSUER);
        guard = new PhoneVerificationGuard(OM, props);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    // ── 核心：游客能读不能写 ───────────────────────────────────────────────────

    @ParameterizedTest(name = "{0} 属于读，游客照常放行")
    @ValueSource(strings = {"GET", "HEAD", "OPTIONS"})
    void guest_canRead(String method) throws Exception {
        loginAsGuest();
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse res = run(method, "/api/me/digital-ips", chain);

        assertEquals(200, res.getStatus());
        assertPassedThrough(chain);
    }

    @ParameterizedTest(name = "{0} 属于写，游客一律 403")
    @ValueSource(strings = {"POST", "PUT", "PATCH", "DELETE"})
    void guest_cannotWrite(String method) throws Exception {
        loginAsGuest();
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse res = run(method, "/api/me/digital-ips", chain);

        assertEquals(403, res.getStatus());
        assertEquals(PhoneVerificationGuard.ERROR_CODE, codeOf(res));
        assertNull(chain.getRequest(), "被拦下的请求不该进入业务链");
    }

    /** 403 要带上绑定入口，前端不必硬编码账号中心域名。 */
    @Test
    void rejection_carriesTheBindUrlDerivedFromIssuer() throws Exception {
        loginAsGuest();
        MockHttpServletResponse res = run("POST", "/api/me/digital-ips", new MockFilterChain());

        JsonNode details = OM.readTree(res.getContentAsString()).path("error").path("details");
        assertEquals(ISSUER + "/account/manage/phone", details.path("bindUrl").asText(null));
        assertTrue(OM.readTree(res.getContentAsString()).path("error").path("message")
                .asText().contains("绑定手机号"), "文案要说人话，不能只甩一个错误码");
    }

    /** issuer 没配时不编一个假地址出来，只是少一条 details。 */
    @Test
    void rejection_withoutIssuer_omitsBindUrlInsteadOfGuessing() throws Exception {
        guard = new PhoneVerificationGuard(OM, new IdentityProperties());
        loginAsGuest();
        MockHttpServletResponse res = run("POST", "/api/me/digital-ips", new MockFilterChain());

        assertEquals(403, res.getStatus());
        assertTrue(OM.readTree(res.getContentAsString()).path("error").path("details").isMissingNode());
    }

    // ── 谁不归这道闸门管 ──────────────────────────────────────────────────────

    @Test
    void verifiedUser_writesFreely() throws Exception {
        login(true);
        MockFilterChain chain = new MockFilterChain();
        assertEquals(200, run("POST", "/api/me/digital-ips", chain).getStatus());
        assertPassedThrough(chain);
    }

    /** legacy HS256 与内部服务令牌不带这个标记：不是游客，不该被拦。 */
    @Test
    void authenticationWithoutTheMarker_isNotTreatedAsGuest() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("legacy-1", null, java.util.List.of()));
        MockFilterChain chain = new MockFilterChain();

        assertEquals(200, run("POST", "/api/me/digital-ips", chain).getStatus());
        assertPassedThrough(chain);
    }

    /** 未登录不归本闸门管：该是 401 的别被改写成一个词不达意的 403。 */
    @Test
    void anonymous_isLeftToTheOtherGates() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        assertEquals(200, run("POST", "/api/me/digital-ips", chain).getStatus());
        assertPassedThrough(chain);
    }

    @ParameterizedTest(name = "{0} 不归本闸门管")
    @ValueSource(strings = {"/api/auth/sms/login", "/api/internal/clip/callback"})
    void exemptPrefixes_areNotGated(String path) throws Exception {
        loginAsGuest();
        MockFilterChain chain = new MockFilterChain();

        assertEquals(200, run("POST", path, chain).getStatus());
        assertPassedThrough(chain);
    }

    /** 前缀匹配必须是「整段」，不能让 /api/authorize-something 蹭进豁免名单。 */
    @Test
    void exemptPrefixMatchesWholeSegmentOnly() throws Exception {
        loginAsGuest();
        assertEquals(403, run("POST", "/api/authorize-anything", new MockFilterChain()).getStatus());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void loginAsGuest() {
        login(false);
    }

    private void login(boolean phoneVerified) {
        var auth = new UsernamePasswordAuthenticationToken("user-1", null, java.util.List.of());
        Map<String, Object> details = new HashMap<>();
        details.put(JwtAuthenticationFilter.PHONE_VERIFIED_DETAIL, phoneVerified);
        auth.setDetails(details);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private MockHttpServletResponse run(String method, String path, MockFilterChain chain)
            throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(method, path);
        req.setRequestURI(path);
        MockHttpServletResponse res = new MockHttpServletResponse();
        guard.doFilter(req, res, chain);
        return res;
    }

    private static void assertPassedThrough(MockFilterChain chain) {
        assertTrue(chain.getRequest() != null, "放行的请求应该进入业务链");
    }

    private String codeOf(MockHttpServletResponse res) throws Exception {
        return OM.readTree(res.getContentAsString()).path("error").path("code").asText(null);
    }
}
