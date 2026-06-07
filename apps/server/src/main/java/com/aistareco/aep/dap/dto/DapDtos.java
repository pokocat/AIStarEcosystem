package com.aistareco.aep.dap.dto;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapAvatarVersion;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapDerivative;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.model.DapLicense;
import com.aistareco.aep.dap.model.DapLook;
import com.aistareco.aep.dap.model.DapVoice;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * 数字人资产平台响应 DTO 集（wire 真源 = apps/web-aiavatar/src/proto/data.ts）。
 * 字段名与前端 TS interface 完全一致（camelCase + def 中文键）；文件字段出 wire 时
 * 由调用方传入 keyToUrl（FileStorageService::signedUrl）派生 URL，DB 真值仍是 key。
 */
public final class DapDtos {

    private DapDtos() {}

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.of("Asia/Shanghai"));
    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyy-MM").withZone(ZoneId.of("Asia/Shanghai"));

    // ── Avatar ────────────────────────────────────────────────

    public record AvatarDto(
            String id, String name, String codename, String path, String archetype, String tagline,
            String status, String updated, boolean fav, int hue, String hairStyle,
            String license, boolean mock, String engine,
            Map<String, Object> palette, Map<String, Object> def,
            Map<String, Object> deriv, Map<String, Object> counts,
            int versions, String voiceName,
            String imageUrl, List<String> variantImages, Map<String, String> shotImages,
            String descPrompt) {

        public static AvatarDto from(DapAvatar a, String updatedZh, Function<String, String> keyToUrl) {
            List<String> variants = a.getVariantKeys() == null ? List.of()
                    : a.getVariantKeys().stream().map(keyToUrl).toList();
            Map<String, String> shots = new LinkedHashMap<>();
            if (a.getShotKeys() != null) {
                a.getShotKeys().forEach((k, v) -> {
                    if (v != null) shots.put(k, keyToUrl.apply(String.valueOf(v)));
                });
            }
            return new AvatarDto(
                    a.getId(), a.getName(), a.getCodename(), a.getPath(), a.getArchetype(), a.getTagline(),
                    a.getStatus(), updatedZh, a.isFav(), a.getHue(), a.getHairStyle(),
                    a.getLicenseId(), a.isMock(), a.getEngine(),
                    a.getPalette(), a.defOrEmpty(), a.derivOrEmpty(), a.countsOrEmpty(),
                    a.getVersions(), a.getVoiceName(),
                    a.getImageKey() != null ? keyToUrl.apply(a.getImageKey()) : null,
                    variants, shots, a.getDescPrompt());
        }
    }

    // ── 回收站 ────────────────────────────────────────────────

    /** 回收站条目（软删数字人；purgeAt = deletedAt + 保留天数，到期由调度器物理清理）。 */
    public record TrashItemDto(String id, String name, String archetype, String path, int hue,
                               String imageUrl, String deletedAt, String purgeAt, long daysLeft) {
        public static TrashItemDto from(DapAvatar a, int retentionDays, Function<String, String> keyToUrl) {
            Instant deleted = a.getDeletedAt();
            Instant purgeAt = deleted == null ? null : deleted.plusSeconds(retentionDays * 86400L);
            long daysLeft = purgeAt == null ? retentionDays
                    : Math.max(0, (purgeAt.toEpochMilli() - System.currentTimeMillis() + 86_399_999L) / 86_400_000L);
            return new TrashItemDto(a.getId(), a.getName(), a.getArchetype(), a.getPath(), a.getHue(),
                    a.getImageKey() != null ? keyToUrl.apply(a.getImageKey()) : null,
                    deleted == null ? null : deleted.toString(),
                    purgeAt == null ? null : purgeAt.toString(),
                    daysLeft);
        }
    }

    // ── 版本时间线 ────────────────────────────────────────────

    public record VersionDto(String v, String t, String note, String kind, boolean cur, String imageUrl) {
        public static VersionDto from(DapAvatarVersion ver, boolean cur, String relativeZh,
                                      Function<String, String> keyToUrl) {
            return new VersionDto("v" + ver.getV(), relativeZh, ver.getNote(), ver.getKind(), cur,
                    ver.getImageKey() != null ? keyToUrl.apply(ver.getImageKey()) : null);
        }
    }

    // ── 造型 ──────────────────────────────────────────────────

    public record LookDto(String id, String avatarId, String label, String source, String prompt,
                          String sceneId, String status, String imageUrl, String jobId, String createdAt) {
        public static LookDto from(DapLook l, Function<String, String> keyToUrl) {
            return new LookDto(l.getId(), l.getAvatarId(), l.getLabel(), l.getSource(), l.getPrompt(),
                    l.getSceneId(), l.getStatus(),
                    l.getImageKey() != null ? keyToUrl.apply(l.getImageKey()) : null,
                    l.getJobId(), l.getCreatedAt() != null ? l.getCreatedAt().toString() : null);
        }
    }

    // ── 衍生物 ────────────────────────────────────────────────

    public record DerivativeDto(String id, String avatarId, String key, int idx, String kind,
                                String fileUrl, String thumbUrl, String label, String spec, String createdAt) {
        public static DerivativeDto from(DapDerivative d, Function<String, String> keyToUrl) {
            return new DerivativeDto(d.getId(), d.getAvatarId(), d.getDerivKey(), d.getIdx(), d.getKind(),
                    d.getFileKey() != null ? keyToUrl.apply(d.getFileKey()) : null,
                    d.getThumbKey() != null ? keyToUrl.apply(d.getThumbKey()) : null,
                    d.getLabel(), d.getSpec(),
                    d.getCreatedAt() != null ? d.getCreatedAt().toString() : null);
        }
    }

    // ── 授权 ──────────────────────────────────────────────────

    public record LicenseDto(String id, String subject, String avatarId, String scope, String period,
                             List<String> platforms, String status, String signed, int photos) {

        /** wire 字段名 char 是 TS 侧命名；Java 关键字冲突 → 用 avatarId 承载 + 控制器序列化别名。 */
        public static LicenseDto from(DapLicense l) {
            String period = (l.getPeriodStart() != null && l.getPeriodEnd() != null)
                    ? YM.format(l.getPeriodStart()) + " ~ " + YM.format(l.getPeriodEnd())
                    : "—";
            return new LicenseDto(l.getId(), l.getSubject(), l.getAvatarId(), l.getScope(), period,
                    l.getPlatforms(), l.getStatus(),
                    l.getSignedAt() != null ? DATE.format(l.getSignedAt()) : "—",
                    l.getPhotoCount());
        }

        /** 输出为前端契约形状（含 char 字段）。 */
        public Map<String, Object> toWire() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("subject", subject);
            m.put("char", avatarId);
            m.put("scope", scope);
            m.put("period", period);
            m.put("platforms", platforms);
            m.put("status", status);
            m.put("signed", signed);
            m.put("photos", photos);
            return m;
        }
    }

    // ── 作业 ──────────────────────────────────────────────────

    public record JobDto(String id, String avatarId, String charName, String kind, String engine,
                         String mode, String status, int pct, String eta, String started,
                         String type, String stage, String stageUpdatedAt,
                         String error, Map<String, Object> result) {

        public static JobDto from(DapJob j, Function<Instant, String> hm) {
            return new JobDto(j.getId(), j.getAvatarId(), j.getCharName(), j.getKind(), j.getEngine(),
                    j.getMode(), j.getStatus(), j.getPct(), j.getEta(),
                    hm.apply(j.getStartedAt() != null ? j.getStartedAt() : j.getCreatedAt()),
                    j.getType(), j.getStage(),
                    j.getStageUpdatedAt() != null ? j.getStageUpdatedAt().toString() : null,
                    j.getErrorMessage(), j.getResult());
        }

        /** 输出为前端契约形状（含 char 字段 = avatarId）。 */
        public Map<String, Object> toWire() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("char", avatarId);
            m.put("charName", charName);
            m.put("kind", kind);
            m.put("engine", engine);
            m.put("mode", mode);
            m.put("status", status);
            m.put("pct", pct);
            m.put("eta", eta);
            m.put("started", started);
            m.put("type", type);
            if (stage != null) m.put("stage", stage);
            if (stageUpdatedAt != null) m.put("stageUpdatedAt", stageUpdatedAt);
            if (error != null) m.put("error", error);
            if (result != null) m.put("result", result);
            return m;
        }
    }

    // ── 声线 ──────────────────────────────────────────────────

    public record VoiceDto(String id, String name, String avatarId, String kind, String gender,
                           String lang, String tone, String dur, List<Integer> wave, boolean fav,
                           String audioUrl) {
        public static VoiceDto from(DapVoice v, Function<String, String> keyToUrl) {
            List<Integer> wave = v.getWave() == null ? List.of()
                    : v.getWave().stream().map(s -> {
                        try { return Integer.parseInt(s); } catch (Exception e) { return 8; }
                    }).toList();
            return new VoiceDto(v.getId(), v.getName(), v.getAvatarId(), v.getKind(), v.getGender(),
                    v.getLang(), v.getTone(), v.getDur(), wave, v.isFav(),
                    v.getAudioKey() != null ? keyToUrl.apply(v.getAudioKey()) : null);
        }

        public Map<String, Object> toWire() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("name", name);
            m.put("char", avatarId);
            m.put("kind", kind);
            m.put("gender", gender);
            m.put("lang", lang);
            m.put("tone", tone);
            m.put("dur", dur);
            m.put("wave", wave);
            m.put("fav", fav);
            if (audioUrl != null) m.put("audioUrl", audioUrl);
            return m;
        }
    }

    // ── 捕获 ──────────────────────────────────────────────────

    public record CaptureDto(String id, String avatarId, String status, double durationSec,
                             String footageUrl, String frameUrl) {
        public static CaptureDto from(DapCapture c, Function<String, String> keyToUrl) {
            return new CaptureDto(c.getId(), c.getAvatarId(), c.getStatus(), c.getDurationSec(),
                    c.getFootageKey() != null ? keyToUrl.apply(c.getFootageKey()) : null,
                    c.getFrameKey() != null ? keyToUrl.apply(c.getFrameKey()) : null);
        }
    }

    // ── 账户 ──────────────────────────────────────────────────

    public record StorageSliceDto(String name, double size, String color, String icon) {}

    public record AccountDto(String plan, String planLabel, long credits, long monthlyGrant,
                             long creditsUsed, String refreshDate, long generatableEstimate,
                             double storageUsedGB, int storageQuotaGB,
                             List<StorageSliceDto> storageBreakdown) {}
}
