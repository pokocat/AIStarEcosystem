package com.aistareco.aep.service.productlink;

import com.aistareco.aep.dto.ProductLinkInfoDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 抖音商城短链/PC 选品库链接处理 — query 没有 goods_detail，只有商品 id。
 *
 * 命中条件：host 白名单 `*.jinritemai.com` / `*.douyin.com`（防 SSRF）。
 * HttpClient GET 抖音商品详情页（伪装 desktop Chrome UA），从 HTML 里抽：
 *   - <meta property="og:image"  content="...">
 *   - <meta property="og:title"  content="...">
 *   - <meta property="og:description" content="...">
 *   - window.__INITIAL_STATE__ = {...};  / window._SSR_DATA_ = {...};
 *
 * 样例 URL（用户提供）：
 *   https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=3737779702866247934&origin_type=pc_buyin_selection_decision
 */
@Component
@Order(20)
public class DouyinHtmlScrapeHandler implements ProductLinkHandler {

    private static final Logger log = LoggerFactory.getLogger(DouyinHtmlScrapeHandler.class);
    private static final Set<String> DOUYIN_HOSTS = Set.of("jinritemai.com", "douyin.com");
    // 手动跟随重定向时最多跳几次——抖音短链常见一两跳，5 次足够且防重定向环。
    private static final int MAX_REDIRECTS = 5;
    private static final String UA =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) "
                    + "Chrome/126.0.0.0 Safari/537.36";

    private static final Pattern META_PATTERN = Pattern.compile(
            "<meta\\s+property=[\"'](og:[a-z]+)[\"']\\s+content=[\"']([^\"']+)[\"']",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern INITIAL_STATE_PATTERN = Pattern.compile(
            "window\\.(?:__INITIAL_STATE__|_SSR_DATA_|_ROUTER_DATA_)\\s*=\\s*(\\{.+?\\});",
            Pattern.DOTALL);

    private final HttpClient httpClient;
    private final ObjectMapper mapper;

    public DouyinHtmlScrapeHandler(ObjectMapper mapper) {
        this.mapper = mapper;
        // 不用 HttpClient 自带的自动跟随重定向（NORMAL）：它只在发起时不校验、跟到 30x 的 Location
        // 就去请求，而下面的 host 白名单只校验了**初始** URL。抖音/精选联盟这种大站上的开放重定向
        // 一旦被利用，白名单域上的一个 302 就能把服务端导去 169.254.169.254 / 内网地址（SSRF），
        // 抓回来的 og:* / 图片字段还会部分回显进 DTO。改为 NEVER + 手动逐跳跟随，每一跳的目标 host
        // 都重新过一遍白名单（见 getFollowingWhitelistedRedirects）。
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    /** host 是否命中抖音白名单（精确匹配或子域）。每一跳都要过这道闸。 */
    private static boolean isWhitelistedHost(String host) {
        if (host == null) return false;
        return DOUYIN_HOSTS.stream().anyMatch(h -> host.equals(h) || host.endsWith("." + h));
    }

    /**
     * 发 GET 并**手动**跟随重定向：每一跳（含初始 URL 与每个 Location）的目标 host 都必须仍在
     * 抖音白名单内、协议必须是 http(s)，否则立刻拒绝——这样白名单域上的开放重定向就无法把请求
     * 导去内网 / 云元数据地址（SSRF）。跳数上限 {@link #MAX_REDIRECTS} 防重定向环。
     */
    private HttpResponse<String> getFollowingWhitelistedRedirects(URI url, String accept, String referer)
            throws IOException, InterruptedException {
        URI current = url;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            if (!isWhitelistedHost(current.getHost())) {
                throw new IOException("非白名单跳转目标，已拒绝（防 SSRF）：" + current.getHost());
            }
            HttpRequest.Builder builder = HttpRequest.newBuilder(current)
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .header("User-Agent", UA)
                    .header("Accept", accept)
                    .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
            if (referer != null) builder.header("Referer", referer);
            HttpResponse<String> res = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            int sc = res.statusCode();
            if (sc >= 300 && sc < 400) {
                String location = res.headers().firstValue("Location").orElse(null);
                if (location == null || location.isBlank()) return res; // 无 Location，交回调用方按非 2xx 处理
                URI next;
                try {
                    next = current.resolve(location); // 支持相对 Location
                } catch (IllegalArgumentException e) {
                    throw new IOException("重定向 Location 非法，已拒绝：" + location);
                }
                String scheme = next.getScheme();
                if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                    throw new IOException("重定向到非 http(s) 协议，已拒绝：" + next.getScheme());
                }
                current = next; // 下一轮循环开头会重新过白名单
                continue;
            }
            return res;
        }
        throw new IOException("重定向次数过多，已中止：" + url);
    }

    @Override
    public Optional<ProductLinkInfoDto> tryParse(URI url) {
        if (url == null) return Optional.empty();
        String host = url.getHost();
        if (host == null) return Optional.empty();
        if (!isWhitelistedHost(host)) {
            // 不在白名单 → 不处理（防 SSRF）；让 chain 继续到下一个 handler 或最终 fail
            return Optional.empty();
        }

        try {
            HttpResponse<String> res = getFollowingWhitelistedRedirects(
                    url, "text/html,application/xhtml+xml", null);
            if (res.statusCode() < 200 || res.statusCode() >= 300) {
                log.warn("[product-link] douyin scrape non-2xx status={} url={}", res.statusCode(), url);
                return Optional.empty();
            }
            String html = res.body();
            if (html == null || html.isBlank()) return Optional.empty();

            String ogTitle = null;
            String ogImage = null;
            String ogDescription = null;
            Matcher m = META_PATTERN.matcher(html);
            while (m.find()) {
                String prop = m.group(1).toLowerCase();
                String content = m.group(2);
                switch (prop) {
                    case "og:title" -> ogTitle = content;
                    case "og:image" -> ogImage = content;
                    case "og:description" -> ogDescription = content;
                    default -> { /* ignore */ }
                }
            }

            // 尝试解析 window.__INITIAL_STATE__ / _SSR_DATA_，里面可能含价格 / 销量 / 多图
            String title = ogTitle;
            String inferred = ogDescription;
            Integer minPrice = null;
            Integer maxPrice = null;
            Integer sales = null;
            List<String> imageUrls = new ArrayList<>();
            if (ogImage != null && !ogImage.isBlank()) imageUrls.add(ogImage);

            Matcher inlineMatcher = INITIAL_STATE_PATTERN.matcher(html);
            if (inlineMatcher.find()) {
                String inlineJson = inlineMatcher.group(1);
                try {
                    JsonNode root = mapper.readTree(inlineJson);
                    // 抖音页面字段路径不稳定；广搜 title / image / price 字段
                    String detectedTitle = findFirstText(root, Set.of("title", "name", "productName", "itemName"));
                    if (title == null || title.isBlank()) title = detectedTitle;
                    List<String> extraImages = collectImageUrls(root);
                    for (String u : extraImages) {
                        if (!imageUrls.contains(u)) imageUrls.add(u);
                    }
                    Integer detectedMin = findFirstInt(root, Set.of("min_price", "minPrice", "price", "lowPrice"));
                    Integer detectedMax = findFirstInt(root, Set.of("max_price", "maxPrice", "highPrice"));
                    Integer detectedSales = findFirstInt(root, Set.of("sales", "sold", "soldCount"));
                    if (detectedMin != null) minPrice = detectedMin;
                    if (detectedMax != null) maxPrice = detectedMax;
                    if (detectedSales != null) sales = detectedSales;
                } catch (Exception e) {
                    log.debug("[product-link] inline json parse failed: {}", e.getMessage());
                }
            }

            boolean promotionDetailHit = false;
            if (extractPromotionId(url).isPresent()) {
                Optional<ProductLinkInfoDto> detailInfo = fetchPromotionDetail(url);
                if (detailInfo.isPresent()) {
                    ProductLinkInfoDto detail = detailInfo.get();
                    if ((title == null || title.isBlank()) && detail.title() != null) title = detail.title();
                    if ((inferred == null || inferred.isBlank()) && detail.inferredSellingPoints() != null) {
                        inferred = detail.inferredSellingPoints();
                    }
                    if (minPrice == null) minPrice = detail.minPriceCents();
                    if (maxPrice == null) maxPrice = detail.maxPriceCents();
                    if (sales == null) sales = detail.sales();
                    imageUrls.addAll(detail.imageUrls());
                    promotionDetailHit = true;
                }
            }

            // 去重保留前 6 张
            List<String> trimmedImages = new ArrayList<>(new LinkedHashSet<>(imageUrls));
            if (trimmedImages.size() > 6) trimmedImages = trimmedImages.subList(0, 6);

            // 任一关键字段非空才算命中
            boolean hasContent = (title != null && !title.isBlank())
                    || !trimmedImages.isEmpty()
                    || minPrice != null
                    || sales != null;
            if (!hasContent) {
                log.warn("[product-link] douyin scrape no content url={} (DOM may have changed)", url);
                return Optional.empty();
            }

            if (inferred == null || inferred.isBlank()) {
                inferred = composeSellingPoints(minPrice, maxPrice, sales);
            }

            return Optional.of(new ProductLinkInfoDto(
                    title,
                    trimmedImages,
                    minPrice,
                    maxPrice,
                    sales,
                    inferred,
                    promotionDetailHit ? "douyin-promotion-detail" : "douyin-html-scrape"
            ));
        } catch (Exception e) {
            log.warn("[product-link] douyin scrape failed url={} err={}", url, e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<ProductLinkInfoDto> fetchPromotionDetail(URI originalUrl) {
        Optional<String> promotionId = extractPromotionId(originalUrl);
        if (promotionId.isEmpty()) return Optional.empty();

        try {
            String encodedId = URLEncoder.encode(promotionId.get(), StandardCharsets.UTF_8);
            URI apiUrl = URI.create("https://haohuo.jinritemai.com/aweme/v2/shop/promotion/pack/detail/"
                    + "?is_h5=1&promotion_id=" + encodedId);
            HttpResponse<String> res = getFollowingWhitelistedRedirects(
                    apiUrl, "application/json,text/plain,*/*", originalUrl.toString());
            if (res.statusCode() < 200 || res.statusCode() >= 300) {
                log.warn("[product-link] douyin promotion detail non-2xx status={} url={}", res.statusCode(), apiUrl);
                return Optional.empty();
            }
            return parsePromotionDetailResponse(res.body());
        } catch (Exception e) {
            log.warn("[product-link] douyin promotion detail failed url={} err={}", originalUrl, e.getMessage());
            return Optional.empty();
        }
    }

    static Optional<ProductLinkInfoDto> parsePromotionDetailResponse(String body) {
        if (body == null || body.isBlank()) return Optional.empty();

        try {
            ObjectMapper localMapper = new ObjectMapper();
            JsonNode root = localMapper.readTree(body);
            JsonNode statusCode = root.get("status_code");
            if (statusCode != null && statusCode.isNumber() && statusCode.asInt() != 0) {
                return Optional.empty();
            }

            JsonNode detailInfo = root.path("detail_info");
            JsonNode scanRoot = detailInfo.isMissingNode() || detailInfo.isNull() ? root : detailInfo;
            List<String> imageUrls = new ArrayList<>(new LinkedHashSet<>(collectImageUrls(scanRoot)));
            if (imageUrls.size() > 6) imageUrls = imageUrls.subList(0, 6);

            String title = findFirstText(scanRoot, Set.of("title", "name", "productName", "itemName"));
            Integer minPrice = findFirstInt(scanRoot, Set.of("min_price", "minPrice", "price", "lowPrice"));
            Integer maxPrice = findFirstInt(scanRoot, Set.of("max_price", "maxPrice", "highPrice"));
            Integer sales = findFirstInt(scanRoot, Set.of("sales", "sold", "soldCount"));
            boolean hasContent = (title != null && !title.isBlank())
                    || !imageUrls.isEmpty()
                    || minPrice != null
                    || sales != null;
            if (!hasContent) return Optional.empty();

            return Optional.of(new ProductLinkInfoDto(
                    title,
                    imageUrls,
                    minPrice,
                    maxPrice,
                    sales,
                    composeSellingPoints(minPrice, maxPrice, sales),
                    "douyin-promotion-detail"
            ));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    static Optional<String> extractPromotionId(URI url) {
        if (url == null) return Optional.empty();
        String rawQuery = url.getRawQuery();
        if (rawQuery != null) {
            for (String part : rawQuery.split("&")) {
                int idx = part.indexOf('=');
                if (idx <= 0) continue;
                String key = decodeQueryComponent(part.substring(0, idx));
                if (!"id".equals(key) && !"promotion_id".equals(key)) continue;
                String value = decodeQueryComponent(part.substring(idx + 1));
                if (value != null && value.matches("\\d{6,}")) return Optional.of(value);
            }
        }

        String path = url.getPath();
        if (path != null) {
            Matcher matcher = Pattern.compile("(\\d{6,})").matcher(path);
            if (matcher.find()) return Optional.of(matcher.group(1));
        }
        return Optional.empty();
    }

    private static String decodeQueryComponent(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    /** 递归在 JsonNode 树中找第一个 key 命中的文本字段（不区分大小写）。 */
    private static String findFirstText(JsonNode node, Set<String> keys) {
        if (node == null) return null;
        if (node.isObject()) {
            var it = node.fields();
            while (it.hasNext()) {
                var entry = it.next();
                if (keys.contains(entry.getKey()) && entry.getValue().isTextual()) {
                    String v = entry.getValue().asText();
                    if (!v.isBlank()) return v;
                }
                String nested = findFirstText(entry.getValue(), keys);
                if (nested != null) return nested;
            }
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                String nested = findFirstText(item, keys);
                if (nested != null) return nested;
            }
        }
        return null;
    }

    /** 递归在 JsonNode 树中找第一个 key 命中的整数字段。 */
    private static Integer findFirstInt(JsonNode node, Set<String> keys) {
        if (node == null) return null;
        if (node.isObject()) {
            var it = node.fields();
            while (it.hasNext()) {
                var entry = it.next();
                if (keys.contains(entry.getKey())) {
                    JsonNode v = entry.getValue();
                    if (v.isInt() || v.isLong()) return v.asInt();
                }
                Integer nested = findFirstInt(entry.getValue(), keys);
                if (nested != null) return nested;
            }
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                Integer nested = findFirstInt(item, keys);
                if (nested != null) return nested;
            }
        }
        return null;
    }

    /**
     * 递归收集所有看起来像 CDN 图片 URL 的字符串。
     * 启发：以 http(s):// 开头 + 含 `.png|.jpg|.jpeg|.webp` + 长度 > 30。
     */
    private static List<String> collectImageUrls(JsonNode node) {
        List<String> out = new ArrayList<>();
        collectImageUrlsRecurse(node, out);
        return out;
    }

    private static void collectImageUrlsRecurse(JsonNode node, List<String> out) {
        if (node == null) return;
        if (node.isTextual()) {
            String s = node.asText();
            if (looksLikeImageUrl(s)) out.add(s);
        } else if (node.isObject()) {
            var it = node.fields();
            while (it.hasNext()) collectImageUrlsRecurse(it.next().getValue(), out);
        } else if (node.isArray()) {
            for (JsonNode item : node) collectImageUrlsRecurse(item, out);
        }
    }

    private static boolean looksLikeImageUrl(String s) {
        if (s == null || s.length() < 30) return false;
        if (!s.startsWith("http://") && !s.startsWith("https://")) return false;
        String lower = s.toLowerCase();
        return lower.contains(".png") || lower.contains(".jpg")
                || lower.contains(".jpeg") || lower.contains(".webp");
    }

    private static String composeSellingPoints(Integer minPrice, Integer maxPrice, Integer sales) {
        StringBuilder sb = new StringBuilder();
        if (minPrice != null && maxPrice != null) {
            if (minPrice.equals(maxPrice)) sb.append("价格 ").append(formatYuan(minPrice));
            else sb.append("价格 ").append(formatYuan(minPrice)).append("-").append(formatYuan(maxPrice));
        } else if (minPrice != null) {
            sb.append("价格 ").append(formatYuan(minPrice));
        }
        if (sales != null && sales > 0) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append("销量 ").append(formatSales(sales));
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    private static String formatYuan(int cents) {
        int yuan = cents / 100;
        int cs = cents % 100;
        if (cs == 0) return "¥" + yuan;
        return String.format("¥%d.%02d", yuan, cs);
    }

    private static String formatSales(int sales) {
        if (sales >= 10_000) return String.format("%.1fw+", sales / 10_000.0);
        return String.valueOf(sales);
    }
}
