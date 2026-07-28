package com.aistareco.aep.dap.model;

import jakarta.persistence.Column;
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

/**
 * IP 容器资产（IP-xxxx）。
 *
 * 「数字资产平台」六类资产之一，且是唯一的**容器**：人物 / 场景 / 产品 / 声音挂在它下面，
 * 合成产物回流登记为它的衍生物。与真人肖像一样需要授权登记（{@link DapLicense#getIpId()}），
 * 场景 / 产品 / 风格属轻资产只记来源、不进授权。
 *
 * 成员关系不在本表：由各成员实体的 {@code ipId} 外键指向（人物为 {@link DapAvatar} 的 ipId）。
 * 文件字段一律存 storage key（§4.7.4），URL 由 DTO 出 wire 时派生。
 */
@Entity
@Table(name = "dap_asset_ip", indexes = {
        @Index(name = "idx_dap_ip_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapAssetIp {

    /** 登记号，形如 IP-0007。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 128)
    private String name;

    /** 一句话定位，如「银河旅人 · 品牌虚拟代言 IP」。 */
    @Column(length = 256)
    private String tagline;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String summary;

    /** draft | ready（wire 小写）。 */
    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = "ready";

    /** 关联授权 id（LIC-xxxx；null = 未登记授权）。 */
    @Column(length = 32)
    private String licenseId;

    /** 封面 storage key；为空时前端回退到首个关联人物的定妆图。 */
    @Column(length = 512)
    private String coverKey;

    /** 占位色相（无封面时的渐变底）。 */
    @Builder.Default
    private int hue = 250;

    @Builder.Default
    private int versions = 1;

    private Instant createdAt;
    private Instant updatedAt;

    /** 软删（回收）。 */
    private Instant deletedAt;
}
