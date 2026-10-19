package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="aep_enterprises", uniqueConstraints=@UniqueConstraint(name="uk_enterprise_create",columnNames={"created_by","create_request_id"}))
public class Enterprise {
    @Id @Column(length=64)
    private String id;
    @Column(nullable=false,length=128)
    private String name;
    @Column(nullable=false,length=64)
    private String ownerUserId;
    @Column(nullable=false,length=16)
    private String status;
    @Column(nullable=false,length=64)
    private String createRequestId;
    @Column(nullable=false,length=64)
    private String createdBy;
    @Version
    private long version;
    @Column(nullable=false)
    private Instant createdAt;
    @Column(nullable=false)
    private Instant updatedAt;
}
