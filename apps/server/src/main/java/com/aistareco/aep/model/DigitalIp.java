package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.List;

/**
 * Digital IP — the platform's first-class managed IP entity (虚拟艺人 / IP).
 * Replaces the legacy {@code Singer} + {@code OfficialIp} tables (see /product_spec.md §4.1).
 *
 * Owned by an {@link AepUser} (typically with {@code kind=STUDIO}) and optionally
 * attached to a {@link Studio} profile.
 *
 * Numeric fields are raw integers; presentation is done in the frontend per §3.1.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "digital_ips")
public class DigitalIp {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    /** Maps to frontend {@code Artist.type}: singer/actor/entertainer/dancer/host/all_rounder/idol. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DigitalIpKind kind;

    @Enumerated(EnumType.STRING)
    private Quality quality;

    @Enumerated(EnumType.STRING)
    private DigitalIpStatus status;

    private int level;
    private int exp;
    private int maxExp;

    @Column(length = 512)
    private String avatarUrl;

    // ── Six talents (0–100) ──────────────────────────────────────────────────
    private int talentSinging;
    private int talentActing;
    private int talentDancing;
    private int talentHosting;
    private int talentComedy;
    private int talentVariety;

    // ── Business stats ───────────────────────────────────────────────────────
    private int statSongs;
    private int statDramas;
    private int statAds;
    private int statVariety;
    private long statFans;
    private long statRevenueCredits;
    private long statMonthlyRevenueCredits;
    private int statPopularity;
    private int statEndorsements;
    private long statCommercialValueCredits;

    @Column(columnDefinition = "TEXT")
    private String bio;

    /** JSON-encoded list of domain ids. */
    @Column(columnDefinition = "TEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> domains;

    /** FK → aep_studios.id (nullable; an IP may not yet be attached to a Studio). */
    private String studioId;

    /** FK → aep_users.id — the owning operator account. */
    @Column(nullable = false)
    private String ownerUserId;

    private Instant createdAt;
    private Instant lastActiveAt;
    private Instant updatedAt;

    public enum DigitalIpKind {
        SINGER, ACTOR, ENTERTAINER, DANCER, HOST, ALL_ROUNDER, IDOL
    }

    public enum Quality {
        COMMON, RARE, EPIC, LEGENDARY
    }

    public enum DigitalIpStatus {
        TRAINEE, DEBUT, ACTIVE, REST, RETIRED
    }
}
