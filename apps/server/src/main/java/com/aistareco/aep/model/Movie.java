package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_movies")
public class Movie {

    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    private String genre;

    @Enumerated(EnumType.STRING)
    private MovieRole role;

    @Enumerated(EnumType.STRING)
    private MovieStatus status;

    private long boxOffice;
    private long revenue;
    private double rating;

    public enum MovieRole {
        LEAD, SUPPORTING, CAMEO
    }

    public enum MovieStatus {
        PRE_PRODUCTION("pre-production"),
        FILMING("filming"),
        POST_PRODUCTION("post-production"),
        RELEASED("released");

        private final String wire;

        MovieStatus(String wire) { this.wire = wire; }

        public String getWire() { return wire; }
    }
}
