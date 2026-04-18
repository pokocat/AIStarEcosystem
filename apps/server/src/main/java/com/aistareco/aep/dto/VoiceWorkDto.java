package com.aistareco.aep.dto;

import com.aistareco.aep.model.VoiceWork;

import java.util.Locale;

public record VoiceWorkDto(
        String id,
        String project,
        String type,
        int duration,
        String status,
        long payment
) {
    public static VoiceWorkDto from(VoiceWork v) {
        return new VoiceWorkDto(
                v.getId(),
                v.getProject(),
                lower(v.getType()),
                v.getDuration(),
                lower(v.getStatus()),
                v.getPayment()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
