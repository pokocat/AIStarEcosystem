package com.aistareco.aep.dap.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 产品资产（PD-xxxx）—— 轻资产：只记来源与品牌方授权备注，不进平台 LIC 授权登记。
 *
 * 多角度图存在 {@code anglesJson} 文档里，元素形如
 * {@code {"label":"正面","cdnKey":"dap/product/xxx.png","spec":"2048×2048 · PNG"}}
 * —— 按 §4.7.7 只存 **cdnKey**，出 wire 时逐条派生签名 URL。
 */
@Entity
@Table(name = "dap_product", indexes = {
        @Index(name = "idx_dap_product_owner", columnList = "ownerUserId"),
        @Index(name = "idx_dap_product_ip", columnList = "ipId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapProduct {

    /** 登记号，形如 PD-0088。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 128)
    private String name;

    /** 品类，如「美妆 · 底妆」。 */
    @Column(length = 64)
    private String category;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String description;

    /** shot（实拍上传 · 自动抠底）| ai（AI 生成）。 */
    @Column(nullable = false, length = 8)
    @Builder.Default
    private String source = "shot";

    /** 归属 IP（可空）。 */
    @Column(length = 32)
    private String ipId;

    /** 品牌方是否已授权（轻登记，不生成 LIC 凭证）。 */
    @Builder.Default
    private boolean brandAuthorized = false;

    /** 品牌授权有效期文案，如「2027-03」。 */
    @Column(length = 32)
    private String brandLicenseUntil;

    /** 主图（正面）storage key。 */
    @Column(length = 512)
    private String imageKey;

    /** 多角度图：{"items":[{label,cdnKey,spec}]}（§4.7.7 存 key）。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> anglesJson;

    /** ready | running | failed。 */
    @Column(nullable = false, length = 12)
    @Builder.Default
    private String status = "ready";

    @Column(length = 32)
    private String jobId;

    /** AI 生成 / 补角度用的英文 prompt 基底。 */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String promptEn;

    @Builder.Default
    private long bytes = 0;

    @Builder.Default
    private int hue = 32;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;

    public Map<String, Object> anglesOrEmpty() {
        return anglesJson != null ? anglesJson : new LinkedHashMap<>();
    }
}
