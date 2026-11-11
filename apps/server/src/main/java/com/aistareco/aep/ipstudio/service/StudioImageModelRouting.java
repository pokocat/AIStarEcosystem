package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** The Studio product image families and their provider model routes. */
public final class StudioImageModelRouting {
    public static final String REQUEST_PREFIX = "studio-image:";
    public static final String PRICING_CONFIG_KEY = "studio.image-resolution-pricing";
    public static final List<String> TIERS = List.of("1K", "2K", "4K");

    public record Family(String id, String label, Map<String, String> providerModels) {}

    public static final List<Family> FAMILIES = List.of(
            new Family("gpt-image-2", "GPT Image 2", Map.of("1K", "gpt-image-2-1k-pic", "2K", "gpt-image-2-1k-pic", "4K", "gpt-image-2-4k-pic")),
            new Family("gpt-image-2.5-flare", "GPT Image 2.5", Map.of("1K", "gpt-image-2.5-flare-1k", "2K", "gpt-image-2.5-flare-1k", "4K", "gpt-image-2.5-flare-4k")),
            new Family("gpt-image-2.5-sunburst", "gpt-image-2.5-sunburst", Map.of("1K", "gpt-image-2.5-sunburst-1k", "2K", "gpt-image-2.5-sunburst-1k", "4K", "gpt-image-2.5-sunburst-4k"))
    );

    private StudioImageModelRouting() {}

    public static Family family(String id) {
        if (id == null) return null;
        String normalized = id.startsWith(REQUEST_PREFIX) ? id.substring(REQUEST_PREFIX.length()) : id;
        return FAMILIES.stream().filter(f -> f.id().equals(normalized)).findFirst().orElse(null);
    }

    public static Family familyForProviderModel(String model) {
        if (model == null) return null;
        String normalized = model.trim().toLowerCase(Locale.ROOT);
        return FAMILIES.stream().filter(f -> f.providerModels().containsValue(normalized)).findFirst().orElse(null);
    }

    public static String tierForSize(String size) {
        if (size == null) return null;
        String[] dimensions = size.toLowerCase(Locale.ROOT).split("x", -1);
        if (dimensions.length != 2) return null;
        try {
            int edge = Math.max(Integer.parseInt(dimensions[0]), Integer.parseInt(dimensions[1]));
            return edge >= 3840 ? "4K" : edge >= 1920 ? "2K" : edge >= 1024 ? "1K" : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    public static boolean isProductRequest(String model) {
        return model != null && model.startsWith(REQUEST_PREFIX) && family(model) != null;
    }

    /** Platform credits per delivered image, keyed by product family and resolution tier. */
    public static Map<String, Map<String, Long>> resolutionPrices(JsonNode value) {
        if (value == null || !value.isObject()) throw invalidPricing();
        Map<String, Map<String, Long>> result = new LinkedHashMap<>();
        value.fields().forEachRemaining(entry -> {
            Family family = family(entry.getKey());
            JsonNode tiers = entry.getValue();
            if (family == null || !family.id().equals(entry.getKey()) || !tiers.isObject()
                    || tiers.size() != TIERS.size()) throw invalidPricing();
            Map<String, Long> prices = new LinkedHashMap<>();
            for (String tier : TIERS) {
                JsonNode price = tiers.path(tier);
                if (!price.isIntegralNumber() || !price.canConvertToLong() || price.longValue() <= 0) {
                    throw invalidPricing();
                }
                prices.put(tier, price.longValue());
            }
            result.put(family.id(), Map.copyOf(prices));
        });
        return Map.copyOf(result);
    }

    private static BusinessException invalidPricing() {
        return BusinessException.badRequest("STUDIO_IMAGE_PRICING_INVALID", "请为所选图片系列填写 1K、2K 和 4K 的正整数积分售价");
    }
}
