package com.aistareco.aep.dto;

import com.aistareco.aep.model.DigitalIp;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

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
        String studioId,
        String ownerUserId,
        Instant createdAt,
        Instant lastActive,
        Instant updatedAt
) {
    public record Talents(
            int singing, int acting, int dancing, int hosting, int comedy, int variety
    ) {}

    public record Stats(
            int songs, int dramas, int ads, int variety,
            long fans, long revenue, long monthlyRevenue, int popularity,
            int endorsements, long commercialValue
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
                        ip.getStatPopularity(), ip.getStatEndorsements(), ip.getStatCommercialValueCredits()
                ),
                ip.getBio(), ip.getDomains(),
                ip.getStudioId(), ip.getOwnerUserId(),
                ip.getCreatedAt(), ip.getLastActiveAt(), ip.getUpdatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
