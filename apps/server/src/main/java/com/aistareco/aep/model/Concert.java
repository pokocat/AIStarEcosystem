package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_concerts")
public class Concert {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String venue;
    private Instant date;
    private long ticketPrice;
    private int capacity;
    private int soldTickets;

    @Enumerated(EnumType.STRING)
    private ConcertStatus status;

    private long revenue;

    public enum ConcertStatus {
        PLANNING, SELLING, COMPLETED
    }
}
