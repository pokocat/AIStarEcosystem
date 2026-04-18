package com.aistareco.aep.dto;

import com.aistareco.aep.model.PlatformConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;

import java.time.Instant;

/**
 * Wire-format for {@link PlatformConfig}.
 * {@code value} 是解析后的 JsonNode（Jackson 会按原样下发）。
 */
public record PlatformConfigDto(
        String key,
        JsonNode value,
        int version,
        String description,
        Instant updatedAt,
        String updatedBy
) {
    public static PlatformConfigDto from(PlatformConfig c, ObjectMapper om) {
        JsonNode parsed;
        try {
            parsed = c.getValueJson() == null || c.getValueJson().isBlank()
                    ? NullNode.getInstance()
                    : om.readTree(c.getValueJson());
        } catch (Exception e) {
            parsed = NullNode.getInstance();
        }
        return new PlatformConfigDto(
                c.getConfigKey(), parsed, c.getVersion(),
                c.getDescription(), c.getUpdatedAt(), c.getUpdatedBy()
        );
    }
}
