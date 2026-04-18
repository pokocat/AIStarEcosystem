package com.aistareco.aep.dto;

import com.aistareco.aep.model.Concert;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

/**
 * ConcertDto — 对接前端 {@code apps/web/src/types/music.ts#Concert}。
 * product_spec.md §10.5：MVP 只露 name/artistIds/date/status/streamUrl；旧字段
 * 保留给 admin 过渡。
 */
public record ConcertDto(
        String id,
        String name,
        Instant date,
        String status,
        List<String> artistIds,
        String streamUrl,
        // ── 遗留字段：@deprecated ─────────────────────────────────────────
        String venue,
        Long ticketPrice,
        Integer capacity,
        Integer soldTickets,
        Long revenue
) {
    public static ConcertDto from(Concert c) {
        return new ConcertDto(
                c.getId(),
                c.getName(),
                c.getDate(),
                lower(c.getStatus()),
                c.getArtistIds(),
                c.getStreamUrl(),
                c.getVenue(),
                c.getTicketPrice(),
                c.getCapacity(),
                c.getSoldTickets(),
                c.getRevenue()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
