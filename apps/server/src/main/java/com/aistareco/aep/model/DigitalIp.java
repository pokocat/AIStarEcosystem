package com.aistareco.aep.model;

import com.aistareco.common.JsonMapConverter;
import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

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

    // ── AiAvatar 数字人引用（v0.60 收敛：子应用艺人形象统一来自 AiAvatar）─────
    /** FK → dap_avatar.id；经「引入数字人」创建的艺人必有，遗留孵化艺人为 null。 */
    @Column(length = 32)
    private String dapAvatarId;

    /** 首要展示图指针：null = 跟随数字人定妆照；"look:&lt;id&gt;" / "deriv:&lt;id&gt;" 指向具体资产。 */
    @Column(length = 64)
    private String dapDisplayRef;

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

    @Column(columnDefinition = "LONGTEXT")
    private String bio;

    /** JSON-encoded list of domain ids. */
    @Column(columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> domains;

    /**
     * 孵化 / 设定参数 —— 由前端孵化向导产出的自由键值对
     * (e.g. faceStyle, fashionStyle, age, height, sweetness, energy, mystery, confidence…)
     * 以 JSON 形式存在单列，字段演进时无需迁移表结构。
     */
    @Column(name = "incubation_params", columnDefinition = "LONGTEXT")
    @Convert(converter = JsonMapConverter.class)
    private Map<String, Object> incubationParams;

    /** FK → aep_studios.id — 每个艺人必归属一个 Studio（1:N）。 */
    @Column(nullable = false)
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
