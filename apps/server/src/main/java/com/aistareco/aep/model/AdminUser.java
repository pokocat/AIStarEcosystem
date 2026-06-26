package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Platform staff account (管理员账号).
 * Separated from AepUser which represents platform end-users.
 * Roles: SUPER_ADMIN (超管) | OPERATOR (运营·积分面 maker) | FINANCE_ADMIN (财务·资金面 + 大额复核 checker)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "admin_users")
public class AdminUser {

    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String username;

    private String passwordHash;
    private String email;
    private String displayName;

    @Enumerated(EnumType.STRING)
    private AdminRole role;

    @Enumerated(EnumType.STRING)
    private AdminStatus status;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant lastLoginAt;

    public enum AdminRole {
        /** 超管 — full access */
        SUPER_ADMIN,
        /** 运营 — day-to-day operations（v2：积分面 maker，发起调差/赠送） */
        OPERATOR,
        /** 财务 — 资金面（提现/退款/对账）+ 大额调差/赠送复核 checker（v2 §9 角色拆分） */
        FINANCE_ADMIN
    }

    public enum AdminStatus {
        ACTIVE, SUSPENDED
    }
}
