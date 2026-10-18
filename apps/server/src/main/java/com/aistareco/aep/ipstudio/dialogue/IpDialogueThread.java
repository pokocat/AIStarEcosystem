package com.aistareco.aep.ipstudio.dialogue;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * One conversation thread on a canvas: the main thread (id {@code IPT-<projectId>}) or an explicit branch.
 *
 * <p>Holds conversation pointers only. {@code activeRunId} points at the parent dialogue {@code IpRun}, which stays the
 * task, checkpoint and billing truth; {@code activeExecutionId} points at a plan execution owned by the executor.
 * {@code lastSeq} is the per-thread event cursor, {@code messageSeq} the separate message counter.
 */
@Entity
@Table(name = "ip_dialogue_thread")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpDialogueThread {
    @Id @Column(length = 32) private String id;
    @Column(nullable = false, length = 32) private String projectId;
    @Column(nullable = false, length = 64) private String ownerUserId;
    @Column(length = 32) private String parentThreadId;
    @Column(length = 32) private String branchFromMessageId;
    /** Branch creation idempotency key; null on main threads. */
    @Column(length = 64) private String clientRequestId;
    @Column(length = 128) private String title;
    @Column(length = 64) private String skillKey;
    private Integer skillVersion;
    /** analysis | production; the stage is a budget/authorization boundary, not a UI page. */
    @Column(length = 16) private String stage;
    @Builder.Default @Column(nullable = false) private long lastSeq = 0;
    @Builder.Default @Column(nullable = false) private long messageSeq = 0;
    /** Events with seq <= floor were pruned; a resume cursor below it gets 410. */
    @Builder.Default @Column(nullable = false) private long eventFloorSeq = 0;
    @Builder.Default @Column(nullable = false) private int planRevision = 0;
    @Column(length = 32) private String activeTurnId;
    @Column(length = 32) private String activeRunId;
    @Column(length = 64) private String activeExecutionId;
    @Column(length = 64) private String lastControlId;
    @Lob @Column(columnDefinition = "LONGTEXT") private String historySummary;
    @Builder.Default @Column(nullable = false) private long historySummarySeq = 0;
    private Instant lastOpenedAt;
    @Column(nullable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
}
