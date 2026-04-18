package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_platforms")
public class Platform {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String icon;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlatformCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlatformStatus status;

    private long followersCount;

    private Instant lastSyncAt;

    public enum PlatformCategory {
        MUSIC, VIDEO, SOCIAL, LIVE
    }

    public enum PlatformStatus {
        CONNECTED, PENDING, DISCONNECTED
    }
}
