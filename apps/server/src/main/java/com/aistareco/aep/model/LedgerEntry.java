package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Check;

import java.time.Instant;

/**
 * Immutable credit transaction log per wallet.
 * Schema/contract aligned with /product_spec.md §1.4.
 *
 * <p>v2 §1/§4.2 两平面模型：每条分录归入 {@link Plane#MONEY 资金面} 或 {@link Plane#CREDIT 积分面}。
 * 资金面（RECHARGE / REFUND_CASH / WITHDRAW）对应真实现金进出，挂现金凭证（{@code cashArtifactId}）；
 * 积分面（GIFT / ADJUST / LICENSE_GRANT / INCOME / SPEND / FREEZE / UNFREEZE / REFUND）是纯平台负债单位，
 * <b>现金凭证必须为 null</b>。这一不变量由 {@code @PrePersist} 派生 + DB {@code CHECK} 约束双重兜底，
 * 把「调差/赠送绝不碰真实资金」从 service 约定升级为数据库不变量（v2 §1 第 2 层强制）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_ledger_entries")
// v2 §1：积分面分录永不携带现金凭证。资金面不强制非空（提现单等过渡期可空），只锁死积分面那一半。
@Check(constraints = "plane <> 'CREDIT' OR cash_artifact_id IS NULL")
public class LedgerEntry {

    @Id
    private String id;

    private String walletId;

    /** Wallet owner — denormalized for per-user queries. */
    private String userId;

    @Enumerated(EnumType.STRING)
    private LedgerEntryType entryType;

    /**
     * v2 §1 两平面归类（MONEY / CREDIT）。由 {@link #assignPlaneAndArtifact()} 按 entryType 派生，
     * 调用方无需显式设置；可查询，用于 §11 对账与负债分行。
     */
    @Enumerated(EnumType.STRING)
    private Plane plane;

    /**
     * v2 §4.2 现金凭证关联（资金面：RechargeOrder / 提现单 id；积分面：强制 null）。
     * 由 {@code @PrePersist} 对资金面回填为 referenceId、对积分面强制清空，配合 {@code @Check} 守不变量。
     */
    private String cashArtifactId;

    /** Signed: positive = credit, negative = debit. */
    private long amount;
    private long balanceAfter;
    private String description;
    private String referenceId;
    private String referenceType;
    private Instant createdAt;

    /**
     * 资金面 vs 积分面（v2 §1）。资金面有真实现金背书，积分面是平台负债单位。
     */
    public enum Plane {
        MONEY,
        CREDIT
    }

    public enum LedgerEntryType {
        LICENSE_GRANT,
        RECHARGE,
        /** 积分面 · 失败补回 / 退积分（多由 releaseHold 取代）。与现金退款 REFUND_CASH 严格区分。 */
        REFUND,
        /** v2 §4.2 资金面 · 真实现金退款（FINANCE_ADMIN 审批，触发 D17 积分回收）。 */
        REFUND_CASH,
        INCOME,
        GIFT,
        SPEND,
        WITHDRAW,
        FREEZE,
        UNFREEZE,
        ADJUST
    }

    /**
     * v2 §1：entryType → 两平面的唯一分类真源。资金面 = 真钱进出；其余皆积分面。
     * 任何新增 entryType 必须在此显式归类（default 走积分面，最安全 —— 不会误标成有现金背书）。
     */
    public static Plane planeFor(LedgerEntryType type) {
        if (type == null) {
            return Plane.CREDIT;
        }
        return switch (type) {
            case RECHARGE, REFUND_CASH, WITHDRAW -> Plane.MONEY;
            default -> Plane.CREDIT;
        };
    }

    /**
     * 写库前派生 plane + 维护现金凭证不变量（v2 §1 第 2 层）。所有写入面（CreditService /
     * RechargeService …）自动受益，无需逐处设置：
     *   - plane 为空 → 按 entryType 派生；
     *   - 积分面 → 强制 cashArtifactId = null（即使调用方误塞也清掉，守 CHECK）；
     *   - 资金面 → cashArtifactId 为空时回填 referenceId（链到充值/提现凭证）。
     */
    @PrePersist
    void assignPlaneAndArtifact() {
        if (plane == null) {
            plane = planeFor(entryType);
        }
        if (plane == Plane.CREDIT) {
            cashArtifactId = null;
        } else if (cashArtifactId == null) {
            cashArtifactId = referenceId;
        }
    }
}
