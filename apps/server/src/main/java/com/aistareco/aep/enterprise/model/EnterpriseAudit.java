package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="aep_enterprise_audit")
public class EnterpriseAudit {
    @Id @Column(length=64)
    private String id;
    @Column(nullable=false,length=64)
    private String enterpriseId;
    @Column(nullable=false,length=64)
    private String actorUserId;
    @Column(nullable=false,length=64)
    private String action;
    @Column(nullable=false,length=64)
    private String targetId;
    @Column(nullable=false,columnDefinition="LONGTEXT")
    private String summary;
    @Column(nullable=false)
    private Instant createdAt;
}
