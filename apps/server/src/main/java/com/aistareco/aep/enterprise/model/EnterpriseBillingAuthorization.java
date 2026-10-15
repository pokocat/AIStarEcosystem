package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.Instant;

/** Durable enterprise payment authorization, including zero-price tasks and unknown provider acceptance. */
@Data @Entity
@Table(name="aep_enterprise_billing_authorizations",uniqueConstraints=@UniqueConstraint(name="uk_enterprise_billing_ref",columnNames={"reference_type","reference_id"}),indexes={
    @Index(name="idx_enterprise_billing_member",columnList="enterpriseId,membershipId,terminalAt"),
    @Index(name="idx_enterprise_billing_wallet",columnList="walletId")})
public class EnterpriseBillingAuthorization {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,length=64) private String enterpriseId;
    @Column(nullable=false,length=64) private String actorUserId;
    @Column(nullable=false,length=64) private String membershipId;
    @Column(nullable=false,length=64) private String walletId;
    @Column(nullable=false,length=64) private String referenceType;
    @Column(nullable=false,length=128) private String referenceId;
    @Column(length=64) private String endpointId;
    private long amount;
    @Column(nullable=false,length=24) private String status;
    @Column(nullable=false) private Instant createdAt;
    @Column(nullable=false) private Instant updatedAt;
    private Instant dispatchedAt;
    private Instant terminalAt;
    private Instant revokedAt;
}
