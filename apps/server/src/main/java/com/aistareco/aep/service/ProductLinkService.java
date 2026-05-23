package com.aistareco.aep.service;

import com.aistareco.aep.dto.ProductLinkInfoDto;
import com.aistareco.aep.service.productlink.ProductLinkExtractFailedException;
import com.aistareco.aep.service.productlink.ProductLinkHandler;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Optional;

/**
 * 商品链接解析编排服务。
 *
 * 注入 {@link ProductLinkHandler} 的有序列表（Spring 按 @Order 排序），依次试每个 handler：
 *   - 命中 → 返回 ProductLinkInfoDto，停止
 *   - 全 empty → 抛 ProductLinkExtractFailedException
 *
 * URL 校验：必须是 http/https；其它 scheme 直接 400。
 *
 * 安全：handler 内部各自做 host 白名单（防 SSRF）；本层只做 scheme + 基本格式校验。
 */
@Service
public class ProductLinkService {

    private static final Logger log = LoggerFactory.getLogger(ProductLinkService.class);

    private final List<ProductLinkHandler> handlers;

    /** Spring 自动注入按 @Order 排序的 handler 列表。 */
    public ProductLinkService(List<ProductLinkHandler> handlers) {
        this.handlers = handlers;
    }

    public ProductLinkInfoDto parse(String urlStr) {
        URI uri = parseAndValidate(urlStr);
        for (ProductLinkHandler h : handlers) {
            try {
                Optional<ProductLinkInfoDto> hit = h.tryParse(uri);
                if (hit.isPresent()) {
                    log.info("[product-link] hit handler={} for url={}",
                            h.getClass().getSimpleName(), urlStr);
                    return hit.get();
                }
            } catch (Exception e) {
                // handler 异常不应阻塞 chain；记录并继续
                log.warn("[product-link] handler {} threw err={}",
                        h.getClass().getSimpleName(), e.getMessage());
            }
        }
        throw new ProductLinkExtractFailedException();
    }

    private static URI parseAndValidate(String urlStr) {
        if (urlStr == null || urlStr.isBlank()) {
            throw BusinessException.badRequest("PRODUCT_LINK_URL_REQUIRED", "url 不能为空");
        }
        URI uri;
        try {
            uri = new URI(urlStr.trim());
        } catch (URISyntaxException e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "PRODUCT_LINK_URL_INVALID", "url 格式不合法");
        }
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equals("http") || scheme.equals("https"))) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "PRODUCT_LINK_URL_SCHEME_INVALID", "仅支持 http / https 链接");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "PRODUCT_LINK_URL_INVALID", "url 缺失 host");
        }
        return uri;
    }
}
