package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="aep_enterprise_policies")
public class EnterprisePolicy {
    @Id @Column(length=64)
    private String enterpriseId;
    @Column(nullable=false,columnDefinition="LONGTEXT")
    private String allowedEndpointIdsJson;
    @Column(nullable=false)
    private int maxActiveJobs;
    @Version
    private long version;
}
