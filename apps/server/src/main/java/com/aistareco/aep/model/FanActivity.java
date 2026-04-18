package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_fan_activities")
public class FanActivity {

    @Id
    private String id;

    /** Maps to DTO field "user". */
    @Column(nullable = false)
    private String userName;

    private String avatar;

    @Column(nullable = false)
    private String action;

    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActivityType type;

    public enum ActivityType {
        COMMENT, GIFT, SHARE, FOLLOW
    }
}
