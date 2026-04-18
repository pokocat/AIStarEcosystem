package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_albums")
public class Album {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(length = 512)
    private String cover;

    private int trackCount;

    @Enumerated(EnumType.STRING)
    private AlbumStatus status;

    private long sales;
    private long revenue;

    public enum AlbumStatus {
        PLANNING, RECORDING, RELEASED
    }
}
