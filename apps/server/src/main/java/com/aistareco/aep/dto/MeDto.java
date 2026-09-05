package com.aistareco.aep.dto;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.service.PlatformSupport;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

/**
 * Wire shape for GET /api/me — the logged-in user plus their owning Studio (if any).
 * The frontend treats this as "the agency entity the user is logged in as".
 * Fields 1-to-1 mirror AepUserDto; {@link #studio} is null for accounts without a Studio.
 */
public record MeDto(
        String id,
        String username,
        String email,
        String phone,
        String displayName,
        String avatarUrl,
        String walletAddress,
        String bio,
        String kind,
        String status,
        /** v0.31+: 内嵌运营角色（"operator" / "super_admin" / null）。详见 AepUser.operatorRole。 */
        String operatorRole,
        /** v0.43+: 可访问的子产品平台（["music","drama","celebrity"] 子集）。空配置回落为全集。 */
        List<String> platforms,
        /** v0.149+: 账号中心全局 uid；未经账号中心登录过的旧账号为 null。 */
        String identityUid,
        /** v0.149+: 各子产品开通状态（权益真值，后端按它拦业务入口）；platforms 为其 active 子集的兼容投影。 */
        List<EnrollmentDto> enrollments,
        boolean emailVerified,
        boolean phoneVerified,
        /** 普通用户是否已设置登录密码；只暴露布尔值，永不返回 passwordHash。 */
        boolean hasPassword,
        String langPreference,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt,
        StudioDto studio
) {
    public static MeDto from(AepUser u, Studio studio) {
        return from(u, studio, List.of());
    }

    public static MeDto from(AepUser u, Studio studio, List<EnrollmentDto> enrollments) {
        return new MeDto(
                u.getId(), u.getUsername(), u.getEmail(), u.getPhone(),
                u.getDisplayName(), u.getAvatarUrl(), u.getWalletAddress(),
                u.getBio(),
                lower(u.getKind()), lower(u.getStatus()),
                lower(u.getOperatorRole()),
                derivePlatforms(u, enrollments),
                u.getIdentityUid(),
                enrollments == null ? List.of() : enrollments,
                u.isEmailVerified(), u.isPhoneVerified(), hasPassword(u), u.getLangPreference(),
                u.getCreatedAt(), u.getUpdatedAt(), u.getLastLoginAt(),
                studio == null ? null : StudioDto.from(studio)
        );
    }

    /**
     * v0.149：{@code platforms} 是 {@code enrollments} 的兼容投影 ——
     * 有开通记录时取其中 active 的产品；一条都没有（回填 runner 还没跑到的老账号）才回落读
     * 旧 {@code aep_users.platforms} CSV（空 CSV 仍按历史语义视作全集）。
     */
    private static List<String> derivePlatforms(AepUser u, List<EnrollmentDto> enrollments) {
        if (enrollments == null || enrollments.isEmpty()) {
            return PlatformSupport.effective(u.getPlatforms());
        }
        List<String> active = enrollments.stream()
                .filter(e -> "active".equals(e.status()))
                .map(EnrollmentDto::product)
                .toList();
        // 保持 PlatformSupport.ALL 的展示顺序
        return PlatformSupport.ALL.stream().filter(active::contains).toList();
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }

    private static boolean hasPassword(AepUser user) {
        return user.getPasswordHash() != null && !user.getPasswordHash().isBlank();
    }
}
