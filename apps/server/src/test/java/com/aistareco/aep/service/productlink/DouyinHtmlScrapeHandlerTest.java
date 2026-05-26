package com.aistareco.aep.service.productlink;

import com.aistareco.aep.dto.ProductLinkInfoDto;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/** 抖音 PC 选品库详情页 SPA 化后的 promotion detail API 兜底解析。 */
class DouyinHtmlScrapeHandlerTest {

    @Test
    void extractsPromotionIdFromPcSelectionUrl() {
        Optional<String> promotionId = DouyinHtmlScrapeHandler.extractPromotionId(URI.create(
                "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html"
                        + "?id=3485332505048038713&origin_type=pc_buyin_selection_decision"
        ));

        assertEquals(Optional.of("3485332505048038713"), promotionId);
    }

    @Test
    void parsesPromotionDetailImagesFromDetailApiResponse() {
        String json = """
                {
                  "status_code": 0,
                  "detail_info": {
                    "detail_imgs": [
                      {"url_list": [
                        "https://p3-item.ecombdimg.com/img/example-1.jpeg~tplv.jpeg",
                        "https://p9-item.ecombdimg.com/img/example-1.jpeg~tplv.jpeg"
                      ]},
                      {"url_list": [
                        "https://p3-item.ecombdimg.com/img/example-2.webp"
                      ]}
                    ],
                    "title_image": {
                      "url_list": ["https://p3-item.ecombdimg.com/img/title.png"]
                    }
                  }
                }
                """;

        Optional<ProductLinkInfoDto> result = DouyinHtmlScrapeHandler.parsePromotionDetailResponse(json);

        assertTrue(result.isPresent());
        ProductLinkInfoDto info = result.get();
        assertEquals("douyin-promotion-detail", info.source());
        assertEquals(4, info.imageUrls().size());
        assertTrue(info.imageUrls().get(0).contains("example-1.jpeg"));
        assertTrue(info.imageUrls().get(2).contains("example-2.webp"));
    }

    @Test
    void ignoresFailedPromotionDetailApiResponse() {
        Optional<ProductLinkInfoDto> result = DouyinHtmlScrapeHandler.parsePromotionDetailResponse("""
                {"status_code": 1001, "status_msg": "not found"}
                """);

        assertTrue(result.isEmpty());
    }
}
