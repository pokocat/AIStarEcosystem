package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_community_events")
public class CommunityEvent {

    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventStatus status;

    private int participants;

    private LocalDate eventDate;

    public enum EventType {
        MEETUP, VOTE, CHALLENGE, ANNIVERSARY
    }

    public enum EventStatus {
        LIVE, UPCOMING, ENDED
    }
}
