package com.aistareco.aep.enrollment.config;

import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.service.PlatformSupport;
import com.aistareco.common.TraceContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 子产品开通闸（docs/unified-identity-plan.md §12.2）。
 *
 * <p>此前「能进哪个子产品」只有前端按 {@code /api/me} 的 platforms 判断，后端 {@code /api/me/**}
 * 只查登录态 —— 换个子域名直接调 API 就能绕过。本 filter 在 JWT 认证之后、授权判定之前，
 * 把请求映射到子产品，再查 {@code product_enrollment} 是否 ACTIVE。</p>
 *
 * <p><b>产品由服务端路由表决定</b>（{@link ProductRouteTable}），不由客户端自报：</p>
 * <ul>
 *   <li>产品无关白名单（账号 / 钱包 / 消息 / 开通本身 / 认证 / 后台 / 内部 / 配置）→ 不拦</li>
 *   <li>登记在案的公开 GET（{@link ProductRouteTable#PUBLIC_GETS}，如 {@code GET /api/store/catalog}）
 *       → 不拦；这些路由匿名本来就能读，登录用户被拦是倒挂</li>
 *   <li>单产品路由（{@code /api/celebrity/**}、{@code /api/me/drama/**}、{@code /api/material/**} …）
 *       → 产品由路径决定，{@code X-App-Code} 只作审计；带 {@code drama} 头调带货接口一样被拦</li>
 *   <li>共享路由（music / drama 共用的数字人选择器等）→ {@code X-App-Code} 必须落在允许集合内，
 *       缺头 / 非法 403 {@code APP_CODE_REQUIRED}，合法但不在集合内 403 {@code PRODUCT_NOT_ENROLLED}</li>
 *   <li>未登记的业务路由 → 403 {@code PRODUCT_ROUTE_UNMAPPED}（fail-closed，并 WARN 出路径）</li>
 * </ul>
 *
 * <p>不拦的还有：未登录请求（交给 Spring Security 出 401）、机器身份（clip 服务令牌、
 * INTERNAL、后台角色）。开关 {@code aep.enrollment.enforce} 默认 true，只允许测试关闭。</p>
 */
@Component
public class EnrollmentGuard extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentGuard.class);

    /** 请求头名：前端 AuthProvider 用它声明「我是哪个子产品的页面」（共享路由判定 + 全站审计）。 */
    public static final String APP_CODE_HEADER = "X-App-Code";

    /** 机器 / 后台身份不经本闸。 */
    private static final Set<String> BYPASS_ROLES = Set.of(
            "ROLE_SUPER_ADMIN", "ROLE_OPERATOR", "ROLE_FINANCE_ADMIN", "ROLE_INTERNAL");

    private final EnrollmentService enrollmentService;
    private final ObjectMapper mapper;

    @Value("${aep.enrollment.enforce:true}")
    private boolean enforce;

    public EnrollmentGuard(EnrollmentService enrollmentService, ObjectMapper mapper) {
        this.enrollmentService = enrollmentService;
        this.mapper = mapper;
    }

    /** SSE 的 async dispatch 二次进入不重复判定（第一次已放行）。 */
    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!enforce) {
            chain.doFilter(request, response);
            return;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()
                || "anonymousUser".equals(String.valueOf(auth.getPrincipal()))) {
            // 未登录：交给 Spring Security 的授权链出 401，不在这里抢答。
            chain.doFilter(request, response);
            return;
        }
        for (GrantedAuthority ga : auth.getAuthorities()) {
            if (BYPASS_ROLES.contains(ga.getAuthority())) {
                chain.doFilter(request, response);
                return;
            }
        }

        String path = pathOf(request);
        if (!ProductRouteTable.isGuarded(path)) {
            chain.doFilter(request, response);
            return;
        }

        // 登记在案的公开 GET（如商品目录）：匿名本来就能读，登录了反而 403 是倒挂。
        if (ProductRouteTable.isPublicGet(path, request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        ProductRouteTable.Route route = ProductRouteTable.resolve(path, request.getMethod());
        if (route == null) {
            // fail-closed：新 controller 忘了登记就用不了（ProductRouteTableCoverageTest 会在构建期先喊）。
            log.warn("[enrollment] 未登记的业务路由，已拦截（请在 ProductRouteTable 登记）method={} path={}",
                    request.getMethod(), path);
            writeError(response, "PRODUCT_ROUTE_UNMAPPED",
                    "该接口尚未登记子产品归属，请联系平台运营", Map.of("path", path));
            return;
        }

        String headerProduct = appCodeProduct(request.getHeader(APP_CODE_HEADER));
        String product;
        if (route.pathPinned()) {
            // 路径已经决定产品：客户端自报的头只用于审计归因，改变不了判定。
            product = route.single();
        } else {
            if (headerProduct == null) {
                writeError(response, "APP_CODE_REQUIRED",
                        "请求缺少子产品标识，请刷新页面后重试", null);
                return;
            }
            if (!route.products().contains(headerProduct)) {
                log.debug("[enrollment] 共享路由的产品声明不在允许集合内 path={} appCode={} allowed={}",
                        path, headerProduct, route.products());
                writeError(response, "PRODUCT_NOT_ENROLLED",
                        "尚未开通该子产品，请先使用激活码开通",
                        Map.of("product", headerProduct, "allowed", sortedProducts(route)));
                return;
            }
            product = headerProduct;
        }

        String userId = auth.getName();
        if (!enrollmentService.isActive(userId, product)) {
            log.debug("[enrollment] blocked userId={} product={} path={}", userId, product, path);
            writeError(response, "PRODUCT_NOT_ENROLLED",
                    "尚未开通该子产品，请先使用激活码开通", Map.of("product", product));
            return;
        }
        chain.doFilter(request, response);
    }

    // ── 路由映射 ──────────────────────────────────────────────────────────────

    static String pathOf(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String ctx = request.getContextPath();
        if (ctx != null && !ctx.isEmpty() && uri.startsWith(ctx)) {
            uri = uri.substring(ctx.length());
        }
        return uri;
    }

    /** 该路径是否落在开通闸的管辖范围内。 */
    public static boolean isGuarded(String path) {
        return ProductRouteTable.isGuarded(path);
    }

    /**
     * 把 {@code X-App-Code} 头解析成产品 key；无法识别返回 null。
     *
     * <p>审计归因用的端标识形如 {@code celebrity-mp}（小程序）：产品 key 取首个 {@code '-'} 之前的部分。
     * 这样小程序继续发 {@code celebrity-mp} 供 AuditService / AiModelUsageService 分桶，
     * 开通判定仍按 {@code celebrity}。</p>
     */
    public static String appCodeProduct(String appCodeHeader) {
        String code = appCodeHeader == null ? "" : appCodeHeader.trim().toLowerCase(Locale.ROOT);
        if (PlatformSupport.ALL.contains(code)) return code;
        int dash = code.indexOf('-');
        if (dash > 0) {
            String prefix = code.substring(0, dash);
            if (PlatformSupport.ALL.contains(prefix)) return prefix;
        }
        return null;
    }

    /**
     * 把请求映射到子产品（{@code GET} 语义，仅供测试 / 诊断用；真正的判定在
     * {@link #doFilterInternal} 里带 HTTP 方法走 {@link ProductRouteTable}）。
     *
     * @return null = 无法确定（路由未登记，或共享路由缺 / 错 {@code X-App-Code}）
     */
    public static String resolveProduct(String path, String appCodeHeader) {
        ProductRouteTable.Route route = ProductRouteTable.resolve(path, "GET");
        if (route == null) return null;
        if (route.pathPinned()) return route.single();
        String product = appCodeProduct(appCodeHeader);
        return product != null && route.products().contains(product) ? product : null;
    }

    private static List<String> sortedProducts(ProductRouteTable.Route route) {
        return PlatformSupport.ALL.stream().filter(route.products()::contains).toList();
    }

    // ── 失败壳（与 SecurityJsonEntryPoint / GlobalExceptionHandler 同形状） ──────

    private void writeError(HttpServletResponse response, String code, String message,
                            Map<String, Object> details) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("message", message);
        String traceId = MDC.get(TraceContext.MDC_KEY);
        if (traceId != null && !traceId.isBlank()) error.put("traceId", traceId);
        if (details != null) error.put("details", details);
        response.getWriter().write(mapper.writeValueAsString(Map.of("error", error)));
    }
}
