package com.aistareco.aep.enrollment.model;

import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentSource;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 权益凭据（不可变）——「这次开通是凭什么来的」。
 *
 * <p>{@code UNIQUE(source, source_reference, product)} 是硬约束：同一把激活码对同一个子产品
 * 只能兑换一次。条件更新 {@code license_key} 是第一道闸，这张表是第二道 —— 两道都过不去时
 * 一律 409 {@code LICENSE_KEY_UNAVAILABLE}，绝不重复发积分。</p>
 *
 * <p><b>一次兑换按产品逐条写</b>（v0.150）：一把「全站秘钥」会同时开通多个子产品，
 * 每个被开通的产品各落一行（{@code sourceReference} 都是同一个激活码 id）。
 * 此前只记「主产品」一行，日后要按产品分别退权 / 对账时就没有凭据可依了。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "entitlement_grant",
        uniqueConstraints = @UniqueConstraint(name = "uk_entitlement_grant_source_ref",
                columnNames = {"source", "source_reference", "product"}))
public class EntitlementGrant {

    @Id
    @Column(length = 48)
    private String id;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(nullable = false, length = 32)
    private String product;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EnrollmentSource source;

    /** 来源实体 id：source=LICENSE 时是 {@code aep_license_keys.id}。 */
    @Column(name = "source_reference", nullable = false, length = 128)
    private String sourceReference;

    @Column(name = "granted_at")
    private Instant grantedAt;

    @Column(name = "valid_until")
    private Instant validUntil;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private GrantStatus status;

    public enum GrantStatus {
        ACTIVE, REVOKED
    }
}
