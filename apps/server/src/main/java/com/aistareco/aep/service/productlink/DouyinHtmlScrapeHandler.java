package com.aistareco.aep.service.productlink;

import com.aistareco.aep.dto.ProductLinkInfoDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

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
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Override
    public Optional<ProductLinkInfoDto> tryParse(URI url) {
        if (url == null) return Optional.empty();
        String host = url.getHost();
        if (host == null) return Optional.empty();
        boolean douyin = DOUYIN_HOSTS.stream().anyMatch(h -> host.equals(h) || host.endsWith("." + h));
        if (!douyin) {
            // 不在白名单 → 不处理（防 SSRF）；让 chain 继续到下一个 handler 或最终 fail
            return Optional.empty();
        }

        try {
            HttpRequest req = HttpRequest.newBuilder(url)
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .header("User-Agent", UA)
                    .header("Accept", "text/html,application/xhtml+xml")
                    .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
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
            HttpRequest req = HttpRequest.newBuilder(apiUrl)
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .header("User-Agent", UA)
                    .header("Accept", "application/json,text/plain,*/*")
                    .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                    .header("Referer", originalUrl.toString())
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
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
