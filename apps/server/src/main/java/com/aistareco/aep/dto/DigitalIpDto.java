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
        /** 所属工作室名（admin/列表视图便利字段，/me 视图下可为 null）。 */
        String studioName,
        String ownerUserId,
        /** 孵化向导产出的自由键值对 */
        Map<String, Object> incubationParams,
        Instant createdAt,
        Instant lastActive,
        Instant updatedAt,
        // ── AiAvatar 数字人引用（v0.60 收敛；未引用时均为 null）────────────────
        /** 引用的数字人 id（dap_avatar.id） */
        String dapAvatarId,
        /** 首要展示图指针：null=跟随定妆照；"look:<id>" / "deriv:<id>" */
        String dapDisplayRef,
        /** 数字人当前名称（实时派生；数字人被删/回收站 → null） */
        String dapAvatarName,
        /** 首要展示图签名 URL（实时派生 + 回退定妆照；不可用 → null） */
        String dapDisplayImageUrl
) {
    public record Talents(
            int singing, int acting, int dancing, int hosting, int comedy, int variety
    ) {}

    public record Stats(
            int songs, int dramas, int ads, int variety,
            long fans, long revenue, long monthlyRevenue, int popularity
    ) {}

    public static DigitalIpDto from(DigitalIp ip) {
        return from(ip, null);
    }

    public static DigitalIpDto from(DigitalIp ip, String studioName) {
        return from(ip, studioName, null, null);
    }

    /** dap 引用版：dapAvatarName / dapDisplayImageUrl 由 DapAvatarRefResolver 实时解析后传入。 */
    public static DigitalIpDto from(DigitalIp ip, String studioName,
                                    String dapAvatarName, String dapDisplayImageUrl) {
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
                // bio 兜底空串：TS Artist.bio 必填，老行（v0.60 前引入/未填简介）可能为 null，
                // 裸 null 出 wire 会让 drama cast 页 a.bio.length 崩溃
                ip.getBio() == null ? "" : ip.getBio(),
                ip.getDomains() == null ? List.of() : ip.getDomains(),
                ip.getStatEndorsements(), ip.getStatCommercialValueCredits(),
                ip.getStudioId(), studioName, ip.getOwnerUserId(),
                ip.getIncubationParams(),
                ip.getCreatedAt(), ip.getLastActiveAt(), ip.getUpdatedAt(),
                ip.getDapAvatarId(), ip.getDapDisplayRef(),
                dapAvatarName, dapDisplayImageUrl
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
