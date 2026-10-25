package com.aistareco.aep.ipstudio.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/** The Studio product image families and their provider model routes. */
public final class StudioImageModelRouting {
    public static final String REQUEST_PREFIX = "studio-image:";
    public static final List<String> TIERS = List.of("1K", "2K", "4K");

    public record Family(String id, String label, Map<String, String> providerModels) {}

    public static final List<Family> FAMILIES = List.of(
            new Family("gpt-image-2", "gpt-image-2", Map.of("1K", "gpt-image-2-1k-pic", "2K", "gpt-image-2-1k-pic", "4K", "gpt-image-2-4k-pic")),
            new Family("gpt-image-2.5-flare", "gpt-image-2.5-flare", Map.of("1K", "gpt-image-2.5-flare-1k", "2K", "gpt-image-2.5-flare-1k", "4K", "gpt-image-2.5-flare-4k")),
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
}
