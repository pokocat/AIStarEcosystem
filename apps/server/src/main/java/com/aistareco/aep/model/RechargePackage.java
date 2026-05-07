package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * 充值套餐（v0.4 新增）。运营在 admin 后台配置；小程序"我的"页和充值页消费。
 * 前端真值源：apps/web/src/types/wallet.ts RechargePackage。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "recharge_packages")
public class RechargePackage {

    @Id
    private String id;

    /** 套餐总积分（充进 rechargeBalance）。 */
    @Column(nullable = false)
    private long credits;

    /** 价格（人民币分）。 */
    @Column(nullable = false)
    private long priceCents;

    /** 套餐标签：体验包 / 标准包 / 热门包 / 企业包。 */
    @Column(nullable = false)
    private String tag;

    @Column(nullable = false)
    private boolean recommended;

    /** 赠送积分（充进 giftBalance），可空。 */
    @Builder.Default
    private long bonusCredits = 0L;

    /** 排序权重，越小越靠前。 */
    @Builder.Default
    private Integer sortOrder = 0;

    /** 是否上架。 */
    @Builder.Default
    private boolean active = true;
}
