package com.aistareco.aep.ipstudio.model;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
/** Immutable, explicitly published text snapshot. Revocation never changes the source canvas. */
@Entity @Table(name="ip_conversation_share") @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpConversationShare {
    @Id @Column(length=32) private String token;
    @Column(name="owner_user_id",nullable=false,length=64) private String ownerUserId;
    @Column(name="project_id",nullable=false,length=32) private String projectId;
    @Column(name="node_id",nullable=false,length=128) private String nodeId;
    @Column(name="snapshot_hash",nullable=false,length=64) private String snapshotHash;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR) @Column(name="snapshot_json",nullable=false,length = org.hibernate.Length.LONG32) private String snapshotJson;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Column(name="revoked_at") private Instant revokedAt;
}
