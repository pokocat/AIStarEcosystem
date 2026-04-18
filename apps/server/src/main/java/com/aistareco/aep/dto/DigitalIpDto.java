package com.aistareco.aep.dto;

import com.aistareco.aep.model.DigitalIp;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Wire-format for {@link DigitalIp}.
 * Field shape mirrors frontend {@code Artist} (apps/web_new/src/types/artist.ts):
 *   talents nested object, stats nested object — assembled here from flat columns.
 */
public record DigitalIpDto(
        String id,
        String name,
        String type,
        String quality,
        String status,
        int level,
        int exp,
        int maxExp,
        String avatar,
        Talents talents,
        Stats stats,
        String bio,
        List<String> domains,
        /** 商业代言数 */
        int endorsements,
        /** 商业价值（credits 原始值） */
        long commercialValue,
        String studioId,
        String ownerUserId,
        /** 孵化向导产出的自由键值对 */
        Map<String, Object> incubationParams,
        Instant createdAt,
        Instant lastActive,
        Instant updatedAt
) {
    public record Talents(
            int singing, int acting, int dancing, int hosting, int comedy, int variety
    ) {}

    public record Stats(
            int songs, int dramas, int ads, int variety,
            long fans, long revenue, long monthlyRevenue, int popularity
    ) {}

    public static DigitalIpDto from(DigitalIp ip) {
        return new DigitalIpDto(
                ip.getId(), ip.getName(),
                lower(ip.getKind()), lower(ip.getQuality()), lower(ip.getStatus()),
                ip.getLevel(), ip.getExp(), ip.getMaxExp(),
                ip.getAvatarUrl(),
                new Talents(
                        ip.getTalentSinging(), ip.getTalentActing(), ip.getTalentDancing(),
                        ip.getTalentHosting(), ip.getTalentComedy(), ip.getTalentVariety()
                ),
                new Stats(
                        ip.getStatSongs(), ip.getStatDramas(), ip.getStatAds(), ip.getStatVariety(),
                        ip.getStatFans(), ip.getStatRevenueCredits(), ip.getStatMonthlyRevenueCredits(),
                        ip.getStatPopularity()
                ),
                ip.getBio(), ip.getDomains(),
                ip.getStatEndorsements(), ip.getStatCommercialValueCredits(),
                ip.getStudioId(), ip.getOwnerUserId(),
                ip.getIncubationParams(),
                ip.getCreatedAt(), ip.getLastActiveAt(), ip.getUpdatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
