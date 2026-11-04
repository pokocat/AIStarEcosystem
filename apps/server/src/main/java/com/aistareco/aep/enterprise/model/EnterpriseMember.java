package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="aep_enterprise_members")
public class EnterpriseMember {
    @Id @Column(length=64)
    private String id;
    @Column(nullable=false,length=64)
    private String enterpriseId;
    @Column(nullable=false,length=64)
    private String userId;
    @Column(nullable=false,length=16)
    private String role;
    @Column(nullable=false,length=16)
    private String status;

    private boolean pointsManage;

    private boolean billingRead;

    private boolean rechargeRequest;
    /** The member's own default payer for generation: "personal", "enterprise", or null to ask each time. Not a managed field, so it does not bump the version an admin edit or lifecycle preview relies on. */
    @Column(length=16) @org.hibernate.annotations.OptimisticLock(excluded=true)
    private String billingDefault;
    @Version
    private long version;
    @Column(nullable=false)
    private Instant joinedAt;
}
