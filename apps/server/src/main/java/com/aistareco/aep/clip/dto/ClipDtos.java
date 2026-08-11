package com.aistareco.aep.clip.dto;

import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.service.ClipShotPlan;
import java.time.Instant;
import java.util.*;

/** packages/types/src/clip.ts 的 Spring wire 镜像；字段名与可空性保持一致。 */
public final class ClipDtos {
    private ClipDtos() {}

    public record TemplateDto(
            String id, String name, String industry, String themeKey, String description,
            String status, String ownerScope, Map<String, Object> scriptSkeleton,
            Map<String, Object> timeline, List<Map<String, Object>> tailClips, List<String> brollPool,
            String previewCoverUrl, String previewVideoUrl, String ratio, int estDurationSec,
            int avatarSecHint, Integer creditHint, int segmentCount
    ) {
        public static TemplateDto from(ClipTemplate t, String coverUrl, String videoUrl) {
            Map<String, Object> skeleton = safeMap(t.getScriptSkeletonJson());
            return new TemplateDto(t.getId(), t.getName(), t.getIndustry(), t.getThemeKey(), t.getDescription(),
                    t.getStatus(), t.getOwnerScope(), skeleton, safeMap(t.getTimelineJson()),
                    mapList(t.getTailClipsJson(), "items"), stringList(t.getBrollPoolJson(), "items"),
                    coverUrl, videoUrl, t.getRatio(), t.getEstDurationSec(), t.getAvatarSecHint(),
                    t.getCreditHint(), list(skeleton.get("segments")).size());
        }
    }

    public record ProjectDto(
            String id, String templateId, String templateName, String title, String status,
            Map<String, String> variables, List<Map<String, Object>> segments,
            List<Map<String, Object>> shots, List<Map<String, Object>> scriptChat,
            String avatarId, String voiceId, String bgmAssetId, Map<String, Object> subtitleStyle,
            int durationSec, int avatarSeconds, int segmentCount, int progress, int step, String updatedAt
    ) {
        public static ProjectDto from(ClipProject p) {
            Map<String, Object> payload = safeMap(p.getPayloadJson());
            return new ProjectDto(p.getId(), p.getTemplateId(), p.getTemplateName(), p.getTitle(), p.getStatus(),
                    stringMap(payload.get("variables")), mapListValue(payload.get("segments")),
                    ClipShotPlan.shots(payload), mapListValue(payload.get("scriptChat")),
                    string(payload.get("avatarId")), string(payload.get("voiceId")), string(payload.get("bgmAssetId")),
                    safeMapValue(payload.get("subtitleStyle")), p.getDurationSec(), p.getAvatarSeconds(),
                    p.getSegmentCount(), p.getProgress(), p.getStep(), iso(p.getUpdatedAt()));
        }
    }

    public record EstimateItem(String key, String label, int credits, String freeText) {}
    public record EstimateSummary(int totalSec, int avatarSec, int tailSec, int avatarCount, int brollCount, int tailCount, int chars) {}
    public record EstimateDto(List<EstimateItem> items, int total, EstimateSummary summary) {}
    public record RenderResult(String jobId, String projectId, String status, boolean mock) {}
    public record JobDto(String id, String projectId, String status, String stage, int progress,
                         String workId, String errorMessage, boolean mock, String updatedAt) {
        public static JobDto from(ClipRenderJob j) {
            return new JobDto(j.getId(), j.getProjectId(), j.getStatus(), j.getStage(), j.getProgress(),
                    "succeeded".equals(j.getStatus()) ? j.getProjectId() : null, j.getErrorMessage(), j.isMock(), iso(j.getUpdatedAt()));
        }
    }
    public record AssetDto(String id, String label, String tag, String kind, double durationSec,
                           int usedCount, boolean preset, String previewUrl, String createdAt) {
        public static AssetDto from(ClipAsset a, String previewUrl) {
            return new AssetDto(a.getId(), a.getLabel(), a.getTag(), a.getKind(), a.getDurationSec(),
                    a.getUsedCount(), a.isPreset(), previewUrl, iso(a.getCreatedAt()));
        }
    }
    public record WorkDto(String id, String projectId, String title, String status, int durationSec,
                          int avatarSec, int credits, String videoUrl, String thumbnailUrl,
                          List<Map<String, String>> publishStats) {}
    public record AvatarDto(String imageStatus, String voiceStatus, String imageTrainedText,
                            String voiceTrainedText, int imageProgress, int voiceProgress,
                            String imageMessage, String voiceMessage, String engine, boolean presetAvailable) {}
    public record CaptureRuleDto(String kind, int vendorMinDurationSec, int vendorMaxDurationSec, int minDurationSec, int recommendedMinDurationSec,
                                 int recommendedMaxDurationSec, int maxDurationSec, long vendorMaxBytes, long maxBytes,
                                 List<String> vendorFormats, List<String> formats, String codec, Integer minShortSidePx, Integer maxLongSidePx,
                                 Integer sampleRateHz, Integer channels, List<String> guidance) {}
    public record CaptureRequirementsDto(String consentText, String agreementTitle, String officialDocsLastReviewed,
                                         List<String> officialDocs, CaptureRuleDto consent, CaptureRuleDto avatar,
                                         CaptureRuleDto voice, int pollIntervalMs) {}
    public record ConsentDto(String id, String status, boolean accepted, boolean verified, String verificationUrl) {}
    public record AuditDto(String id, String createdAt, String createdText, String scope, String action, String status) {}

    @SuppressWarnings("unchecked") public static Map<String, Object> safeMap(Map<String, Object> value) { return value == null ? new LinkedHashMap<>() : value; }
    @SuppressWarnings("unchecked") public static Map<String, Object> safeMapValue(Object value) { return value instanceof Map<?, ?> m ? new LinkedHashMap<>((Map<String, Object>) m) : null; }
    @SuppressWarnings("unchecked") public static List<Object> list(Object value) { return value instanceof List<?> l ? new ArrayList<>((List<Object>) l) : List.of(); }
    @SuppressWarnings("unchecked") public static List<Map<String, Object>> mapListValue(Object value) {
        if (!(value instanceof List<?> l)) return new ArrayList<>();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object row : l) if (row instanceof Map<?, ?> m) result.add(new LinkedHashMap<>((Map<String, Object>) m));
        return result;
    }
    public static List<Map<String, Object>> mapList(Map<String, Object> wrapper, String key) { return mapListValue(wrapper == null ? null : wrapper.get(key)); }
    public static List<String> stringList(Map<String, Object> wrapper, String key) { return list(wrapper == null ? null : wrapper.get(key)).stream().map(String::valueOf).toList(); }
    @SuppressWarnings("unchecked") public static Map<String, String> stringMap(Object value) {
        if (!(value instanceof Map<?, ?> map)) return new LinkedHashMap<>();
        Map<String, String> result = new LinkedHashMap<>();
        map.forEach((k, v) -> result.put(String.valueOf(k), v == null ? "" : String.valueOf(v)));
        return result;
    }
    public static String string(Object value) { return value == null ? null : String.valueOf(value); }
    public static String iso(Instant value) { return value == null ? null : value.toString(); }
}
