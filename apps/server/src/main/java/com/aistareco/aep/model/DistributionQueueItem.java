package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_distribution_queue")
public class DistributionQueueItem {

    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    private String artistName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DistributionItemType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DistributionItemStatus status;

    private int platformCount;

    private LocalDate submitDate;

    public enum DistributionItemType {
        MUSIC("Music"), VIDEO("Video"), LIVE("Live");

        private final String wire;

        DistributionItemType(String wire) {
            this.wire = wire;
        }

        public String getWire() {
            return wire;
        }
    }

    public enum DistributionItemStatus {
        REVIEWING, APPROVED, DISTRIBUTING
    }
}
