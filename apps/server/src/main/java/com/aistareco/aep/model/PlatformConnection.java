package com.aistareco.aep.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.Map;

/**
 * 租户（通常对应 Studio / MCN）到某个分发平台的连接状态。
 * credentialsJson 存储 OAuth token / API key 等，结构各平台不同。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_platform_connections")
public class PlatformConnection {

    @Id
    private String id;

    @Column(nullable = false)
    private String tenantId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String platformId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ConnectionStatus status;

    private Instant connectedAt;

    @Column(name = "credentials_json", columnDefinition = "TEXT")
    @Convert(converter = JsonMapConverter.class)
    private Map<String, Object> credentialsJson;

    public enum ConnectionStatus {
        PENDING, CONNECTED, FAILED, DISCONNECTED
    }
}
