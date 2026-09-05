package com.aistareco.aep.config;

import com.aistareco.aep.identity.IdentityProperties;
import com.aistareco.aep.identity.IdentityProvisioningService;
import com.aistareco.aep.identity.IdentityTokenVerifier;
import com.aistareco.aep.model.AepUser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 双验令牌过渡期的唯一鉴权入口（{@code docs/unified-identity-plan.md} §12.1）。
 *
 * <p><b>两条链路</b>：
 * <ul>
 *   <li><b>HS256（本仓自签，legacy）</b>：{@code AEP_JWT_SECRET} 验签，{@code sub} = 本地用户 id。</li>
 *   <li><b>RS256（统一账号中心）</b>：JOSE 头 {@code alg=RS256}、或 HS256 验不过且（未验签读到的）
 *       {@code iss} 等于 {@code aep.identity.issuer} → 走 JWKS 验签（{@link IdentityTokenVerifier}）；
 *       {@code sub} = 账号中心 uid，经 {@link IdentityProvisioningService} 解析 / JIT 建档成本地用户。</li>
 * </ul>
 *
 * <p><b>后台权限只认 {@code typ=admin}</b>：只有 {@code /api/admin/auth/login} 与
 * {@code operator-login} 签的令牌带这个 claim，也只有它们能拿到 {@code ROLE_SUPER_ADMIN} /
 * {@code ROLE_OPERATOR} / {@code ROLE_FINANCE_ADMIN}。消费者令牌（激活 / 短信 / 密码 / dev-login）
 * 的 {@code role} 只放账号类型，即便账号有 {@code operatorRole} 也进不了 {@code /api/admin/**}。
 * <b>RS256 令牌永不映射后台角色</b> —— 账号中心只管「你是谁」，不管「你是不是运营」。
 *
 * <p><b>过渡兼容（默认关闭）</b>：v0.149 之前签发的后台令牌没有 {@code typ}（TTL 7 天）。
 * 这段垫片让这类令牌只要 {@code role} 落在后台角色名里仍然放行（每次打 WARN），
 * 但它同时意味着「任何拿到旧格式令牌的人都能进 {@code /api/admin/**}」——
 * 为这点便利留 7 天窗口不值得，故 v0.150 起由 {@code aep.auth.legacy-admin-roles-enabled}
 * 控制且**默认 false**：部署后管理员重新登录一次即可，代价极小。
 * 只有确实需要「不打断在线运营」的灰度窗口才临时打开，并在窗口结束后删掉这段
 * （{@link #LEGACY_ADMIN_ROLES} 及其分支）。
 *
 * <p><b>验不过即匿名</b>：任何验不过的令牌都**不建立**安全上下文，由授权层给标准 401
 * （{@link SecurityJsonEntryPoint} 的 JSON 壳）。唯一例外是「令牌合法但本地账号被停用 / 删除」——
 * 那种情况直接在这里回 401 {@code ACCOUNT_DISABLED}，避免用户看到含糊的「未登录」。
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** 注册凭证（{@link JwtUtil#generateRegisterTicket}）的 typ；共用签名密钥但不是鉴权令牌。 */
    private static final String TOKEN_TYPE_REGISTER_TICKET = "sms-register";

    /**
     * 过渡期兼容名单：没有 {@code typ=admin} 但 {@code role} 命中这些名字的老令牌仍按后台放行（打 WARN）。
     * 名字与 {@code AdminUser.AdminRole} / {@code AepUser.OperatorRole} 对齐。
     */
    static final Set<String> LEGACY_ADMIN_ROLES = Set.of("SUPER_ADMIN", "OPERATOR", "FINANCE_ADMIN");

    /**
     * 过渡垫片开关（默认关闭，见类注释）。打开后没有 {@code typ=admin} 的旧后台令牌仍按后台放行。
     */
    @Value("${aep.auth.legacy-admin-roles-enabled:false}")
    private boolean legacyAdminRolesEnabled;

    private final JwtUtil jwtUtil;
    private final IdentityTokenVerifier identityVerifier;
    private final IdentityProvisioningService provisioningService;
    private final IdentityProperties identityProps;

    public JwtAuthenticationFilter(JwtUtil jwtUtil,
                                    IdentityTokenVerifier identityVerifier,
                                    IdentityProvisioningService provisioningService,
                                    IdentityProperties identityProps) {
        this.jwtUtil = jwtUtil;
        this.identityVerifier = identityVerifier;
        this.provisioningService = provisioningService;
        this.identityProps = identityProps;
    }

    /**
     * SseEmitter 会触发 servlet async dispatch。
     * 若这里跳过 async dispatch，安全链二次进入时上下文可能为空，进而在 AuthorizationFilter
     * 处把流式接口打成 403。
     */
    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        String token = authHeader.substring(7).trim();
        boolean rs256 = "RS256".equals(joseAlg(token));

        if (!rs256 && jwtUtil.isValid(token)) {
            authenticateLegacy(token);
        } else if (rs256 || issuerMatchesIdentityCenter(token)) {
            // true = 已就地写出 401（账号停用），不再进业务链。
            // 不能用 response.isCommitted() 判断：小响应体在真实容器里也未必已 commit。
            if (authenticateIdentity(token, response)) return;
        }
        filterChain.doFilter(request, response);
    }

    // -------------------------------------------------------------- legacy HS256

    private void authenticateLegacy(String token) {
        Claims claims = jwtUtil.parseToken(token);
        String tokenType = claims.get(JwtUtil.CLAIM_TOKEN_TYPE, String.class);
        if (TOKEN_TYPE_REGISTER_TICKET.equals(tokenType)) return;

        String userId = claims.getSubject();
        String role = claims.get("role", String.class);
        String username = claims.get("username", String.class);
        boolean adminToken = JwtUtil.TOKEN_TYPE_ADMIN.equals(tokenType);

        if (!adminToken && isAdminRoleName(role)) {
            if (legacyAdminRolesEnabled) {
                // 灰度窗口显式打开时才放行；留痕，窗口结束后删掉这段。
                log.warn("[auth] 放行无 typ=admin 的历史后台令牌（aep.auth.legacy-admin-roles-enabled=true）"
                        + " subject={} role={}", userId, role);
                adminToken = true;
            } else {
                // 默认路径：旧令牌不再当后台身份，由 applyAuthentication 降成无权限 →
                // /api/admin/** 出 403，管理员重新登录一次即可拿到 typ=admin 的新令牌。
                log.warn("[auth] 拒绝无 typ=admin 的历史后台令牌（请重新登录后台） subject={} role={}",
                        userId, role);
            }
        }
        applyAuthentication(userId, username, role, adminToken);
    }

    // -------------------------------------------------------------- identity RS256

    /** @return true 表示已就地写出响应（账号停用 401），调用方必须停止 filter chain。 */
    private boolean authenticateIdentity(String token, HttpServletResponse response) throws IOException {
        if (!identityVerifier.isEnabled()) {
            log.debug("[auth] 收到账号中心令牌但 aep.identity.issuer 未配置，按未登录处理");
            return false;
        }
        Jwt jwt;
        try {
            jwt = identityVerifier.verify(token);
        } catch (JwtException e) {
            log.debug("[auth] 账号中心令牌校验不通过：{}", e.getMessage());
            return false;
        }

        // §12.1：amr 非空才是「用户令牌」；机器令牌（client_credentials，无 amr）不得建立用户上下文，
        // 于是它在 /api/me/** 上必然落 401。
        List<String> amr = jwt.getClaimAsStringList("amr");
        if (amr == null || amr.isEmpty()) {
            log.debug("[auth] 账号中心机器令牌（无 amr）不建立用户上下文 sub={}", jwt.getSubject());
            return false;
        }

        String uid = jwt.getSubject();
        if (uid == null || uid.isBlank()) {
            log.warn("[auth] 账号中心令牌缺 sub，拒绝");
            return false;
        }

        AepUser user;
        try {
            user = provisioningService.resolveOrProvision(uid);
        } catch (RuntimeException e) {
            log.warn("[auth] 账号中心令牌本地建档失败 uid={} err={}", uid, e.toString());
            return false;
        }

        if (user.getStatus() != null && user.getStatus() != AepUser.UserStatus.ACTIVE) {
            log.warn("[auth] 账号中心令牌对应的本地账号不可用 uid={} localUserId={} status={}",
                    uid, user.getId(), user.getStatus());
            SecurityJsonEntryPoint.write(MAPPER, response, HttpServletResponse.SC_UNAUTHORIZED,
                    "ACCOUNT_DISABLED", "该账户已被停用");
            return true;
        }

        // RS256 令牌只按账号类型派权限，永不映射后台角色。
        String role = user.getKind() == null
                ? AepUser.AccountKind.PERSONAL.name()
                : user.getKind().name();
        applyAuthentication(user.getId(), user.getUsername(), role, false);
        return false;
    }

    // -------------------------------------------------------------- shared

    private void applyAuthentication(String userId, String username, String role, boolean adminToken) {
        List<SimpleGrantedAuthority> authorities;
        if (role == null || role.isBlank()) {
            authorities = List.of();
        } else if (!adminToken && isAdminRoleName(role)) {
            // 消费者 / RS256 令牌里出现后台角色名（正常签不出来）→ 一律降成无权限。
            authorities = List.of();
        } else {
            authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
        }
        var auth = new UsernamePasswordAuthenticationToken(userId, null, authorities);
        Map<String, Object> details = new HashMap<>();
        if (username != null && !username.isBlank()) details.put("username", username);
        if (role != null && !role.isBlank()) details.put("role", role);
        auth.setDetails(details);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private static boolean isAdminRoleName(String role) {
        return role != null && LEGACY_ADMIN_ROLES.contains(role.trim().toUpperCase(Locale.ROOT));
    }

    /** 读 JOSE 头的 {@code alg}（不验签，仅用于选链路）。解析失败返回 null。 */
    static String joseAlg(String token) {
        JsonNode header = decodeSegment(token, 0);
        return header == null ? null : header.path("alg").asText(null);
    }

    /** 未验签读取负载 {@code iss} 与配置 issuer 比较（仅用于选链路，绝不据此授权）。 */
    private boolean issuerMatchesIdentityCenter(String token) {
        if (!identityVerifier.isEnabled()) return false;
        JsonNode payload = decodeSegment(token, 1);
        if (payload == null) return false;
        String iss = payload.path("iss").asText(null);
        if (iss == null || iss.isBlank()) return false;
        return trimTrailingSlash(iss).equals(identityProps.baseUrl());
    }

    private static String trimTrailingSlash(String value) {
        String v = value == null ? "" : value.trim();
        while (v.endsWith("/")) v = v.substring(0, v.length() - 1);
        return v;
    }

    private static JsonNode decodeSegment(String token, int index) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2 || index >= parts.length) return null;
            byte[] raw = Base64.getUrlDecoder().decode(parts[index]);
            return MAPPER.readTree(new String(raw, StandardCharsets.UTF_8));
        } catch (Exception e) {
            return null;
        }
    }
}
