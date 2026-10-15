package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="aep_enterprise_current")
public class EnterpriseCurrentMembership {
    @Id @Column(length=64)
    private String userId;
    @Column(nullable=false,length=64)
    private String enterpriseId;
    @Column(nullable=false,unique=true,length=64)
    private String memberId;
}
