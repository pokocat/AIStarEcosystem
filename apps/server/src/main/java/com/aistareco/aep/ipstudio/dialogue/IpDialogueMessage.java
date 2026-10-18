package com.aistareco.aep.ipstudio.dialogue;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * A raw conversation message with its typed blocks (plan | approval | tool_call | question | adoption).
 * Written only while holding the thread row lock, together with the events that describe the change.
 */
@Entity
@Table(name = "ip_dialogue_message", uniqueConstraints = {
        @UniqueConstraint(name = "uk_ip_dialogue_message_seq", columnNames = {"threadId", "seq"}),
        @UniqueConstraint(name = "uk_ip_dialogue_message_client", columnNames = {"threadId", "clientMessageId"})})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpDialogueMessage {
    public static final String QUEUED = "queued", APPLIED = "applied", STREAMING = "streaming", DONE = "done", FAILED = "failed", INTERRUPTED = "interrupted";

    @Id @Column(length = 32) private String id;
    @Column(nullable = false, length = 32) private String threadId;
    @Column(nullable = false) private long seq;
    @Column(length = 32) private String turnId;
    @Column(length = 32) private String runId;
    /** user | assistant | system */
    @Column(nullable = false, length = 16) private String role;
    @Lob @Column(columnDefinition = "LONGTEXT") private String text;
    @Lob @Column(columnDefinition = "LONGTEXT") private String blocksJson;
    @Lob @Column(columnDefinition = "LONGTEXT") private String pinnedNodeIdsJson;
    @Lob @Column(columnDefinition = "LONGTEXT") private String attachmentNodeIdsJson;
    @Column(length = 64) private String clientMessageId;
    /** User messages: the request's billing selection and turn cost ceiling, reused if a queued message opens a follow-up turn. */
    @Lob @Column(columnDefinition = "LONGTEXT") private String requestJson;
    /** Assistant messages: the turn's real settled token billing (StudioTokenBilling). */
    @Lob @Column(columnDefinition = "LONGTEXT") private String billingJson;
    @Builder.Default @Column(nullable = false) private boolean settling = false;
    @Column(nullable = false, length = 16) private String status;
    @Column(length = 64) private String legacyNodeId;
    @Column(nullable = false) private Instant createdAt;
    private Instant updatedAt;
}
