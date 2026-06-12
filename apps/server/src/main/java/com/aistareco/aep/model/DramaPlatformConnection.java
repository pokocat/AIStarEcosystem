package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 短剧分发 · 平台连接（v0.65，drama 子产品）。
 * 一行 = 用户 × 平台 的绑定；断开即删行。平台目录是服务端静态表（DramaDistributionService.PLATFORMS）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_platform_connections",
       uniqueConstraints = @UniqueConstraint(columnNames = {"owner_user_id", "platform_id"}))
public class DramaPlatformConnection {

    @Id
    private String id;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    @Column(name = "platform_id")
    private String platformId;

    @Column(name = "connected_at")
    private OffsetDateTime connectedAt;
}
