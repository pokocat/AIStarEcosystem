package com.aistareco.aep.dto;

import com.aistareco.aep.model.Membership;

import java.time.Instant;
import java.util.Locale;

public record MembershipDto(
        String id,
        String userId,
        String tenantId,
        String source,
        String licenseKeyId,
        Instant joinedAt
) {
    public static MembershipDto from(Membership m) {
        return new MembershipDto(
                m.getId(), m.getUserId(), m.getTenantId(),
                lower(m.getSource()), m.getLicenseKeyId(),
                m.getJoinedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
