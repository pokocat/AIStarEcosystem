package com.aistareco.aep.service;

import com.aistareco.aep.dto.ProductLinkInfoDto;
import com.aistareco.aep.service.productlink.ProductLinkExtractFailedException;
import com.aistareco.aep.service.productlink.ProductLinkHandler;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/** ProductLinkService 编排逻辑：scheme 校验 + 多 handler chain + 全 empty 抛错。 */
class ProductLinkServiceTest {

    private static ProductLinkInfoDto sampleHit() {
        return new ProductLinkInfoDto(
                "样例商品", List.of("https://cdn/x.png"),
                990, 990, 100, "价格 ¥9.90", "test-handler"
        );
    }

    @Test
    void rejectsNullOrBlankUrl() {
        ProductLinkService svc = new ProductLinkService(List.of());
        assertThrows(BusinessException.class, () -> svc.parse(null));
        assertThrows(BusinessException.class, () -> svc.parse(""));
        assertThrows(BusinessException.class, () -> svc.parse("   "));
    }

    @Test
    void rejectsNonHttpScheme() {
        ProductLinkService svc = new ProductLinkService(List.of());
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.parse("file:///etc/passwd"));
        assertEquals("PRODUCT_LINK_URL_SCHEME_INVALID", ex.getCode());
    }

    @Test
    void firstHitWinsAndRestSkipped() {
        ProductLinkHandler hit = (u) -> Optional.of(sampleHit());
        // 第二个 handler 抛错也不影响（第一个已命中）
        ProductLinkHandler bomb = (u) -> { throw new RuntimeException("不该被调用"); };
        ProductLinkService svc = new ProductLinkService(List.of(hit, bomb));
        ProductLinkInfoDto result = svc.parse("https://example.com/foo");
        assertEquals("样例商品", result.title());
        assertEquals("test-handler", result.source());
    }

    @Test
    void allEmptyRaisesExtractFailed() {
        ProductLinkHandler empty1 = (u) -> Optional.empty();
        ProductLinkHandler empty2 = (u) -> Optional.empty();
        ProductLinkService svc = new ProductLinkService(List.of(empty1, empty2));
        assertThrows(ProductLinkExtractFailedException.class,
                () -> svc.parse("https://example.com/foo"));
    }

    @Test
    void handlerExceptionDoesNotBreakChain() {
        ProductLinkHandler throwing = (u) -> { throw new RuntimeException("boom"); };
        ProductLinkHandler hit = (u) -> Optional.of(sampleHit());
        ProductLinkService svc = new ProductLinkService(List.of(throwing, hit));
        // 第一个抛错被吞掉 + log，第二个命中
        ProductLinkInfoDto result = svc.parse("https://example.com/foo");
        assertEquals("样例商品", result.title());
    }

    @Test
    void uriValidationCatchesMalformed() {
        ProductLinkService svc = new ProductLinkService(List.of());
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.parse("http://"));
        // host 缺失 → INVALID
        assertTrue(ex.getCode().startsWith("PRODUCT_LINK_URL_"));
    }

    @Test
    @SuppressWarnings("unused")
    void uriWithHostPassesValidation() {
        ProductLinkHandler captureHost = (u) -> {
            assertEquals("example.com", u.getHost());
            return Optional.of(sampleHit());
        };
        ProductLinkService svc = new ProductLinkService(List.of(captureHost));
        ProductLinkInfoDto result = svc.parse("https://example.com/path?q=1");
        assertNotNull(result);
    }
}
