package com.aistareco.aep.videostudio;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioPricingConfig;
import com.aistareco.aep.videostudio.service.VideoStudioPricing;
import com.aistareco.aep.videostudio.service.VideoStudioPricingService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 视频生成区计价（docs/video-studio-plan.md §3，二版：我们自己定、后台可配）。
 * 回落链：配置格子 → 模型每秒价 → 未定价（503，不回落写死的价）；后台保存的校验；库里的配置读不出来时失败关闭。
 */
class VideoStudioPricingTest {

    private static Map<String, Map<String, Long>> cells(Object... modeTierPrice) {
        Map<String, Map<String, Long>> out = new LinkedHashMap<>();
        for (int i = 0; i < modeTierPrice.length; i += 3) {
            out.computeIfAbsent((String) modeTierPrice[i], k -> new HashMap<>())
                    .put((String) modeTierPrice[i + 1], (Long) modeTierPrice[i + 2]);
        }
        return out;
    }

    private static VideoStudioPricingConfig config(Map<String, Map<String, Long>> perSecond, Integer free, Long extra, Long opt) {
        return new VideoStudioPricingConfig(perSecond, free, extra, opt);
    }

    @Nested
    class Effective {

        @Test
        @DisplayName("每一格 = 配置 ?? 模型每秒价 ?? null；四种模式 × 两档都在，顺序固定")
        void fallbackChain() {
            VideoStudioPricingConfig cfg = VideoStudioPricing.validate(
                    config(cells("t2v", "768p", 50L), 6, 10L, 3L));
            VideoStudioDtos.VideoStudioPricing withRate = VideoStudioPricing.effective(cfg, 40L);
            assertEquals(50L, withRate.perSecond().get("t2v").get("768p"));
            assertEquals(40L, withRate.perSecond().get("t2v").get("544p"));
            assertEquals(40L, withRate.perSecond().get("universal_reference_video").get("544p"));
            assertEquals(6, withRate.freeRefImages());
            assertEquals(10L, withRate.extraRefImagePerSecond());
            assertEquals(3L, withRate.promptOptimizationPerCall());
            assertEquals(java.util.List.of("t2v", "i2v", "first_last_frame_video", "universal_reference_video"),
                    java.util.List.copyOf(withRate.perSecond().keySet()));

            VideoStudioDtos.VideoStudioPricing noRate = VideoStudioPricing.effective(cfg, null);
            assertEquals(50L, noRate.perSecond().get("t2v").get("768p"));
            assertNull(noRate.perSecond().get("t2v").get("544p"));
            assertNull(noRate.perSecond().get("i2v").get("768p"));
        }

        @Test
        @DisplayName("默认配置：全空 / 0 —— 生成按模型单价、不加价、优化不收费")
        void defaults() {
            VideoStudioPricingConfig d = VideoStudioPricing.defaults();
            assertEquals(4, d.perSecond().size());
            d.perSecond().values().forEach(row -> {
                assertEquals(2, row.size());
                row.values().forEach(v -> assertNull(v));
            });
            assertEquals(0, d.freeRefImages());
            assertEquals(0L, d.extraRefImagePerSecond());
            assertEquals(0L, d.promptOptimizationPerCall());
        }
    }

    @Nested
    class Total {

        private final VideoStudioDtos.VideoStudioPricing pricing = VideoStudioPricing.effective(
                VideoStudioPricing.validate(config(cells("t2v", "544p", 20L), 6, 10L, 0L)), 40L);

        @Test
        @DisplayName("(每秒价 + 超出张数 × 加价) × 秒数；加价由模式素材规则决定")
        void formula() {
            assertEquals(200L, VideoStudioPricing.total(pricing, "t2v", "768p", 5, 0, false));
            assertEquals(100L, VideoStudioPricing.total(pricing, "t2v", "544p", 5, 0, false));
            assertEquals(300L, VideoStudioPricing.total(pricing, "universal_reference_video", "768p", 5, 8, true));
            assertEquals(200L, VideoStudioPricing.total(pricing, "universal_reference_video", "768p", 5, 6, true));
            assertEquals(200L, VideoStudioPricing.total(pricing, "i2v", "768p", 5, 9, false), "无多参考规则不加价");
            assertEquals(350L, VideoStudioPricing.total(pricing, "i2v", "768p", 5, 9, true),
                    "自定义协议即使复用旧模式名，也按配置的参考素材规则加价");
        }

        @Test
        @DisplayName("这一格没定价 → 503 VIDEO_STUDIO_PRICE_NOT_CONFIGURED；乘法溢出 → 400 VIDEO_PRICE_OVERFLOW")
        void unpricedAndOverflow() {
            VideoStudioDtos.VideoStudioPricing unpriced = VideoStudioPricing.effective(VideoStudioPricing.defaults(), null);
            assertEquals("VIDEO_STUDIO_PRICE_NOT_CONFIGURED", assertThrows(BusinessException.class,
                    () -> VideoStudioPricing.total(unpriced, "t2v", "768p", 5, 0, false)).getCode());
            assertEquals("VIDEO_STUDIO_PRICE_NOT_CONFIGURED", assertThrows(BusinessException.class,
                    () -> VideoStudioPricing.total(pricing, "nope", "768p", 5, 0, false)).getCode());
            VideoStudioDtos.VideoStudioPricing huge = VideoStudioPricing.effective(VideoStudioPricing.defaults(), Long.MAX_VALUE / 2);
            assertEquals("VIDEO_PRICE_OVERFLOW", assertThrows(BusinessException.class,
                    () -> VideoStudioPricing.total(huge, "t2v", "768p", 5, 0, false)).getCode());
        }
    }

    @Nested
    class Validate {

        private String code(VideoStudioPricingConfig c) {
            return assertThrows(BusinessException.class, () -> VideoStudioPricing.validate(c)).getCode();
        }

        @Test
        @DisplayName("后台保存：负数、缺项及非法模式或清晰度 → VIDEO_STUDIO_PRICING_INVALID")
        void rejects() {
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(null));
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(config(null, 0, 0L, 0L)));
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(config(cells("t2v", "768p", 0L), 0, 0L, 0L)));
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(config(cells("t2v", "bad tier", 10L), 0, 0L, 0L)));
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(config(cells("bad mode", "768p", 10L), 0, 0L, 0L)));
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(config(Map.of(), -1, 0L, 0L)));
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(config(Map.of(), null, 0L, 0L)));
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(config(Map.of(), 0, -1L, 0L)));
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(config(Map.of(), 0, null, 0L)));
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(config(Map.of(), 0, 0L, -1L)));
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", code(config(Map.of(), 0, 0L, null)));
        }

        @Test
        @DisplayName("合法值补齐旧模式与清晰度，且不限制运营配置的单价和免费参考图数量")
        void normalizes() {
            VideoStudioPricingConfig out = VideoStudioPricing.validate(
                    config(cells("i2v", "544p", 1L, "t2v", "768p", 100_001L), 12, 100_001L, 100_001L));
            assertEquals(4, out.perSecond().size());
            assertEquals(1L, out.perSecond().get("i2v").get("544p"));
            assertNull(out.perSecond().get("i2v").get("768p"));
            assertEquals(100_001L, out.perSecond().get("t2v").get("768p"));
            assertEquals(12, out.freeRefImages());
            assertEquals(100_001L, out.extraRefImagePerSecond());
            assertEquals(100_001L, out.promptOptimizationPerCall());
        }

        @Test
        void keepsConfiguredSeedanceResolutionPrice() {
            var out = VideoStudioPricing.validate(config(cells("t2v", "720p", 25L), 0, 0L, 0L));
            assertEquals(25L, out.perSecond().get("t2v").get("720p"));
            var contract = new VideoStudioDtos.VideoStudioContract(
                    java.util.List.of(new VideoStudioDtos.VideoStudioModeSpec("t2v", false, false, null, null)),
                    java.util.List.of(new VideoStudioDtos.VideoStudioTier("720p",
                            java.util.List.of(new VideoStudioDtos.VideoStudioCanvas("16:9", 1280, 720)))),
                    4, 15, 2000, 4294967295L);
            assertEquals(25L, VideoStudioPricing.effective(out, null, contract).perSecond().get("t2v").get("720p"));
        }

        @Test
        void keepsCustomModePriceForConfiguredContract() {
            var out = VideoStudioPricing.validate(config(cells("custom_motion", "720p", 25L), 1, 3L, 0L));
            var contract = new VideoStudioDtos.VideoStudioContract(
                    java.util.List.of(new VideoStudioDtos.VideoStudioModeSpec("custom_motion", false, false, null, null,
                            "运动参考")),
                    java.util.List.of(new VideoStudioDtos.VideoStudioTier("720p",
                            java.util.List.of(new VideoStudioDtos.VideoStudioCanvas("16:9", 1280, 720)))),
                    4, 15, 2000, 4294967295L);
            var effective = VideoStudioPricing.effective(out, null, contract);
            assertEquals(25L, effective.perSecond().get("custom_motion").get("720p"));
            assertEquals(125L, VideoStudioPricing.total(effective, "custom_motion", "720p", 5, 0, false));
        }
    }

    @Nested
    class ConfigService {

        private final ObjectMapper om = new ObjectMapper();
        private final PlatformConfigService platformConfig = mock(PlatformConfigService.class);
        private final VideoStudioPricingService svc = new VideoStudioPricingService(platformConfig);

        private void stored(String json) throws Exception {
            when(platformConfig.findByKey(VideoStudioPricingService.CONFIG_KEY)).thenReturn(Optional.of(
                    new PlatformConfigDto(VideoStudioPricingService.CONFIG_KEY, om.readTree(json), 1, "d", Instant.now(), "x")));
        }

        @Test
        @DisplayName("首次启动写入默认值（全 null / 0，null 格子原样落库）")
        void seedsDefaults() throws Exception {
            Method seed = VideoStudioPricingService.class.getDeclaredMethod("seedIfAbsent");
            seed.setAccessible(true);
            seed.invoke(svc);
            ArgumentCaptor<JsonNode> value = ArgumentCaptor.forClass(JsonNode.class);
            verify(platformConfig).seedIfAbsent(eq(VideoStudioPricingService.CONFIG_KEY), value.capture(), anyString());
            JsonNode v = value.getValue();
            assertTrue(v.path("perSecond").path("t2v").has("768p") && v.path("perSecond").path("t2v").get("768p").isNull());
            assertEquals(0, v.path("promptOptimizationPerCall").asInt(-1));
        }

        @Test
        @DisplayName("库里没有这条 → 默认值；有就按库；60 秒内不重复读库")
        void readsAndCaches() throws Exception {
            when(platformConfig.findByKey(VideoStudioPricingService.CONFIG_KEY)).thenReturn(Optional.empty());
            assertEquals(VideoStudioPricing.defaults(), svc.current());

            VideoStudioPricingService fresh = new VideoStudioPricingService(platformConfig);
            stored("{\"perSecond\":{\"t2v\":{\"768p\":30},\"gone_mode\":{\"768p\":5}},\"freeRefImages\":6,"
                    + "\"extraRefImagePerSecond\":10,\"promptOptimizationPerCall\":2,\"futureField\":1}");
            VideoStudioPricingConfig c = fresh.current();
            assertEquals(30L, c.perSecond().get("t2v").get("768p"));
            assertEquals(5L, c.perSecond().get("gone_mode").get("768p"), "自定义模式从存储中读回");
            assertEquals(2L, c.promptOptimizationPerCall());
            fresh.current();
            verify(platformConfig, times(2)).findByKey(VideoStudioPricingService.CONFIG_KEY);
        }

        @Test
        @DisplayName("库里的配置读不出来 / 值越界 → 503 VIDEO_STUDIO_PRICE_NOT_CONFIGURED（失败关闭，不回落「不加价、优化免费」的默认值）")
        void storedGarbageFailsClosed() throws Exception {
            stored("{\"perSecond\":{\"t2v\":{\"768p\":\"abc\"}}}");
            assertEquals("VIDEO_STUDIO_PRICE_NOT_CONFIGURED",
                    assertThrows(BusinessException.class, svc::current).getCode());
            VideoStudioPricingService other = new VideoStudioPricingService(platformConfig);
            stored("{\"perSecond\":{},\"promptOptimizationPerCall\":-5}");
            assertEquals("VIDEO_STUDIO_PRICE_NOT_CONFIGURED",
                    assertThrows(BusinessException.class, other::current).getCode());
        }

        @Test
        @DisplayName("后台整份替换：非法 → 400 且不落库；合法 → 落库补齐后的配置，缓存立即换成新值")
        void replace() throws Exception {
            assertEquals("VIDEO_STUDIO_PRICING_INVALID", assertThrows(BusinessException.class,
                    () -> svc.replace(config(cells("t2v", "768p", 0L), 0, 0L, 0L), "admin1")).getCode());
            verify(platformConfig, never()).upsert(anyString(), any(), anyString(), anyString());

            VideoStudioPricingConfig saved = svc.replace(config(cells("t2v", "768p", 25L), 0, 0L, 4L), "admin1");
            ArgumentCaptor<JsonNode> value = ArgumentCaptor.forClass(JsonNode.class);
            verify(platformConfig).upsert(eq(VideoStudioPricingService.CONFIG_KEY), value.capture(), anyString(), eq("admin1"));
            assertEquals(25, value.getValue().path("perSecond").path("t2v").path("768p").asInt());
            assertTrue(value.getValue().path("perSecond").path("i2v").get("544p").isNull());
            assertEquals(saved, svc.current());
            verify(platformConfig, never()).findByKey(anyString());
        }
    }
}
