package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 用户跨品类所有权登记。商品定价与元数据仍在各自品类表里，本表只记录"谁在什么时候因为什么拥有了某件商品"。
 * 唯一约束 (userId, itemType, itemId) 保证幂等购买。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_user_inventory",
        uniqueConstraints = @UniqueConstraint(name = "ux_inv_user_item",
                columnNames = {"user_id", "item_type", "item_id"}))
public class UserInventory {

    @Id
    private String id;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 32)
    private ItemType itemType;

    @Column(name = "item_id", nullable = false, length = 64)
    private String itemId;

    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false)
    private AcquireSource source;

    /** 实际扣除的积分数，审计用；source=PURCHASE 必填，其它为 0。 */
    private int creditsSpent;

    @Column(name = "ledger_entry_id", length = 64)
    private String ledgerEntryId;

    private Instant acquiredAt;

    public enum ItemType {
        WARDROBE,
        POSE,
        EXPRESSION,
        GESTURE,
        NFT,
        FORGE_BLUEPRINT
    }

    public enum AcquireSource {
        /** 积分购买。 */
        PURCHASE,
        /** 运营赠送 / 首次注册赠品。 */
        GRANT,
        /** 系统默认拥有（FREE 商品自动可用，不落库；保留枚举便于手动批量登记）。 */
        DEFAULT
    }
}
