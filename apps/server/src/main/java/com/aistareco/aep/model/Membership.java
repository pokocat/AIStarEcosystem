package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Links an AepUser to a Tenant. Records how the user joined.
 * Schema/contract aligned with /product_spec.md §1.5.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_memberships")
public class Membership {

    @Id
    private String id;

    private String tenantId;
    private String userId;

    @Enumerated(EnumType.STRING)
    private MembershipSource source;

    /** When source = LICENSE_ACTIVATION, points to the redeemed key. */
    private String licenseKeyId;

    private Instant joinedAt;

    public enum MembershipSource {
        LICENSE_ACTIVATION,
        SELF_REGISTER,
        ADMIN_INVITE
    }
}
