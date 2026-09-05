package com.aistareco.aep.enrollment.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 子产品「开通」当前状态 —— 后端权益真值（docs/unified-identity-plan.md §12.2）。
 *
 * <p>一个账号 × 一个子产品最多一行（{@code UNIQUE(user_id, product)}），由
 * {@code EnrollmentService} 幂等 upsert。旧的 {@code aep_users.platforms} CSV 仍在双写，
 * 但只作兼容投影：{@code MeDto.platforms} 在存在 enrollment 行时改由 ACTIVE 行派生。</p>
 *
 * <p>「开通」与「建档」是两件事：登录只保证有本地档案，能不能进业务入口由本表说了算
 * （{@code EnrollmentGuard}）。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "product_enrollment",
        uniqueConstraints = @UniqueConstraint(name = "uk_product_enrollment_user_product",
                columnNames = {"user_id", "product"}))
public class ProductEnrollment {

    @Id
    @Column(length = 48)
    private String id;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    /** 子产品 key，取值见 {@code PlatformSupport.ALL}（music / drama / celebrity / aiavatar / star）。 */
    @Column(nullable = false, length = 32)
    private String product;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EnrollmentStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EnrollmentSource source;

    @Column(name = "activated_at")
    private Instant activatedAt;

    /** null = 长期有效；非 null 且已过期的行等同未开通（{@code EnrollmentService.isActive}）。 */
    @Column(name = "valid_until")
    private Instant validUntil;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    /** wire 全小写，与 packages/types/src/account.ts 的 {@code EnrollmentStatus} 1:1。 */
    public enum EnrollmentStatus {
        PENDING, ACTIVE, SUSPENDED, REVOKED
    }

    /** wire 全小写，与 packages/types/src/account.ts 的 {@code EnrollmentSource} 1:1。 */
    public enum EnrollmentSource {
        LICENSE, TRIAL, ADMIN, GRANT_ALL, LEGACY
    }
}
