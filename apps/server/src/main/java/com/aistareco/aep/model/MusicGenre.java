package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_music_genres")
public class MusicGenre {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String icon;
    private String color;
}
