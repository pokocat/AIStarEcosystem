package com.aistareco.aep.enrollment;

import com.aistareco.aep.enrollment.config.ProductRouteTable;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 开通闸的**防漂移门**（docs/unified-identity-plan.md §12.2）。
 *
 * <p>起真实上下文，枚举 Spring MVC 注册的每一个 {@code /api/**} handler，要求它三选一：
 * 产品无关白名单 / 已在 {@link ProductRouteTable} 登记 / 明确列进 {@link #UNGUARDED_ALLOWLIST}。
 *
 * <p>没有这道门，新增一个 controller 就会悄悄落进「未登记」——运行时是 403
 * {@code PRODUCT_ROUTE_UNMAPPED}（fail-closed，不会变成越权），但用户会看到接口坏掉。
 * 这里让它在构建期就报出来。
 */
@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:route-table;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=false",
        "aep.cdn.driver=local"
})
class ProductRouteTableCoverageTest {

    /**
     * 有意不进开通闸、又不适合登记进 {@link ProductRouteTable} 的公开路由。
     *
     * <p>每一条都必须写清楚理由 —— 这个名单是「例外」，不是「待办」。
     * 注意：已经落在 {@link ProductRouteTable} 白名单里的（{@code /api/auth/**}、
     * {@code /api/admin/**}、{@code /api/config/**}、{@code /api/pay/notify/**} …）
     * 与登记进 {@link ProductRouteTable#PUBLIC_GETS} 的公开 GET 都不必再列。
     *
     * <p>{@code GET /api/store/catalog} 原先靠这里「跳过检查」蒙混过关，
     * 但测试跳过并不等于运行时放行 —— 已登录用户仍被 {@code /api/store/**} 规则拦成 403。
     * 现在它是 {@link ProductRouteTable#PUBLIC_GETS} 里的一条服务端事实，闸门真的会放行。
     */
    private static final Map<String, String> UNGUARDED_ALLOWLIST = Map.of();

    @Autowired
    private RequestMappingHandlerMapping handlerMapping;

    @Test
    void everyApiHandlerIsWhitelistedOrMapped() {
        List<String> unmapped = new ArrayList<>();
        Set<String> seen = new TreeSet<>();

        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : handlerMapping.getHandlerMethods().entrySet()) {
            RequestMappingInfo info = entry.getKey();
            for (String rawPattern : patternsOf(info)) {
                if (!rawPattern.startsWith("/api/")) continue;
                String path = normalize(rawPattern);
                for (String method : methodsOf(info)) {
                    String key = method + " " + rawPattern;
                    if (!seen.add(key)) continue;
                    if (ProductRouteTable.isWhitelisted(path)) continue;
                    if (ProductRouteTable.isPublicGet(path, method)) continue;
                    if (UNGUARDED_ALLOWLIST.containsKey(rawPattern)) continue;
                    if (ProductRouteTable.resolve(path, method) != null) continue;
                    unmapped.add(key + "   (" + entry.getValue().getBeanType().getSimpleName() + ")");
                }
            }
        }

        // 防「枚举到 0 条也算通过」：这个仓当前有 700+ 个 /api handler，数量掉到三位数以下
        // 说明 handlerMapping 没拿到东西，本测试就成了摆设。
        assertThat(seen)
                .as("没有枚举到足够多的 /api handler —— 这道门大概率没在真正工作")
                .hasSizeGreaterThan(300);

        assertThat(unmapped)
                .as("这些路由既不在白名单、也没在 ProductRouteTable 登记、也不在 UNGUARDED_ALLOWLIST："
                        + "请到 ProductRouteTable 补一条规则（新子产品接口），"
                        + "或在 UNGUARDED_ALLOWLIST 写明为什么它可以不经开通闸。\n  "
                        + String.join("\n  ", unmapped))
                .isEmpty();
    }

    /** 路由表本身的自洽：模式非空、产品都是已知子产品、白名单前缀不带尾斜杠。 */
    @Test
    void routeTableIsWellFormed() {
        for (ProductRouteTable.Route route : ProductRouteTable.ROUTES) {
            assertThat(route.pattern()).startsWith("/api/");
            assertThat(route.pattern()).doesNotEndWith("/");
            assertThat(route.products()).isNotEmpty();
            assertThat(route.products())
                    .as("路由 %s 的产品必须是 PlatformSupport.ALL 里的值", route.pattern())
                    .allSatisfy(p -> assertThat(com.aistareco.aep.service.PlatformSupport.ALL).contains(p));
        }
        for (String prefix : ProductRouteTable.WHITELIST_PREFIXES) {
            assertThat(prefix).startsWith("/api").doesNotEndWith("/");
        }
        for (ProductRouteTable.PublicGet entry : ProductRouteTable.PUBLIC_GETS) {
            assertThat(entry.pattern()).startsWith("/api/");
            assertThat(entry.reason())
                    .as("公开 GET 豁免 %s 必须写清理由（这个名单是例外，不是待办）", entry.pattern())
                    .isNotBlank();
        }
    }

    /**
     * 公开商品目录不能出现「匿名 200 / 已登录 403」的倒挂：
     * {@code GET /api/store/catalog} 是登记在案的公开 GET，写路径仍归 music / drama 管。
     */
    @Test
    void storeCatalogIsAPublicGetWhileWritesStayGated() {
        assertThat(ProductRouteTable.isPublicGet("/api/store/catalog", "GET")).isTrue();
        // 同路径的非 GET 不豁免
        assertThat(ProductRouteTable.isPublicGet("/api/store/catalog", "POST")).isFalse();
        // 写路径既不是公开 GET，也仍然映射到 music / drama
        assertThat(ProductRouteTable.isPublicGet("/api/store/items/SKIN/x/redeem", "POST")).isFalse();
        ProductRouteTable.Route write = ProductRouteTable.resolve("/api/store/items/SKIN/x/redeem", "POST");
        assertThat(write).isNotNull();
        assertThat(write.products()).containsExactlyInAnyOrder("music", "drama");
    }

    /** {@code /api/me} 只能精确白名单：一旦当成前缀，整个 {@code /api/me/**} 业务面会全部失守。 */
    @Test
    void meWhitelistIsExactNotPrefix() {
        assertThat(ProductRouteTable.isWhitelisted("/api/me")).isTrue();
        assertThat(ProductRouteTable.isWhitelisted("/api/me/drama/projects")).isFalse();
        // P2-1：同前缀异语义路径不得被前缀白名单误放
        assertThat(ProductRouteTable.isWhitelisted("/api/me/license-of-someone-else")).isFalse();
        assertThat(ProductRouteTable.isWhitelisted("/api/me/license/activate")).isTrue();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static Set<String> patternsOf(RequestMappingInfo info) {
        Set<String> out = new LinkedHashSet<>();
        if (info.getPathPatternsCondition() != null) {
            info.getPathPatternsCondition().getPatterns()
                    .forEach(p -> out.add(p.getPatternString()));
        }
        if (info.getPatternsCondition() != null) {
            out.addAll(info.getPatternsCondition().getPatterns());
        }
        return out;
    }

    private static Set<String> methodsOf(RequestMappingInfo info) {
        Set<String> out = new LinkedHashSet<>();
        info.getMethodsCondition().getMethods().forEach(m -> out.add(m.name()));
        if (out.isEmpty()) {
            // 未声明方法 = 全方法可达，按最宽的那组校验。
            out.addAll(Set.of("GET", "POST", "PUT", "PATCH", "DELETE"));
        }
        return out;
    }

    /** 把 {@code /api/v1/avatars/{id}/looks} 归一成 {@code /api/v1/avatars/*&#47;looks} 以便与规则模式比对。 */
    private static String normalize(String pattern) {
        return pattern.replaceAll("\\{[^}]*}", "*");
    }
}
