package com.aistareco.aep.ipstudio.dialogue;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * Ordered steering queue entry: a user message received while a turn was active. The turn loop reads queued rows at
 * safe boundaries (between tool calls) and marks them applied; a stop control marks them rejected.
 */
@Entity
@Table(name = "ip_dialogue_steering", uniqueConstraints = @UniqueConstraint(name = "uk_ip_dialogue_steering_message", columnNames = "messageId"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpDialogueSteering {
    public static final String QUEUED = "queued", APPLIED = "applied", REJECTED = "rejected";
    @Id @Column(length = 32) private String id;
    @Column(nullable = false, length = 32) private String threadId;
    @Column(nullable = false, length = 32) private String messageId;
    @Column(length = 32) private String turnId;
    @Column(length = 64) private String executionId;
    @Column(nullable = false, length = 16) private String status;
    @Column(nullable = false) private Instant createdAt;
    private Instant appliedAt;
}
