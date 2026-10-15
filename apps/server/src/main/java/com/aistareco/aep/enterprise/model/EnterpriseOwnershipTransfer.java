package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="aep_enterprise_ownership_transfers", uniqueConstraints=@UniqueConstraint(name="uk_enterprise_transfer_request",columnNames={"enterprise_id","from_user_id","client_request_id"}))
public class EnterpriseOwnershipTransfer {
    @Id @Column(length=64)
    private String id;
    @Column(nullable=false,length=64)
    private String enterpriseId;
    @Column(nullable=false,length=64)
    private String fromUserId;
    @Column(nullable=false)
    private long fromOwnerVersion;
    @Column(nullable=false,length=64)
    private String toUserId;
    @Column(nullable=false,length=64)
    private String clientRequestId;
    @Column(nullable=false,length=16)
    private String status;
    @Column(nullable=false)
    private Instant expiresAt;
}
