package com.aistareco.aep.dto;

import com.aistareco.aep.model.Song;
import com.aistareco.aep.service.cdn.CdnUrlSigner;

import java.time.Instant;
import java.util.Locale;

/**
 * SongDto — 对接前端 {@code apps/web/src/types/music.ts#Song}。
 * 字段名严格匹配 TS 侧（见 product_spec.md §10.2）。
 */
public record SongDto(
        String id,
        String title,
        String genre,
        int duration,
        String status,
        long plays,
        long revenue,
        double rating,
        Instant releaseDate,
        // ── product_spec.md §10.2 新增字段 ───────────────────────────────────
        String artistId,
        /** 艺人名（admin 列表便利字段；简单 /me 视图下可为 null）。 */
        String artistName,
        /** 所属工作室 id（由 artist 反查，冗余，便于筛选）。 */
        String studioId,
        /** 所属工作室名（admin 列表便利字段）。 */
        String studioName,
        String audioUrl,
        String coverUrl,
        String lyrics,
        String modelVersion,
        String thinkDepth,
        Long creditsSpent,
        Instant createdAt
) {
    public static SongDto from(Song s) {
        return from(s, null, null, null, null);
    }

    public static SongDto from(Song s, CdnUrlSigner signer) {
        return from(s, null, null, null, signer);
    }

    public static SongDto from(Song s, String artistName, String studioId, String studioName) {
        return from(s, artistName, studioId, studioName, null);
    }

    /**
     * §4.7.5：音频地址必经 CdnUrlSigner。真值是 {@code audioCdnKey}（signKey 派生），
     * 老数据只有 URL 时回退 {@code maybeSign} 重签 —— 后者能让过期签名重新可用。
     * signer 为 null（seeder / 单测）时原样返回，不阻断。
     */
    public static SongDto from(Song s, String artistName, String studioId, String studioName,
                               CdnUrlSigner signer) {
        String audioUrl = resolveAudioUrl(s, signer);
        return new SongDto(
                s.getId(),
                s.getTitle(),
                s.getGenre(),
                s.getDuration(),
                lower(s.getStatus()),
                s.getPlays(),
                s.getRevenue(),
                s.getRating(),
                s.getReleaseDate(),
                s.getArtistId(),
                artistName,
                studioId,
                studioName,
                audioUrl,
                s.getCoverUrl(),
                s.getLyrics(),
                s.getModelVersion(),
                s.getThinkDepth(),
                s.getCreditsSpent(),
                s.getCreatedAt()
        );
    }

    @SuppressWarnings("deprecation")
    private static String resolveAudioUrl(Song s, CdnUrlSigner signer) {
        if (signer != null && s.getAudioCdnKey() != null && !s.getAudioCdnKey().isBlank()) {
            return signer.signKey(s.getAudioCdnKey());
        }
        String legacy = s.getAudioUrl();
        if (legacy == null || legacy.isBlank()) return null;
        return signer == null ? legacy : signer.maybeSign(legacy);
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
