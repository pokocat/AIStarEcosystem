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
            int avatarSecHint, Integer creditHint, int segmentCount,
            String tailLabel, int tailDurationSec, String tailAssetId, String tailPreviewUrl, String tailVideoUrl
    ) {
        public static TemplateDto from(ClipTemplate t, String coverUrl, String videoUrl,
                                       List<Map<String, Object>> tailClips, int durationSec) {
            Map<String, Object> clip = tailClips == null || tailClips.isEmpty() ? Map.of() : tailClips.get(0);
            Map<String, Object> skeleton = new LinkedHashMap<>(safeMap(t.getScriptSkeletonJson()));
            List<Map<String, Object>> segments = mapListValue(skeleton.get("segments"));
            if (!clip.isEmpty()) for (Map<String, Object> row : segments) if ("tail".equals(String.valueOf(row.get("role")))) {
                if (clip.get("durationSec") instanceof Number n && n.doubleValue() > 0) row.put("durationSec", Math.max(1, Math.round(n.doubleValue())));
                if (clip.get("assetId") != null) row.put("assetId", clip.get("assetId"));
                if (clip.get("label") != null) row.put("assetLabel", clip.get("label"));
                row.put("brollSource", "preset");
                break;
            }
            skeleton.put("segments", segments);
            Map<String, Object> tail = segments.stream().filter(row -> "tail".equals(String.valueOf(row.get("role")))).findFirst().orElse(Map.of());
            return new TemplateDto(t.getId(), t.getName(), t.getIndustry(), t.getThemeKey(), t.getDescription(),
                    t.getStatus(), t.getOwnerScope(), skeleton, safeMap(t.getTimelineJson()),
                    tailClips == null ? List.of() : tailClips, stringList(t.getBrollPoolJson(), "items"),
                    coverUrl, videoUrl, t.getRatio(), durationSec, t.getAvatarSecHint(),
                    t.getCreditHint(), segments.size(), string(clip.getOrDefault("label", tail.get("text"))),
                    number(clip.containsKey("durationSec") ? clip.get("durationSec") : tail.get("durationSec")), string(clip.getOrDefault("assetId", tail.get("assetId"))),
                    string(clip.get("previewUrl")), string(clip.get("contentUrl")));
        }
    }

    public record ProjectDto(
            String id, String templateId, String templateName, String title, String status,
            Map<String, String> variables, List<Map<String, Object>> segments,
            List<Map<String, Object>> shots, List<Map<String, Object>> scriptChat,
            String avatarId, String voiceId, String bgmAssetId, Map<String, Object> subtitleStyle,
            Map<String, Object> cover,
            int durationSec, int avatarSeconds, int segmentCount, int progress, int step, String updatedAt
    ) {
        public static ProjectDto from(ClipProject p) {
            Map<String, Object> payload = safeMap(p.getPayloadJson());
            return new ProjectDto(p.getId(), p.getTemplateId(), p.getTemplateName(), p.getTitle(), p.getStatus(),
                    stringMap(payload.get("variables")), mapListValue(payload.get("segments")),
                    ClipShotPlan.shots(payload), mapListValue(payload.get("scriptChat")),
                    string(payload.get("avatarId")), string(payload.get("voiceId")), string(payload.get("bgmAssetId")),
                    safeMapValue(payload.get("subtitleStyle")), safeMapValue(payload.get("cover")),
                    p.getDurationSec(), p.getAvatarSeconds(),
                    p.getSegmentCount(), p.getProgress(), p.getStep(), iso(p.getUpdatedAt()));
        }
    }

    public record EstimateItem(String key, String label, int credits, String freeText) {}
    public record EstimateSummary(int totalSec, int avatarSec, int tailSec, int avatarCount, int brollCount, int tailCount, int chars) {}
    public record EstimateDto(List<EstimateItem> items, int total, EstimateSummary summary) {}
    public record RenderResult(String jobId, String projectId, String status, boolean mock) {}
    /**
     * 段级出片状态（WORKPLAN 2026-09-05 §1.6）。{@code status ∈ queued|generating|done|failed}。
     * {@code no} 与 {@code ClipShotPlan.materialize} 的镜头序号同源，也就是 segmentJobsJson 里的那套编号。
     */
    public record JobSegmentDto(int no, String role, String status, String errorCode) {}

    public record JobDto(String id, String projectId, String status, String stage, int progress,
                         String workId, String errorMessage, boolean mock, String updatedAt,
                         List<JobSegmentDto> segments) {
        public static JobDto from(ClipRenderJob j) {
            return new JobDto(j.getId(), j.getProjectId(), j.getStatus(), j.getStage(), j.getProgress(),
                    "succeeded".equals(j.getStatus()) ? j.getProjectId() : null, j.getErrorMessage(), j.isMock(), iso(j.getUpdatedAt()),
                    jobSegments(j));
        }
    }

    /**
     * 把 {@code ClipRenderJob.segmentJobsJson} 映射成段级状态。**只读投影，不新增真值**：
     * 哪一段做完了看它有没有留下产物（avatar 段看 videoCdnKey、broll 段看 audioCdnKey），
     * 结尾固定段不需要生成所以恒为 done。
     *
     * <p>worker 还没写过状态（刚入队、或 force-mock 的确定性任务）时返回空列表 ——
     * 调用方据此回落到整体进度，而不是看到一排凭空捏造的 queued。
     */
    public static List<JobSegmentDto> jobSegments(ClipRenderJob j) {
        Map<String, Object> state = safeMap(j.getSegmentJobsJson());
        List<Map<String, Object>> rows = mapListValue(state.get("segments"));
        if (rows.isEmpty()) return List.of();
        String jobStatus = j.getStatus();
        boolean terminalFailed = "failed".equals(jobStatus) || "cancelled".equals(jobStatus);
        String fallbackCode = string(state.get("errorCode"));
        if (fallbackCode == null || fallbackCode.isBlank()) {
            fallbackCode = "cancelled".equals(jobStatus) ? "CLIP_RENDER_CANCELLED" : "CLIP_RENDER_FAILED";
        }
        List<JobSegmentDto> result = new ArrayList<>();
        boolean generatingTaken = false;
        for (Map<String, Object> row : rows) {
            int no = number(row.get("no"));
            String role = String.valueOf(row.get("role"));
            String rowCode = string(row.get("errorCode"));
            boolean rowFailed = "failed".equals(String.valueOf(row.get("status"))) || (rowCode != null && !rowCode.isBlank());
            String status;
            String errorCode = null;
            if (rowFailed) { status = "failed"; errorCode = rowCode == null || rowCode.isBlank() ? fallbackCode : rowCode; }
            else if (produced(row, role)) status = "done";
            else if (terminalFailed) { status = "failed"; errorCode = fallbackCode; }
            else if ("succeeded".equals(jobStatus)) status = "done";
            else if ("queued".equals(jobStatus)) status = "queued";
            else if (!generatingTaken) { status = "generating"; generatingTaken = true; }
            else status = "queued";
            result.add(new JobSegmentDto(no, role, status, errorCode));
        }
        return result;
    }

    private static boolean produced(Map<String, Object> row, String role) {
        if ("tail".equals(role)) return true;
        Object key = "avatar".equals(role) ? row.get("videoCdnKey") : row.get("audioCdnKey");
        return key != null && !String.valueOf(key).isBlank();
    }

    /** 配音预览的一段（WORKPLAN 2026-09-05 §1.5）。{@code audioUrl} 是短期签名地址，未生成时为 null。 */
    public record TtsPreviewSegmentDto(int no, String audioUrl, double durationSec, double startSec) {}

    /**
     * 配音预览时间线（WORKPLAN 2026-09-05 §1.5）。
     *
     * <p>{@code credits} 恒为 0：Scheme A 下 clip 域不碰钻石账本，试听只花供应商点数。
     * 字段仍然显式返回，是为了让调用方能区分「本轮免费」与「老版本服务端没这个概念」。
     */
    public record TtsPreviewDto(String status, String timelineHash, String voiceId, double totalDurationSec,
                                List<TtsPreviewSegmentDto> segments, String errorCode, String errorMessage,
                                int credits) {}
    /** 素材库存储占用。预置素材由平台提供，不计入用户配额。 */
    public record AssetStorageDto(long usedBytes, long limitBytes, long count) {}

    /**
     * {@code width}/{@code height} 是**可空**的像素宽高：历史素材与探测失败的素材一律为 null，
     * 经 non_null 序列化后字段直接不出现，端上据此显示"未知"而不是「0×0」。不要改成 int。
     */
    public record AssetDto(String id, String label, String tag, String kind, double durationSec, long bytes,
                           Integer width, Integer height,
                           int usedCount, boolean preset, String previewUrl, String contentUrl, String createdAt) {
        public static AssetDto from(ClipAsset a, String previewUrl, String contentUrl, String displayLabel) {
            return new AssetDto(a.getId(), displayLabel, a.getTag(), a.getKind(), a.getDurationSec(), a.getBytes(),
                    a.getWidth(), a.getHeight(),
                    a.getUsedCount(), a.isPreset(), previewUrl, contentUrl, iso(a.getCreatedAt()));
        }
    }
    public record WorkDto(String id, String projectId, String title, String status, int durationSec,
                          int avatarSec, int credits, String videoUrl, String thumbnailUrl,
                          String createdAt, String generatedAt,
                          List<Map<String, String>> publishStats, boolean aiWatermark) {}
    public record AvatarDto(String id, String name, String imageStatus, String voiceStatus, String voiceSource, String imagePreviewUrl, String imageTrainedText,
                            String voiceTrainedText, int imageProgress, int voiceProgress,
                            String imageMessage, String voiceMessage, String engine, boolean presetAvailable,
                            String linkedVoiceId, String linkedVoiceName,
                            /** 固化的样例短片：真出镜、带声音。静帧证明不了口型和构图，这条能。null = 还没生成好。 */
                            String demoVideoUrl,
                            /** 该形象关联声音的固化样例音频。端上「听听你的声音」优先播它，零等待。 */
                            String demoAudioUrl) {}
    public record VoiceDto(String id, String name, String status, String source, String trainedText, int progress,
                           /** 固化的样例试听音频。有它就零等待直接播；null 时端上回落到按需合成。 */
                           String demoAudioUrl) {}
    /** 声音试听。不依赖 project —— 训练完当场就要能听，别逼用户先建一个项目。 */
    public record VoicePreviewDto(String voiceId, String audioUrl, int durationSec, String text, boolean mock) {}
    public record CaptureRuleDto(String kind, int vendorMinDurationSec, int vendorMaxDurationSec, int minDurationSec, int recommendedMinDurationSec,
                                 int recommendedMaxDurationSec, int maxDurationSec, long vendorMaxBytes, long maxBytes,
                                 List<String> vendorFormats, List<String> formats, String codec, Integer minShortSidePx, Integer maxLongSidePx,
                                 Integer sampleRateHz, Integer channels, List<String> guidance) {}
    public record CaptureRequirementsDto(boolean authorizationVideoRequired, String consentText, String agreementTitle, String officialDocsLastReviewed,
                                         List<String> officialDocs, CaptureRuleDto consent, CaptureRuleDto avatar,
                                         CaptureRuleDto voice, CaptureRuleDto image, int pollIntervalMs) {}
    public record ConsentDto(String id, String status, boolean accepted, boolean verified, String verificationUrl) {}
    public record CloneUploadTicketDto(String uploadId, String uploadUrl, Map<String, String> formData,
                                       String expiresAt, String status, boolean reused) {}
    public record CloneUploadStatusDto(String uploadId, String clientRequestId, String kind, String status,
                                       String avatarId, String voiceId, String errorCode, String errorMessage,
                                       String reviewUrl, String expiresAt, String updatedAt) {}
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
    public static int number(Object value) { return value instanceof Number n ? Math.max(0, (int)Math.round(n.doubleValue())) : 0; }
    public static String iso(Instant value) { return value == null ? null : value.toString(); }
}
