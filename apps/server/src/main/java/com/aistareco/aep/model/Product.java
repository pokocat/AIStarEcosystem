package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Product — 商品库（v2.7；前端真值源 apps/web/src/types/product.ts）。
 * 字段名严格对齐 TypeScript {@code Product} interface。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "products")
public class Product {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    /** 中文枚举字符串：美妆 / 食品饮料 / 数码 3C / 服饰 / 日用百货 / 母婴 / 运动 / 其他 */
    @Column(nullable = false)
    private String category;

    @Column(length = 1024)
    private String link;

    /** JSON-encoded list of image URLs。 */
    @Column(columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    @Builder.Default
    private List<String> images = new ArrayList<>();

    @Column(columnDefinition = "LONGTEXT")
    private String sellingPoints;

    @Column(nullable = false)
    @Builder.Default
    private int usageCount = 0;

    /** "manual" | "auto-from-generation"。 */
    @Column(nullable = false)
    @Builder.Default
    private String source = "manual";

    /** v0.26+: 商品售价（分）。可空——抖音商城短链需要解析才能拿到，老数据没有。 */
    @Column
    private Integer priceCents;

    /** v0.26+: 佣金率（0-100 整数百分比）。可空——选品表格才有此字段，URL 解析拿不到。 */
    @Column
    private Integer commissionRate;

    @Column(nullable = false)
    private LocalDate createdAt;

    @Column(nullable = false)
    private LocalDate updatedAt;
}
