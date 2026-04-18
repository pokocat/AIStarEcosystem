package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * 社区活动报名记录（复合主键 eventId + userId 保证幂等）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_event_rsvps")
@IdClass(EventRsvp.Key.class)
public class EventRsvp {

    @Id
    @Column(nullable = false)
    private String eventId;

    @Id
    @Column(nullable = false)
    private String userId;

    private Instant createdAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Key implements Serializable {
        private String eventId;
        private String userId;

        @Override
        public boolean equals(Object o) {
            if (!(o instanceof Key k)) return false;
            return Objects.equals(eventId, k.eventId) && Objects.equals(userId, k.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(eventId, userId);
        }
    }
}
