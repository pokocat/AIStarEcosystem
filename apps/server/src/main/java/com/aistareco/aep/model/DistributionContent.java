package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_distribution_contents")
public class DistributionContent {

    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    /** Maps to DTO field "type". */
    private String contentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ContentStatus status;

    /** Maps to DTO field "platforms". */
    private int platformCount;

    /** Maps to DTO field "totalViews" (formatted). */
    private long totalViewsCount;

    /** Maps to DTO field "date". */
    private LocalDate publishDate;

    public enum ContentStatus {
        PUBLISHED, DISTRIBUTING, SCHEDULED, DRAFT
    }
}
