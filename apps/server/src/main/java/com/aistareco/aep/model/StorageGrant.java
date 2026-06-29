package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 存储扩容授予（v0.92）—— 用户购买「存储套餐」后给账户增配的存储容量（MB）。
 *
 * 单账户某子应用的实际配额 = 基础配额（admin 配 storage.quota_mb.&lt;app&gt;）+ Σ 有效授予 mb。
 * 一次购买 = 一行（source = 充值订单 id，幂等）。expiresAt 为 null 表示永久；
 * 也支持按期生效（到期不计入配额）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "storage_grants",
    indexes = { @Index(name = "idx_storage_grant_app_owner", columnList = "app,owner_user_id") }
)
public class StorageGrant {

    @Id
    private String id;

    /** 子应用域：drama / celebrity … */
    private String app;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    /** 增配容量（MB）。 */
    private long mb;

    /** 来源（充值订单 id / admin 手动），同时作幂等键避免重复授予。 */
    private String source;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    /** 到期时间（null = 永久）。 */
    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;
}
