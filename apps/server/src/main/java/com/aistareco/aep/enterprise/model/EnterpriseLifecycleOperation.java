package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.Instant;

@Data @Entity
@Table(name="aep_enterprise_lifecycle_operations",uniqueConstraints=@UniqueConstraint(name="uk_enterprise_lifecycle_request",columnNames={"enterprise_id","client_request_id"}))
public class EnterpriseLifecycleOperation {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,length=64) private String enterpriseId;
    @Column(nullable=false,length=64) private String actorUserId;
    @Column(nullable=false,length=64) private String clientRequestId;
    @Column(nullable=false,length=64) private String fingerprint;
    @Column(nullable=false,columnDefinition="LONGTEXT") private String resultJson;
    @Column(nullable=false) private Instant createdAt;
}
