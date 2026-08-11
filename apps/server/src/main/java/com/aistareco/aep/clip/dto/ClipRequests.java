package com.aistareco.aep.clip.dto;

import java.util.List;
import java.util.Map;

public final class ClipRequests {
    private ClipRequests() {}
    public record CreateProject(String templateId) {}
    public record SaveProject(Map<String, String> variables, List<Map<String, Object>> segments,
                              String avatarId, String voiceId, String bgmAssetId,
                              Map<String, Object> subtitleStyle, Integer step, String title) {}
    public record Rewrite(String scope, Integer no, String text) {}
    public record PreviewVoice(Integer no, String text) {}
    public record Estimate(List<Map<String, Object>> segments) {}
    public record Render(String clientRequestId, Integer externalCreditsHeld) {}
    public record UpdateAsset(String label, String tag) {}
    public record Publish(String platform) {}
    public record UpsertTemplate(String id, String name, String industry, String themeKey, String description,
                                 String status, String ownerScope, Map<String, Object> scriptSkeleton,
                                 Map<String, Object> timeline, List<Map<String, Object>> tailClips,
                                 List<String> brollPool, String ratio, Integer estDurationSec,
                                 Integer avatarSecHint, Integer creditHint) {}
}
