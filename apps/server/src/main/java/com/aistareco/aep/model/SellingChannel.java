package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * v0.36：激活码批次的「销售渠道 / 售卖主体」。
 *
 * 替代 v0.35 之前 {@code LicenseBatch.issuerTenantId} 的 Tenant 关联（用户反馈与 MCN 概念耦合）。
 *
 * <ul>
 *   <li>{@code code} 内部短码，唯一；如 {@code platform-self} / {@code agent-xingmeng}。</li>
 *   <li>{@code name} 显示名（仅内部可见）；如 {@code 平台直营} / {@code 星梦娱乐代销}。</li>
 *   <li>{@code sellingEntity} 售卖主体真实名称（内部财务对账用）。</li>
 *   <li>{@code type} 渠道类型：direct / agent / online_store / event / partner。</li>
 * </ul>
 *
 * 与 Tenant 表完全独立 —— 不再为激活用户自动加 Membership（除非 LicenseBatch.issuerTenantId 老数据仍非空）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_selling_channels",
        indexes = {
                @Index(name = "idx_selling_channel_code", columnList = "code", unique = true),
                @Index(name = "idx_selling_channel_status", columnList = "status")
        })
public class SellingChannel {

    @Id
    @Column(length = 64)
    private String id;

    /** 内部短码（唯一），可读，如 "platform-self" / "agent-xingmeng"。 */
    @Column(nullable = false, length = 64, unique = true)
    private String code;

    /** 显示名（内部可见），如 "平台直营" / "星梦娱乐代销"。 */
    @Column(nullable = false, length = 200)
    private String name;

    /** 售卖主体真实名称（财务对账用）。 */
    @Column(name = "selling_entity", length = 200)
    private String sellingEntity;

    /** 渠道类型枚举。Wire 全小写：direct / agent / online_store / event / partner。 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ChannelType type;

    @Column(length = 200)
    private String contactEmail;

    @Column(length = 64)
    private String contactPhone;

    /** 内部备注。 */
    @Column(columnDefinition = "LONGTEXT")
    private String remark;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ChannelStatus status;

    private Instant createdAt;
    private Instant updatedAt;

    public enum ChannelType {
        DIRECT, AGENT, ONLINE_STORE, EVENT, PARTNER
    }

    public enum ChannelStatus {
        ACTIVE, INACTIVE
    }
}
