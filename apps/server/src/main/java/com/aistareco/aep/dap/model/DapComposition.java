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
 * 跨资产合成单（CP-xxxx）—— 人物 × 场景 × 产品 → 成片。
 *
 * 产物落 {@link DapCompositionOutput}，并双向登记 {@link DapAssetUsage}
 * （每个用到的资产各一条「已用于」记录）。
 */
@Entity
@Table(name = "dap_composition", indexes = {
        @Index(name = "idx_dap_comp_owner", columnList = "ownerUserId"),
        @Index(name = "idx_dap_comp_ip", columnList = "ipId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapComposition {

    /** 登记号，形如 CP-4821。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    /** 人物槽位（必填）。 */
    @Column(nullable = false, length = 32)
    private String avatarId;

    /** 场景槽位（必填）。 */
    @Column(nullable = false, length = 32)
    private String sceneId;

    /** 产品槽位（可选 —— 不选则只出人物与场景）。 */
    @Column(length = 32)
    private String productId;

    /** 风格模板（可选）。 */
    @Column(length = 32)
    private String styleId;

    /** 产物归属 IP（由人物 / 产品的归属推导；可空 = 未归入任何 IP）。 */
    @Column(length = 32)
    private String ipId;

    /** 画幅：9:16 | 1:1 | 16:9。 */
    @Column(nullable = false, length = 8)
    @Builder.Default
    private String ratio = "9:16";

    @Builder.Default
    private int count = 4;

    /** running | done | failed。 */
    @Column(nullable = false, length = 12)
    @Builder.Default
    private String status = "running";

    @Column(length = 32)
    private String jobId;

    /** 授权核对结论快照（出片前展示给用户的那句话）。 */
    @Column(length = 256)
    private String licenseNote;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String promptEn;

    @Builder.Default
    private long cost = 0;

    @Builder.Default
    private long bytes = 0;

    private Instant createdAt;
    private Instant finishedAt;
    private Instant deletedAt;
}
