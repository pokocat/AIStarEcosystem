package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 明星商务工作台（web-star，v0.60）账号绑定：AepUser ↔ CelebrityStar。
 *
 * 一个登录账号绑定一个明星档案（明星本人或其经纪团队）。starId 即 celebrity 域
 * {@link CelebrityStar} 主键 —— 入驻（onboard）时创建明星档案 + 本绑定，
 * 明星随即出现在 web-celebrity 明星市场，这是两个子应用打通的根基。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "star_accounts",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id"})
)
public class StarAccount {

    @Id
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "star_id", nullable = false)
    private String starId;

    /** true = 经纪人视角（团队代运营）；false = 明星本人。 */
    @Column(nullable = false)
    @Builder.Default
    private boolean agentView = false;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
