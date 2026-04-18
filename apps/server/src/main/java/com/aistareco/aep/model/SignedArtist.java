package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_signed_artists")
public class SignedArtist {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    /** Free-text artist type, e.g. "Singer", "Dancer". */
    private String artistType;

    private String typeIcon;

    private String avatar;

    private String mcn;

    private LocalDate contractEnd;

    private long monthlyRevenueCredits;

    private long totalRevenueCredits;

    private long fansCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SignedArtistStatus status;

    private int royaltyRate;

    private int contentCount;

    public enum SignedArtistStatus {
        ACTIVE, NEGOTIATING, EXPIRING
    }
}
