package com.aistareco.aep.dto;

import com.aistareco.aep.model.SellingChannel;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Locale;

/**
 * v0.36：销售渠道 wire 形态。
 *
 * Frontend mirror: {@code packages/types/src/selling-channel.ts SellingChannel}。
 * enum wire 全小写（type / status）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SellingChannelDto(
        String id,
        String code,
        String name,
        String sellingEntity,
        String type,
        String contactEmail,
        String contactPhone,
        String remark,
        String status,
        Instant createdAt,
        Instant updatedAt
) {
    public static SellingChannelDto from(SellingChannel c) {
        return new SellingChannelDto(
                c.getId(), c.getCode(), c.getName(), c.getSellingEntity(),
                lower(c.getType()),
                c.getContactEmail(), c.getContactPhone(), c.getRemark(),
                lower(c.getStatus()),
                c.getCreatedAt(), c.getUpdatedAt()
        );
    }

    private static String lower(Enum<?> e) {
        return e == null ? null : e.name().toLowerCase(Locale.ROOT);
    }
}
