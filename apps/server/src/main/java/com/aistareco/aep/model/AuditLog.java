package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_audit_logs")
public class AuditLog {

    @Id
    private String id;

    private String userId;
    private String tenantId;
    private String action;
    private String resourceType;
    private String resourceId;
    private String ipAddress;
    private String userAgent;

    @Enumerated(EnumType.STRING)
    private AuditResult result;

    @Column(columnDefinition = "LONGTEXT")
    private String detail;

    private Instant createdAt;

    public enum AuditResult {
        SUCCESS, FAILURE
    }
}
