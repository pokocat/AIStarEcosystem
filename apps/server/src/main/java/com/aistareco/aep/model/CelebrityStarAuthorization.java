package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 用户 × 明星 的授权关系（v0.4 新增）。
 *
 * 之前授权信息塞在 CelebrityStar.authorizationJson 里，导致"市场态默认值"和"该用户的真实授权"
 * 揉在一起。此表把后者独立出来：
 *   - listStars(?owner=me) 通过 join 此表过滤
 *   - getStar(id) 在 Principal 非空时附加该用户的 authorization 块
 *
 * 与 CelebrityStar.authorizationJson 的关系：authorizationJson 仅作匿名预览的"陈列态默认"，
 * 登录用户的真实授权一律走本表。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "celebrity_star_authorizations",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "star_id"})
)
public class CelebrityStarAuthorization {

    @Id
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "star_id", nullable = false)
    private String starId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CelebrityAuthStatus status;

    /** 已授权场景：带货/种草/测评 等；unauthorized 时为空。 */
    @Column(name = "scenes_json", columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    @Builder.Default
    private List<String> scenes = new ArrayList<>();

    /** 到期日；unauthorized/pending 时为 null。 */
    private LocalDate expireDate;

    /** 可选风格数。 */
    @Builder.Default
    private Integer availableStyles = 0;

    /** 仅 pending 状态：审核进度文案，如 "经纪团队复核中（48h SLA）"。 */
    private String pendingNote;

    /** expired/unauthorized 时跳转的申请/续约入口（站内路由）。 */
    private String applyUrl;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
