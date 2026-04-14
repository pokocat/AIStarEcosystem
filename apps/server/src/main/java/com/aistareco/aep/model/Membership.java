package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

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
    private String tenantRole;
    private Instant joinedAt;
}
