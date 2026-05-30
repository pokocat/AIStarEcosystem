package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Platform end-user account (平台用户账号).
 * Users are registered by activating a license key (see LicenseActivationService).
 * Admin staff accounts are stored in AdminUser instead.
 *
 * Schema/contract aligned with /product_spec.md §1.2.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_users")
public class AepUser {

    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String username;

    private String passwordHash;
    private String email;
    private String phone;
    private String displayName;
    private String avatarUrl;
    private String walletAddress;

    @Column(length = 1024)
    private String bio;

    /**
     * Account kind. Drives whether the studio console is available.
     * personal = consumer / fan; studio = operator running a Studio profile.
     */
    @Enumerated(EnumType.STRING)
    private AccountKind kind;

    @Enumerated(EnumType.STRING)
    private UserStatus status;

    /**
     * v0.31+: 内嵌运营角色（celebrity 体系内的「平台运营人员」标记）。
     *
     * 与 AdminUser 表是**完全独立**的两套体系 —— AdminUser 用于 admin 后台登录
     * （/api/admin/auth/login），AepUser.operatorRole 用于 celebrity 等用户子产品
     * 内的 in-app 运营动作（例：在 web-celebrity 界面里管理公共商品池）。
     *
     * - null（默认）→ 普通用户 / 工作室账号，JWT.role 用 STUDIO 或 USER
     * - OPERATOR / SUPER_ADMIN → JWT.role 直接用 operatorRole.name()，通过
     *   /api/admin/** 的 hasAnyRole(SUPER_ADMIN, OPERATOR) 门禁
     *
     * 普通用户**不能**自我升级；目前仅由 DataInitializer seed 或后续 admin
     * 端点（v0.32 候选）维护。
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private OperatorRole operatorRole;

    /**
     * v0.43+: 该账号可访问的子产品平台（CSV，如 {@code "music,drama,celebrity"}）。
     *
     * - 空 / null（历史账号或未显式配置）→ 视为全部可访问（见 {@code PlatformSupport.effective}），
     *   避免老账号被锁在门外。
     * - 注册时由 {@code PlatformAccessService} 决定授予哪些：开发态全授予；生产态按注册来源授予。
     *
     * 真正的访问拦截在各子产品前端（按 /api/me 返回的 platforms 判断），后端不做逐接口隔离
     * —— 用户私有数据本身已按 ownerUserId 严格隔离。
     */
    @Column(length = 128)
    private String platforms;

    private boolean emailVerified;
    private boolean phoneVerified;
    private String langPreference;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant lastLoginAt;

    public enum AccountKind {
        PERSONAL, STUDIO
    }

    public enum UserStatus {
        ACTIVE, SUSPENDED, DELETED
    }

    /**
     * v0.31+: 内嵌运营角色。命名故意与 AdminUser.AdminRole 对齐 —— 同一字符串
     * 直接落到 JWT role claim，能复用 AepSecurityConfig 的 hasAnyRole 规则。
     */
    public enum OperatorRole {
        OPERATOR, SUPER_ADMIN
    }
}
