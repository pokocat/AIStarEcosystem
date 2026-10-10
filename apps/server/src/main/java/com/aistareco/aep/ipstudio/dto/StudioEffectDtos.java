package com.aistareco.aep.ipstudio.dto;

import java.time.Instant;
import java.util.List;

/** Wire truth: packages/types/src/ip-studio-effect.ts. These are editable prompt instructions, not native supplier effects. */
public final class StudioEffectDtos {
    private StudioEffectDtos() {}
    public record Effect(String id,String name,String summary,String prompt,String author,String visibility,
                         List<String> tags,List<String> models,String previewKey,String previewUrl,
                         boolean favorite,Instant lastUsedAt,Instant createdAt) {}
    public record Publish(String name,String summary,String prompt,List<String> tags,List<String> models,String visibility,String previewKey) {}
    public record Favorite(boolean favorite) {}
    public record Apply(String model) {}
}
