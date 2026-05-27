package com.aistareco.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "singers")
public class Singer {

    @Id private String id;
    private String nameZh;
    private String nameEn;
    private String styleZh;
    private String styleEn;
    private String status;
    private String quality;
    private String avatarUrl;
    private String createdAt;
    private int songsCount;
    private int fansCount;
    private int popularity;

    @Column(columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> tags;

    private int sweetness;
    private int energy;
    private int mystery;
}
