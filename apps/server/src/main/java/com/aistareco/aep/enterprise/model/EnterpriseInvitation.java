package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="aep_enterprise_invitations", uniqueConstraints=@UniqueConstraint(name="uk_enterprise_invite_request",columnNames={"enterprise_id","created_by","client_request_id"}))
public class EnterpriseInvitation {
    @Id @Column(length=64)
    private String id;
    @Column(nullable=false,length=64)
    private String enterpriseId;
    @Column(nullable=false,length=64)
    private String createdBy;
    @Column(nullable=false,length=64)
    private String clientRequestId;
    @Column(nullable=false,unique=true,length=64)
    private String tokenHash;
    @Column(nullable=false,length=16)
    private String status;
    @Column(length=64)
    private String acceptedBy;
    @Column(nullable=false)
    private Instant expiresAt;
    @Column(nullable=false)
    private Instant createdAt;
}
