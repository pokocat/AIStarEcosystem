package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 一笔已冻结但尚未真扣 / 退回的积分。
 *
 * <p>语义：业务侧（混剪 / 明星生成 / 分发等）在「下单」时调 {@code CreditService.hold(...)}，
 * 把额度从可用桶（gift / license / recharge）移到 {@link Wallet#getPendingBalance}。
 * 终态由业务回填：{@code commitHold} = 任务真完成，从 pending 真扣（写 SPEND）；
 * {@code releaseHold} = 任务失败 / 取消，pending 回到原桶（写 UNFREEZE）。
 *
 * <p>幂等性靠 {@code (refType, refId)} 唯一约束保证：同一业务对象重复 hold 不会重复扣。
 *
 * <p>{@code fromGift / fromLicense / fromRecharge} 记录 hold 时从哪几个桶各自抽了多少；
 * release 时按相同分布退回（避免 hold 来自 gift 桶、release 时全部回 recharge 桶这种污染）。
 *
 * <p>{@code remainingAmount} 支持「按变体逐次 commit」的混剪场景：5 个变体的任务 hold
 * 一笔 500 积分，每变体成功 commit 100，最后一刻整体 commit 把剩余 ≤0 → status=COMMITTED；
 * 若中途整体失败，调 release 把 remaining 退回原桶。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
        name = "aep_credit_holds",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_credit_hold_ref",
                columnNames = {"reference_type", "reference_id"}
        ),
        indexes = {
                @Index(name = "idx_credit_hold_user", columnList = "user_id"),
                @Index(name = "idx_credit_hold_status", columnList = "status")
        }
)
public class CreditHold {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "wallet_id", length = 64, nullable = false)
    private String walletId;

    @Column(name = "user_id", length = 64, nullable = false)
    private String userId;

    /** 业务来源（与 LedgerEntry.referenceType 同语义）。例：mixcut_job / celebrity_generation / publish_job_upload。 */
    @Column(name = "reference_type", length = 64, nullable = false)
    private String referenceType;

    /** 业务对象 id（jobId / projectId 等）。与 referenceType 组成幂等键。 */
    @Column(name = "reference_id", length = 128, nullable = false)
    private String referenceId;

    /** hold 原始金额（正数）。 */
    @Column(nullable = false)
    private long amount;

    /** hold 时从 gift 桶抽走的额度。release 时回到 gift。 */
    @Column(name = "from_gift", nullable = false)
    private long fromGift;

    /** hold 时从 license 桶抽走的额度。release 时回到 license。 */
    @Column(name = "from_license", nullable = false)
    private long fromLicense;

    /** hold 时从 recharge 桶抽走的额度。release 时回到 recharge。 */
    @Column(name = "from_recharge", nullable = false)
    private long fromRecharge;

    /** 剩余未结算金额。每次 commit 减；release 用此值回桶；commit 完为 0。 */
    @Column(name = "remaining_amount", nullable = false)
    private long remainingAmount;

    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false)
    private Status status;

    @Column(length = 256)
    private String description;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    public enum Status {
        /** hold 已下，尚未 commit / release。 */
        ACTIVE,
        /** 全部 commit 完毕，pending 已转 SPEND。 */
        COMMITTED,
        /** 剩余部分已 release 回原桶。 */
        RELEASED
    }
}
