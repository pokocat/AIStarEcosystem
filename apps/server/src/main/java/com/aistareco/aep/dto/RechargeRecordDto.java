package com.aistareco.aep.dto;

import com.aistareco.aep.model.RechargeRecord;

import java.util.Locale;

public record RechargeRecordDto(
        String id,
        String date,
        String desc,
        String source,
        long creditsAdded,
        long priceCents,
        String userId
) {
    public static RechargeRecordDto from(RechargeRecord r) {
        return new RechargeRecordDto(
                r.getId(),
                r.getRecordDate() != null ? r.getRecordDate().toString() : null,
                r.getDescription(),
                lower(r.getSource()),
                r.getCreditsAdded(),
                r.getPriceCents(),
                r.getUserId()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
