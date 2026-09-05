package com.aistareco.aep.enrollment.config;

import com.aistareco.aep.service.PlatformSupport;
import org.springframework.util.AntPathMatcher;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 服务端路由 → 子产品映射表（{@code docs/unified-identity-plan.md} §12.2）。
 *
 * <p><b>为什么要有这张表</b>：v0.149 的第一版开通闸只覆盖 {@code /api/me/**} 等五个前缀，
 * 且除 {@code /api/star} / {@code /api/v1} 外一律信客户端自报的 {@code X-App-Code} 头 ——
 * 只开通了短剧的账号带 {@code X-App-Code: drama} 就能调 {@code /api/celebrity/**}
 * （闸门查的是 drama 的开通状态，而请求打的是带货的接口），
 * 而 {@code /api/material/**}、{@code /api/appearance-forge/**} 这些路由压根不在管辖内。
 * 这里把「哪条路由属于哪个子产品」变成**服务端事实**：
 *
 * <ul>
 *   <li><b>单产品路由</b>（集合只有一个元素）——产品由路径决定，请求头**只作审计**，
 *       客户端怎么自报都改变不了判定。</li>
 *   <li><b>共享路由</b>（集合有多个元素，如 music / drama 共用的数字人选择器）——
 *       请求头必须落在集合内，否则 403。</li>
 *   <li><b>未登记的业务路由</b> —— 一律 403 {@code PRODUCT_ROUTE_UNMAPPED}（fail-closed）：
 *       新 controller 不登记就用不了，靠 {@code ProductRouteTableCoverageTest} 在构建期兜住。</li>
 * </ul>
 *
 * <p>白名单（账号 / 钱包 / 消息 / 开通本身 / 认证 / 后台 / 内部 / 配置）与子产品无关，不进这张表。
 */
public final class ProductRouteTable {

    private ProductRouteTable() {}

    private static final AntPathMatcher MATCHER = new AntPathMatcher();

    private static final String MUSIC = PlatformSupport.MUSIC;
    private static final String DRAMA = PlatformSupport.DRAMA;
    private static final String CELEBRITY = PlatformSupport.CELEBRITY;
    private static final String AIAVATAR = PlatformSupport.AIAVATAR;
    private static final String STAR = PlatformSupport.STAR;

    /**
     * 一条路由规则。
     *
     * @param pattern  Ant 风格路径模式（{@code /api/celebrity/**}、{@code /api/v1/avatars/*&#47;looks}）
     * @param methods  受限的 HTTP 方法（大写）；空集 = 不限方法
     * @param products 允许的子产品集合；单元素 = 路径硬映射（忽略请求头）
     */
    public record Route(String pattern, Set<String> methods, Set<String> products) {

        /** 路径硬映射：产品由服务端路由决定，{@code X-App-Code} 只用于审计归因。 */
        public boolean pathPinned() {
            return products.size() == 1;
        }

        /** 硬映射时的唯一产品。 */
        public String single() {
            return products.iterator().next();
        }
    }

    private static Route any(String pattern, String... products) {
        return new Route(pattern, Set.of(), Set.of(products));
    }

    private static Route get(String pattern, String... products) {
        return new Route(pattern, Set.of("GET"), Set.of(products));
    }

    // ── 产品无关白名单 ────────────────────────────────────────────────────────

    /**
     * 精确匹配的白名单路径（不含子路径）。
     *
     * <p>{@code /api/me} 本身是账号档案，但 {@code /api/me/drama/**} 是短剧业务 ——
     * 所以它只能精确匹配，不能当前缀。
     */
    public static final Set<String> WHITELIST_EXACT = Set.of(
            "/api/me",
            "/api/me/messages-overview",
            "/api/me/password",
            "/api/me/tenants",
            "/api/me/ledger");

    /**
     * 前缀白名单：命中 {@code path.equals(p) || path.startsWith(p + "/")} 即放行。
     *
     * <p>用「精确或下一段」而不是裸 {@code startsWith}，否则 {@code /api/me/licenses-of-someone-else}
     * 这类同前缀异语义路径会被误放（P2-1）。
     */
    public static final List<String> WHITELIST_PREFIXES = List.of(
            // 开通本身：未开通的账号必须能走它来开通，否则闸门自锁
            "/api/me/enrollments",
            "/api/me/license",
            // 账号资金 / 消息 / 存储用量：五个子产品共用一个账户，不按产品隔离
            "/api/me/wallet",
            "/api/me/notifications",
            "/api/me/storage",
            "/api/notifications",
            // 军师 BFF 的 clip 域：service token + externalOwnerId，不是本仓用户身份
            "/api/me/clip",
            // 认证 / 后台 / 内部 / 公共配置 / 支付回调
            "/api/auth",
            "/api/admin",
            "/api/internal",
            "/api/config",
            "/api/dev",
            "/api/pay/notify",
            "/api/v1/admin",
            // 七牛刷脸浏览器回跳（permitAll，靠不可枚举 state 防伪）
            "/api/v1/real-auth/callback",
            "/api/aiavatar/health");

    // ── 公开 GET（permitAll 且匿名可用，但落在某条业务路由的管辖前缀里）──────────

    /**
     * 一条「公开 GET」豁免。
     *
     * @param pattern Ant 风格路径模式
     * @param reason  为什么它可以不经开通闸 —— 必填，这是例外不是待办
     */
    public record PublicGet(String pattern, String reason) {}

    /**
     * 匿名可读的 {@code GET}：不经开通闸，登录与否拿到的都是同一份公开内容。
     *
     * <p><b>为什么需要这张表</b>：{@code /api/store/**} 整体归 music / drama 管，
     * 但 {@code GET /api/store/catalog} 在 {@code AepSecurityConfig} 里是 permitAll、
     * {@code StoreController#catalog} 也显式接受 {@code principal == null}。
     * 结果是：**匿名访客 200，只开通了带货的登录用户反而 403** —— 登录让公开内容变得更难看到，
     * 这显然是反的。这里把这类路由登记成服务端事实，闸门直接放行。
     *
     * <p>只豁免 {@code GET}：同一个 controller 的写接口
     * （{@code POST /api/store/items/{type}/{id}/redeem} 真实扣积分）仍走 {@code /api/store/**} 规则。
     */
    public static final List<PublicGet> PUBLIC_GETS = List.of(
            new PublicGet("/api/store/catalog",
                    "登录前可浏览的公开商品目录：AepSecurityConfig 已 permitAll，"
                            + "StoreController#catalog 显式支持匿名（principal 可为 null）。"
                            + "不豁免会出现「匿名 200 / 已登录 403」的倒挂；写路径 /api/store/items/** 不在此列。"));

    // ── 路由表（顺序敏感：先匹配先生效，具体规则必须排在通配前缀之前）────────────

    public static final List<Route> ROUTES = List.of(
            // ── 数字人资产平台（dap，/api/v1）──────────────────────────────────
            // 只读形象清单：music / drama 的「引入数字人」选择器直接读 dap 域（v0.61）。
            get("/api/v1/avatars", AIAVATAR, MUSIC, DRAMA),
            get("/api/v1/avatars/*/looks", AIAVATAR, MUSIC, DRAMA),
            get("/api/v1/avatars/*/derivatives", AIAVATAR, MUSIC, DRAMA),
            // 其余 dap 路由（创建 / 上传 / 合成 / 授权 / 捕获 / 声音）只属 aiavatar。
            any("/api/v1/**", AIAVATAR),

            // ── /api/me 子树（账号无关部分已在白名单）──────────────────────────
            any("/api/me/celebrity/**", CELEBRITY),
            any("/api/me/mixcut/**", CELEBRITY),
            any("/api/me/products/**", CELEBRITY),
            any("/api/me/publish-jobs/**", CELEBRITY),
            any("/api/me/social-accounts/**", CELEBRITY),
            any("/api/me/drama/**", DRAMA),
            any("/api/me/distribution/**", DRAMA),
            any("/api/me/songs/**", MUSIC),
            any("/api/me/albums/**", MUSIC),
            any("/api/me/concerts/**", MUSIC),
            any("/api/me/music/**", MUSIC),
            // 数字 IP 壳：music 的「艺人」与 drama 的「演员」共用同一套（v0.61 引入 AiAvatar）。
            any("/api/me/digital-ips/**", MUSIC, DRAMA),
            any("/api/me/inventory", MUSIC, DRAMA),

            // ── 明星带货 ──────────────────────────────────────────────────────
            any("/api/celebrity/**", CELEBRITY),
            any("/api/mixcut/**", CELEBRITY),
            any("/api/material/**", CELEBRITY),
            any("/api/products/**", CELEBRITY),
            any("/api/template-scripts/**", CELEBRITY),

            // ── 明星商务工作台 ────────────────────────────────────────────────
            any("/api/star/**", STAR),

            // ── AI 短剧 ───────────────────────────────────────────────────────
            any("/api/film/**", DRAMA),

            // ── AI 音乐人（含最早的 singer ecosystem 遗留控制器）────────────────
            any("/api/analytics/**", MUSIC),
            any("/api/coach/**", MUSIC),
            any("/api/distribution/**", MUSIC),
            any("/api/fan/**", MUSIC),
            any("/api/marketplace/**", MUSIC),
            any("/api/music/**", MUSIC),
            any("/api/nft/**", MUSIC),
            any("/api/singers/**", MUSIC),
            any("/api/tracks/**", MUSIC),

            // ── music / drama 共用的创作素材面 ─────────────────────────────────
            any("/api/appearance-forge/**", MUSIC, DRAMA),
            any("/api/community/**", MUSIC, DRAMA),
            any("/api/finance/**", MUSIC, DRAMA),
            any("/api/settings/**", MUSIC, DRAMA),
            any("/api/store/**", MUSIC, DRAMA),
            any("/api/wardrobe/**", MUSIC, DRAMA),
            any("/api/poses", MUSIC, DRAMA),
            any("/api/expressions", MUSIC, DRAMA),
            any("/api/gestures", MUSIC, DRAMA));

    // ── 查询 ─────────────────────────────────────────────────────────────────

    /** 该路径是否与子产品无关（账号 / 钱包 / 消息 / 认证 / 后台 / 内部 / 配置）。 */
    public static boolean isWhitelisted(String path) {
        if (path == null) return false;
        if (WHITELIST_EXACT.contains(path)) return true;
        for (String prefix : WHITELIST_PREFIXES) {
            // P2-1：精确或「下一段」，不能裸 startsWith
            if (path.equals(prefix) || path.startsWith(prefix + "/")) return true;
        }
        return false;
    }

    /** 该请求是否是登记在案的公开 GET（匿名可读，登录用户同样放行）。 */
    public static boolean isPublicGet(String path, String method) {
        if (path == null) return false;
        if (!"GET".equalsIgnoreCase(method == null ? "" : method.trim())) return false;
        for (PublicGet entry : PUBLIC_GETS) {
            if (MATCHER.match(entry.pattern(), path)) return true;
        }
        return false;
    }

    /** 找到第一条命中的规则；{@code null} = 未登记（调用方按 fail-closed 处理）。 */
    public static Route resolve(String path, String method) {
        if (path == null) return null;
        String verb = method == null ? "" : method.trim().toUpperCase(Locale.ROOT);
        for (Route route : ROUTES) {
            if (!route.methods().isEmpty() && !route.methods().contains(verb)) continue;
            if (MATCHER.match(route.pattern(), path)) return route;
        }
        return null;
    }

    /** 该路径是否属于开通闸的管辖范围（{@code /api/**} 且不在白名单内）。 */
    public static boolean isGuarded(String path) {
        return path != null && path.startsWith("/api/") && !isWhitelisted(path);
    }
}
