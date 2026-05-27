package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * CelebrityProject — 用户在某个明星下创建的带货项目（v2.7）。
 * 前端真值源：apps/web/src/types/celebrity-zone.ts {@code CelebrityProject}。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "celebrity_projects")
public class CelebrityProject {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    /** FK → celebrity_stars.id */
    @Column(nullable = false)
    private String starId;

    @Column(nullable = false)
    private String starName;

    @Column(length = 512)
    private String starAvatar;

    /** 中文枚举：进行中 / 筹备中 / 已完成。 */
    @Column(nullable = false)
    private String status;

    private int videoCount;

    /** 累计播放展示文案（如 "12.4M"），"-" 表示暂无。 */
    private String totalPlays;
    private String totalInteractions;
    private int conversions;
    private String gmv;

    @Column(nullable = false)
    private LocalDate createdAt;

    /** "体验版" / "标准版" / "旗舰版"。 */
    @Column(nullable = false)
    private String pricingTier;

    /** channels 列表（ChannelStatus[]）以 JSON 字符串存储。 */
    @Column(name = "channels_json", columnDefinition = "LONGTEXT")
    private String channelsJson;

    private int quotaUsed;
    private int quotaTotal;

    /** 业主，用于权限判定（GET /celebrity/projects 仅返回 ownerUserId == principal）。 */
    @Column(nullable = false)
    private String ownerUserId;
}
