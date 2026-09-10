package com.aistareco.aep.clip.dto;

import java.util.List;
import java.util.Map;

public final class ClipRequests {
    private ClipRequests() {}
    public record CreateProject(String templateId) {}
    public record SaveProject(Map<String, String> variables, List<Map<String, Object>> segments,
                              List<Map<String, Object>> shots, List<Map<String, Object>> scriptChat,
                              String avatarId, String voiceId, String bgmAssetId,
                              Map<String, Object> subtitleStyle, Map<String, Object> cover,
                              Integer step, String title) {}
    public record Rewrite(String scope, Integer no, String text) {}
    public record PreviewVoice(Integer no, String text) {}
    public record Estimate(List<Map<String, Object>> segments, List<Map<String, Object>> shots) {}
    public record Render(String clientRequestId, Integer externalCreditsHeld) {}
    /**
     * 段级生成。{@code model} 决定用哪条引擎链，其余字段按 model 取用：
     * avatar 用 avatarId/voiceId/text，t2i/t2v 用 prompt，i2v 用 prompt+refAssetId。
     * {@code fingerprint} 是端上算的缓存键 —— 同一镜同指纹直接回产物，不重跑也不重扣。
     */
    public record GenerateShot(String model, String prompt, String refAssetId, String avatarId, String voiceId,
                               String text, String fingerprint, String clientRequestId, Integer expectedCredits) {}
    public record Assemble(String clientRequestId, Integer expectedCredits) {}
    public record CreateCloneUpload(String kind, String clientRequestId, String fileName, String contentType, Long sizeBytes) {}
    public record SubmitCloneUpload(String clientRequestId, String avatarId, String voiceId, String name, String voiceSource) {}
    public record UpdateAsset(String label, String tag) {}
    public record Publish(String platform) {}
    public record UpsertTemplate(String id, String name, String industry, String themeKey, String description,
                                 String status, String ownerScope, Map<String, Object> scriptSkeleton,
                                 Map<String, Object> timeline, List<Map<String, Object>> tailClips,
                                 List<String> brollPool, String ratio, Integer estDurationSec,
                                 Integer avatarSecHint, Integer creditHint) {}
}
