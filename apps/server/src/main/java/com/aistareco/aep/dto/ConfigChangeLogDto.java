package com.aistareco.aep.dto;

import com.aistareco.aep.model.ConfigChangeLog;

import java.time.Instant;

public record ConfigChangeLogDto(
        String id,
        String configKey,
        String oldValue,
        String newValue,
        String changedBy,
        String changedByRole,
        String changeReason,
        Instant effectiveAt,
        Instant revertedAt,
        Instant createdAt
) {
    public static ConfigChangeLogDto from(ConfigChangeLog log) {
        return new ConfigChangeLogDto(
                log.getId(),
                log.getConfigKey(),
                log.getOldValue(),
                log.getNewValue(),
                log.getChangedBy(),
                log.getChangedByRole(),
                log.getChangeReason(),
                log.getEffectiveAt(),
                log.getRevertedAt(),
                log.getCreatedAt()
        );
    }
}
