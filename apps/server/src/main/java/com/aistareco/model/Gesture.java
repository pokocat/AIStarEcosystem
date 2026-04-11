package com.aistareco.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "gestures")
public class Gesture {

    @Id private String id;
    private String nameZh;
    private String nameEn;
    private String icon;
    private String category;
}
