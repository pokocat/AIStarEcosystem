package com.aistareco.aep.dto;

import com.aistareco.aep.model.Concert;

import java.time.Instant;
import java.util.Locale;

public record ConcertDto(
        String id,
        String name,
        String venue,
        Instant date,
        long ticketPrice,
        int capacity,
        int soldTickets,
        String status,
        long revenue
) {
    public static ConcertDto from(Concert c) {
        return new ConcertDto(
                c.getId(),
                c.getName(),
                c.getVenue(),
                c.getDate(),
                c.getTicketPrice(),
                c.getCapacity(),
                c.getSoldTickets(),
                lower(c.getStatus()),
                c.getRevenue()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
