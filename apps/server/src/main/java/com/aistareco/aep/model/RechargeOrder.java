package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 充值订单 / 账单（v0.56 新增）。
 *
 * 取代「点击套餐 → 直接入账」的旧 MVP 行为：用户下单生成一张待确认账单（PENDING），
 * 平台运营在 admin 后台「线下收款」后 approve → 才经 {@code CreditService} 走不可变账本入账（PAID）；
 * 或 reject（REJECTED）。用户可取消自己的待确认订单（CANCELLED）。
 *
 * 套餐字段（credits / bonusCredits / priceCents / tag）在下单时快照，避免之后改套餐影响历史账单。
 * JPA ddl-auto=update 自动建表；H2 dev / MySQL prod 双兼容。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "recharge_order", indexes = {
        @Index(name = "idx_recharge_order_user", columnList = "userId"),
        @Index(name = "idx_recharge_order_status", columnList = "status")
})
public class RechargeOrder {

    @Id
    private String id;

    /** 下单用户（owner，授权校验依据）。 */
    @Column(nullable = false)
    private String userId;

    /** 下单时快照的账号信息（admin 列表展示用，避免每行 join）。 */
    private String username;
    private String displayName;
    private String studioName;

    @Column(nullable = false)
    private String packageId;

    /** 套餐快照。 */
    private String packageTag;

    @Column(nullable = false)
    private long credits;

    @Builder.Default
    private long bonusCredits = 0L;

    @Builder.Default
    private long priceCents = 0L;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Status status = Status.PENDING;

    /** 用户备注（如转账后四位 / 付款方式），可空。 */
    @Column(length = 512)
    private String userNote;

    /** 审批人（admin 用户标识）。 */
    private String reviewerId;

    /** 审批备注 / 驳回原因。 */
    @Column(length = 512)
    private String reviewNote;

    /** 核准入账时的主分录 id（审计回溯）。 */
    private String ledgerEntryId;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant updatedAt;

    private Instant reviewedAt;

    /** 订单状态机：PENDING → PAID（核准入账）/ REJECTED（驳回）/ CANCELLED（用户取消）。终态不可再变。 */
    public enum Status {
        PENDING,
        PAID,
        REJECTED,
        CANCELLED
    }
}
