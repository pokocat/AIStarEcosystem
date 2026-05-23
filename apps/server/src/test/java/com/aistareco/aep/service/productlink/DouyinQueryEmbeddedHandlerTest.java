package com.aistareco.aep.service.productlink;

import com.aistareco.aep.dto.ProductLinkInfoDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/** 验证形态 A（query 内嵌 goods_detail）的纯前端 parse 逻辑。无外网。 */
class DouyinQueryEmbeddedHandlerTest {

    private final DouyinQueryEmbeddedHandler handler = new DouyinQueryEmbeddedHandler(new ObjectMapper());

    @Test
    void parsesGoodsDetailFromLongShareUrl() throws Exception {
        // 用户提供的真实样例 URL（裁短）；goods_detail 是 URL-encoded JSON
        String url = "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html"
                + "?alkey=1128"
                + "&goods_detail=%7B%22title%22%3A%22%E4%B8%80%E6%AC%A1%E6%80%A7%E6%B0%B4%E6%A7%BD%E8%BF%87%E6%BB%A4%E7%BD%91%22"
                + "%2C%22sales%22%3A2128370"
                + "%2C%22img%22%3A%7B%22url_list%22%3A%5B"
                + "%22https%3A%2F%2Fp3-item.ecombdimg.com%2Fimg%2Ffoo.png%22"
                + "%2C%22https%3A%2F%2Fp26-item.ecombdimg.com%2Fimg%2Ffoo.png%22"
                + "%5D%7D"
                + "%2C%22min_price%22%3A990"
                + "%2C%22max_price%22%3A2890%7D";

        Optional<ProductLinkInfoDto> result = handler.tryParse(URI.create(url));

        assertTrue(result.isPresent(), "应命中 query-embedded handler");
        ProductLinkInfoDto info = result.get();
        assertEquals("一次性水槽过滤网", info.title());
        assertEquals(990, info.minPriceCents());
        assertEquals(2890, info.maxPriceCents());
        assertEquals(2128370, info.sales());
        // p3- 域名应优先
        assertFalse(info.imageUrls().isEmpty());
        assertTrue(info.imageUrls().get(0).contains("p3-item"));
        // 价格 + 销量推导卖点
        assertNotNull(info.inferredSellingPoints());
        assertTrue(info.inferredSellingPoints().contains("价格"));
        assertTrue(info.inferredSellingPoints().contains("销量"));
        assertEquals("douyin-query-embedded", info.source());
    }

    @Test
    void returnsEmptyForShortUrlWithoutGoodsDetail() {
        // PC 选品库短链：没有 goods_detail，应交给下一个 handler 处理（本 handler 不命中）
        String url = "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html"
                + "?id=3737779702866247934&origin_type=pc_buyin_selection_decision";
        Optional<ProductLinkInfoDto> result = handler.tryParse(URI.create(url));
        assertTrue(result.isEmpty(), "短链没有 goods_detail，本 handler 不应命中");
    }

    @Test
    void returnsEmptyForNonDouyinHost() {
        Optional<ProductLinkInfoDto> result = handler.tryParse(URI.create("https://taobao.com/item.htm?id=123"));
        assertTrue(result.isEmpty(), "非抖音域名直接 empty");
    }

    @Test
    void returnsEmptyForMalformedJson() {
        // goods_detail=not-json 这种坏数据应被 catch 住返回 empty
        Optional<ProductLinkInfoDto> result = handler.tryParse(
                URI.create("https://haohuo.jinritemai.com/?goods_detail=%7Bnot-json"));
        assertTrue(result.isEmpty());
    }
}
