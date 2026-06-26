package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 大额调差 / 赠送审批单（v2 §9.2 maker-checker）。
 *
 * 小额（≤ 阈值）由 OPERATOR 单人直接发放（仅落 LedgerEntry，不进本表）；
 * 大额（&gt; 阈值）先落一张 PENDING_APPROVAL 审批单（**不入账**），需第二个不同身份的
 * FINANCE_ADMIN / SUPER_ADMIN 复核（maker != checker 服务端硬校验）→ 批准才真正入账（GIFT）。
 * 本表只承载审批流，不直接改余额；批准后调 CreditOpsService 执行并回填 ledgerEntryId。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "credit_adjustment_request", indexes = {
        @Index(name = "idx_credit_adj_status", columnList = "status"),
        @Index(name = "idx_credit_adj_maker", columnList = "makerId")
})
public class CreditAdjustmentRequest {

    @Id
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Type type;

    @Column(nullable = false)
    private String targetUserId;

    @Column(nullable = false)
    private long amount;

    @Column(length = 512)
    private String reason;

    /** 客诉补偿的工单号（type=COMPENSATE）。 */
    private String incidentRef;

    /** 激励赠送的活动号（type=GRANT，可空）。 */
    private String campaignId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    @Builder.Default
    private Status status = Status.PENDING_APPROVAL;

    /** 发起人（maker）admin id。 */
    @Column(nullable = false)
    private String makerId;

    /** 复核人（checker）admin id；批准/驳回后回填。 */
    private String checkerId;

    /** 批准入账后的账本分录 id（审计回溯）。 */
    private String ledgerEntryId;

    @Column(length = 512)
    private String decideNote;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant decidedAt;

    public enum Type { COMPENSATE, GRANT }

    public enum Status { PENDING_APPROVAL, APPROVED, REJECTED }
}
