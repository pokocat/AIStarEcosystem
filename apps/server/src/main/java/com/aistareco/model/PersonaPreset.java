package com.aistareco.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "persona_presets")
public class PersonaPreset {

    @Id private String id;
    private String nameZh;
    private String nameEn;
    private String icon;
    private int sweetness;
    private int energy;
    private int mystery;
}
