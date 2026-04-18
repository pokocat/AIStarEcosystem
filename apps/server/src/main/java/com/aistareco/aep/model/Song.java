package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_songs")
public class Song {

    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    private String genre;

    /** Duration in seconds. */
    private int duration;

    @Enumerated(EnumType.STRING)
    private SongStatus status;

    private long plays;
    private long revenue;
    private double rating;
    private Instant releaseDate;

    public enum SongStatus {
        RECORDING, MIXING, RELEASED
    }
}
