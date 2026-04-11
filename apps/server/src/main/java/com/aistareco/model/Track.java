package com.aistareco.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "tracks")
public class Track {

    @Id private String id;
    private String titleZh;
    private String titleEn;
    private String style;
    private int durationSec;
    private String durationLabel;
    private String status;
    private String date;
    private long plays;
    private String singerId;
}
