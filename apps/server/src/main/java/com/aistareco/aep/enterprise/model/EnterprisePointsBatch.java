package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="aep_enterprise_points_batches", uniqueConstraints=@UniqueConstraint(name="uk_enterprise_batch_request",columnNames={"enterprise_id","client_request_id"}))
public class EnterprisePointsBatch {
    @Id @Column(length=64)
    private String id;
    @Column(nullable=false,length=64)
    private String enterpriseId;
    @Column(nullable=false,length=64)
    private String actorUserId;
    @Column(nullable=false,length=64)
    private String clientRequestId;
    @Column(nullable=false,length=16)
    private String direction;
    @Column(nullable=false,length=64)
    private String fingerprint;
    @Column(nullable=false)
    private long totalAmount;
    @Column(nullable=false)
    private Instant createdAt;
}
