package com.aistareco.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "wardrobe_items")
public class WardrobeItem {

    @Id private String id;
    private String nameZh;
    private String nameEn;
    private String category;
    private String imageUrl;
    private String rarity;
    private int price;

    @Column(columnDefinition = "TEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> tags;

    private boolean locked;
    private boolean newItem;
    private boolean trending;

    /** 单位：积分。0 = 免费，>0 = 需要消耗 priceCredits 积分购买。 */
    private int priceCredits;

    /** 商品销售状态，决定是否在 store 中可见与可购买。 */
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private SaleStatus saleStatus;

    /** 额外预览图（可选）；列表页仍用 imageUrl。 */
    private String previewUrl;

    public enum SaleStatus {
        /** 所有用户默认拥有，不走 store。 */
        FREE,
        /** 需要扣积分购买后才拥有。 */
        PAID,
        /** 暂不可购买（预售、活动限定等）。 */
        LOCKED
    }
}
