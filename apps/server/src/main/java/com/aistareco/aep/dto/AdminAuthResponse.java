package com.aistareco.aep.dto;

import java.time.Instant;

public record AdminAuthResponse(
        String token,
        Instant expiresAt,
        AepUserDto user
) {
}
