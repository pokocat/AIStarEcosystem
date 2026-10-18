package com.aistareco.aep.ipstudio.dialogue;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/** Replayable display/recovery projection of one dialogue event. Never task, orchestration or ledger truth. */
@Entity
@Table(name = "ip_dialogue_event", uniqueConstraints = @UniqueConstraint(name = "uk_ip_dialogue_event_seq", columnNames = {"threadId", "seq"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpDialogueEvent {
    @Id @Column(length = 32) private String id;
    @Column(nullable = false, length = 32) private String threadId;
    @Column(nullable = false) private long seq;
    @Column(length = 32) private String turnId;
    @Column(length = 32) private String runId;
    @Column(length = 64) private String executionId;
    @Column(nullable = false, length = 32) private String type;
    @Lob @Column(nullable = false, columnDefinition = "LONGTEXT") private String dataJson;
    @Column(nullable = false) private Instant createdAt;
}
