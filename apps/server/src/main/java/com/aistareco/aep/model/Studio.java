package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Studio profile (经纪公司 / 工作室 / 个人创作者) — 1:1 attached to an AepUser
 * whose `kind = STUDIO`. Models the operating business behind one or more DigitalIp.
 *
 * Schema/contract aligned with /product_spec.md §1.6.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_studios")
public class Studio {

    @Id
    private String id;

    /** FK → aep_users.id (1:1). */
    @Column(unique = true, nullable = false)
    private String ownerUserId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StudioKind kind;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private StudioStatus status = StudioStatus.ACTIVE;

    @Column(columnDefinition = "TEXT")
    private String bio;

    private String logoUrl;
    private String contactEmail;
    private String contactPhone;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void applyDefaults() {
        if (status == null) {
            status = StudioStatus.ACTIVE;
        }
    }

    public enum StudioKind {
        PERSONAL_CREATOR,
        MUSIC_STUDIO,
        DRAMA_STUDIO,
        VARIETY_STUDIO,
        AGENCY,
        MCN
    }

    public enum StudioStatus {
        ACTIVE,
        SUSPENDED,
        DELETED
    }
}
