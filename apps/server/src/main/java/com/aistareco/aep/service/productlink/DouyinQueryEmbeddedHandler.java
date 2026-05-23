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
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 抖音商城分享长链处理 — query string 内嵌完整 goods_detail JSON。
 *
 * 命中条件：host 含 `jinritemai.com` 或 `douyin.com`，且 query 含 `goods_detail`。
 * 不发任何网络请求，~1ms。
 *
 * 样例 URL（用户提供）：
 *   https://haohuo.jinritemai.com/.../index.html?alkey=...&goods_detail=%7B%22title%22%3A...%7D
 *
 * goods_detail JSON 结构：
 *   {
 *     "title": "一次性水槽过滤网...",
 *     "sales": 2128370,
 *     "img": {
 *       "url_list": ["https://p3-item.../...png", "https://p26-item.../...png"],
 *       "width": 100, "height": 100
 *     },
 *     "min_price": 990,
 *     "max_price": 2890
 *   }
 */
@Component
@Order(10)
public class DouyinQueryEmbeddedHandler implements ProductLinkHandler {

    private static final Logger log = LoggerFactory.getLogger(DouyinQueryEmbeddedHandler.class);
    private static final Set<String> DOUYIN_HOSTS = Set.of("jinritemai.com", "douyin.com");

    private final ObjectMapper mapper;

    public DouyinQueryEmbeddedHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public Optional<ProductLinkInfoDto> tryParse(URI url) {
        if (url == null) return Optional.empty();
        String host = url.getHost();
        if (host == null) return Optional.empty();
        boolean douyin = DOUYIN_HOSTS.stream().anyMatch(h -> host.equals(h) || host.endsWith("." + h));
        if (!douyin) return Optional.empty();

        String goodsDetailRaw = extractQueryParam(url.getRawQuery(), "goods_detail");
        if (goodsDetailRaw == null) return Optional.empty();

        try {
            String decoded = URLDecoder.decode(goodsDetailRaw, StandardCharsets.UTF_8);
            JsonNode root = mapper.readTree(decoded);

            String title = textOrNull(root, "title");
            Integer minPrice = intOrNull(root, "min_price");
            Integer maxPrice = intOrNull(root, "max_price");
            Integer sales = intOrNull(root, "sales");
            List<String> imageUrls = extractImageUrls(root);

            String inferred = composeSellingPoints(minPrice, maxPrice, sales);

            return Optional.of(new ProductLinkInfoDto(
                    title,
                    imageUrls,
                    minPrice,
                    maxPrice,
                    sales,
                    inferred,
                    "douyin-query-embedded"
            ));
        } catch (Exception e) {
            log.warn("[product-link] douyin query parse failed url={} err={}", url, e.getMessage());
            return Optional.empty();
        }
    }

    /** 从 raw query string 提取指定参数的原始值（不做 decode），找不到返回 null。 */
    private static String extractQueryParam(String rawQuery, String key) {
        if (rawQuery == null) return null;
        String prefix = key + "=";
        for (String pair : rawQuery.split("&")) {
            if (pair.startsWith(prefix)) {
                return pair.substring(prefix.length());
            }
        }
        return null;
    }

    /**
     * goods_detail.img.url_list[] 优先 p3- 域名（CDN 命中率高），其它作备图。
     * 去重保持顺序。
     */
    private static List<String> extractImageUrls(JsonNode root) {
        JsonNode urlList = root.path("img").path("url_list");
        if (!urlList.isArray() || urlList.isEmpty()) return List.of();
        Set<String> p3 = new LinkedHashSet<>();
        Set<String> others = new LinkedHashSet<>();
        for (JsonNode item : urlList) {
            String u = item.asText();
            if (u == null || u.isBlank()) continue;
            if (u.contains("//p3-")) p3.add(u);
            else others.add(u);
        }
        List<String> merged = new ArrayList<>(p3);
        for (String u : others) {
            if (!merged.contains(u)) merged.add(u);
        }
        return merged;
    }

    private static String composeSellingPoints(Integer minPrice, Integer maxPrice, Integer sales) {
        StringBuilder sb = new StringBuilder();
        if (minPrice != null && maxPrice != null) {
            if (minPrice.equals(maxPrice)) {
                sb.append("价格 ").append(formatYuan(minPrice));
            } else {
                sb.append("价格 ").append(formatYuan(minPrice))
                        .append("-").append(formatYuan(maxPrice));
            }
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
        if (sales >= 10_000) {
            return String.format("%.1fw+", sales / 10_000.0);
        }
        return String.valueOf(sales);
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static Integer intOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() || !v.isInt() && !v.isLong() ? null : v.asInt();
    }
}
