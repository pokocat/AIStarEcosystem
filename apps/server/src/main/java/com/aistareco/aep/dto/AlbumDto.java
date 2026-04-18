package com.aistareco.aep.dto;

import com.aistareco.aep.model.Album;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

/**
 * AlbumDto — 对接前端 {@code apps/web/src/types/music.ts#Album}。
 * product_spec.md §10.4：新字段 artistId + trackIds；旧字段保留给 admin 过渡页面。
 */
public record AlbumDto(
        String id,
        String name,
        String cover,
        String artistId,
        List<String> trackIds,
        Instant createdAt,
        // ── 遗留字段：@deprecated；admin 过渡页面仍可读取 ────────────────────
        Integer trackCount,
        String status,
        Long sales,
        Long revenue
) {
    public static AlbumDto from(Album a) {
        List<String> ids = a.getTrackIds();
        return new AlbumDto(
                a.getId(),
                a.getName(),
                a.getCover(),
                a.getArtistId(),
                ids,
                a.getCreatedAt(),
                a.getTrackCount(),
                lower(a.getStatus()),
                a.getSales(),
                a.getRevenue()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
