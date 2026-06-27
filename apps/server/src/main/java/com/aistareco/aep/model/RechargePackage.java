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

    @Builder.Default
    @Column(nullable = false)
    @org.hibernate.annotations.ColumnDefault("false")
    private boolean recommended = false;

    /** 赠送积分（充进 giftBalance），可空。 */
    @Builder.Default
    private long bonusCredits = 0L;

    /** 排序权重，越小越靠前。 */
    @Builder.Default
    private Integer sortOrder = 0;

    /** 是否上架。 */
    @Builder.Default
    private boolean active = true;

    /**
     * 适用子应用（v2 §6 按子应用配套餐）：{@code all}=通用（所有子应用可见）/ 具体子应用 id
     * （music / drama / celebrity / aiavatar / star）。null 视同 all。新列 ddl-auto 加（VARCHAR，非 enum）。
     */
    @Builder.Default
    private String appScope = "all";
}
