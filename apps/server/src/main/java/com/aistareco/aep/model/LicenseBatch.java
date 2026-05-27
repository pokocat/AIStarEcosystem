package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * License batch. Each key in the batch grants the same initial credit amount when activated.
 * Plans / subscriptions removed entirely (see /product_spec.md §0.1, §2.1).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_license_batches")
public class LicenseBatch {

    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String batchNo;

    /** Marketing display name, e.g. "种子用户包". */
    @Column(nullable = false)
    private String name;

    /**
     * Tenant that issued / distributes this batch.
     * v0.36+：改为 nullable —— 新批次走 {@link #sellingChannelId}，不再绑定 Tenant；
     *         老批次保留以维持历史 Membership / ledger 追溯。
     */
    @Column(nullable = true)
    private String issuerTenantId;

    /**
     * v0.36：销售渠道 ID（指向 SellingChannel）。新批次必填；老批次为 null（迁移 seeder 自动 backfill）。
     */
    @Column(name = "selling_channel_id", length = 64)
    private String sellingChannelId;

    /**
     * v0.36：权益等级（修复前后端 drift）。
     * 取值：trial / basic / standard / premium / annual_pro / city_agent —— 与
     * {@code apps/admin/src/types/license.ts LICENSE_TIERS} 对齐；缺失则按 initialCreditGrant 派生。
     */
    @Column(length = 32)
    private String tier;

    /** One-time credits granted on activation. Same value for every key in the batch. */
    private long initialCreditGrant;

    private int totalCount;
    private int activatedCount;

    private Instant validFrom;
    private Instant validTo;

    @Enumerated(EnumType.STRING)
    private LicenseBatchStatus status;

    private Instant createdAt;

    public enum LicenseBatchStatus {
        ACTIVE, EXHAUSTED, REVOKED, EXPIRED
    }
}
