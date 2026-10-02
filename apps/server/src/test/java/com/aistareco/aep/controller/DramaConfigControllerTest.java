package com.aistareco.aep.controller;

import com.aistareco.aep.config.DramaConfigSeeder;
import com.aistareco.aep.service.PlatformConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * /me/drama/config 的报价必须和扣费读同一个 key、同一个默认值 ——
 * 互动剧「AI 起草分支图」的确认框以前拿不到单价，只能写死一个数。
 */
class DramaConfigControllerTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private JsonNode prices(PlatformConfigService configs) {
        return new DramaConfigController(configs, OM).config().data().path("prices");
    }

    @Test
    void interactiveDraftPriceFollowsTheConfiguredValue() {
        PlatformConfigService configs = mock(PlatformConfigService.class);
        when(configs.getLong(anyString(), anyLong())).thenAnswer(inv -> inv.getArgument(1, Long.class));
        when(configs.getLong(eq(DramaConfigSeeder.KEY_INTERACTIVE_DRAFT), anyLong())).thenReturn(25L);

        assertEquals(25, prices(configs).path("interactiveDraft").asLong());
    }

    @Test
    void interactiveDraftPriceDefaultsToWhatTheChargeUses() {
        PlatformConfigService configs = mock(PlatformConfigService.class);
        when(configs.getLong(anyString(), anyLong())).thenAnswer(inv -> inv.getArgument(1, Long.class));

        JsonNode prices = prices(configs);
        assertTrue(prices.has("interactiveDraft"));
        assertEquals(DramaConfigSeeder.DEFAULT_INTERACTIVE_DRAFT, prices.path("interactiveDraft").asLong());
        // 已有字段不受影响
        assertEquals(10, prices.path("shortEntry").asLong());
    }
}
