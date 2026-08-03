package com.aistareco.aep.dap.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * 资产引用台账（双向记录）—— 驱动详情页「APPLIED TO · 已用于」反向视角，
 * 沿用 v0.11 数字人详情「应用于」的同一思路，扩到全部六类资产。
 *
 * 一次合成会为每个用到的资产各写一条（人物 / 场景 / 产品 / 风格），
 * {@code times} 记同一对（资产 → 用处）的累计次数，重复引用做累加而不是新增行。
 */
@Entity
@Table(name = "dap_asset_usage", indexes = {
        @Index(name = "idx_dap_usage_asset", columnList = "assetType,assetId"),
        @Index(name = "idx_dap_usage_owner", columnList = "ownerUserId"),
        @Index(name = "idx_dap_usage_by", columnList = "usedByType,usedById")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapAssetUsage {

    @Id
    @Column(length = 40)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    /** 被引用方类型：character | ip | scene | product | voice | style。 */
    @Column(nullable = false, length = 16)
    private String assetType;

    @Column(nullable = false, length = 32)
    private String assetId;

    /** 引用方类型：composition（目前唯一来源；后续可扩短剧 / 带货任务）。 */
    @Column(nullable = false, length = 16)
    private String usedByType;

    @Column(nullable = false, length = 32)
    private String usedById;

    /** 引用方标题（列表直接显示，避免 N+1）。 */
    @Column(length = 128)
    private String title;

    /** 副标题，如「合成工作台 · 2026-07-27 引入」。 */
    @Column(length = 128)
    private String meta;

    /** 引用方封面 storage key。 */
    @Column(length = 512)
    private String thumbKey;

    @Builder.Default
    private int times = 1;

    private Instant createdAt;
    private Instant updatedAt;
}
