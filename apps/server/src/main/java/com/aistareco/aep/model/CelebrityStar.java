package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * CelebrityStar — AI 明星专区市场可见的明星形象（v2.7）。
 * 前端真值源：apps/web/src/types/celebrity-zone.ts {@code CelebrityStar}。
 *
 * 嵌套对象（authorization / stats / sampleVideos / pricing）以 JSON 字符串列存储，
 * 由 Service 层 readValue/writeValue 进出 DTO；entity 本身保持扁平避免 schema 演进。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "celebrity_stars")
public class CelebrityStar {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(length = 512, nullable = false)
    private String avatar;

    @Column(length = 512, nullable = false)
    private String cover;

    /** 主分类（中文枚举）：演员 / 歌手 / 主持人 / 运动员 / 网红 / 综艺。 */
    @Column(nullable = false)
    private String category;

    /** 子分类（中文枚举数组）。 */
    @Column(columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    @Builder.Default
    private List<String> subCategories = new ArrayList<>();

    @Column(nullable = false)
    private boolean isHot;

    @Column(columnDefinition = "LONGTEXT")
    private String description;

    /** 起拍价文案：例 "¥299起"。 */
    @Column(nullable = false)
    private String startingPrice;

    /** 当前用户已购套餐档位（"体验版"/"标准版"/"旗舰版"）；未购为 null。 */
    private String pricingTier;

    private Integer quotaUsed;
    private Integer quotaTotal;

    /** 嵌套：CelebrityAuthorization JSON。 */
    @Column(name = "authorization_json", columnDefinition = "LONGTEXT")
    private String authorizationJson;

    /** 嵌套：stats JSON。 */
    @Column(name = "stats_json", columnDefinition = "LONGTEXT")
    private String statsJson;

    /** 嵌套：sampleVideos JSON 数组。 */
    @Column(name = "sample_videos_json", columnDefinition = "LONGTEXT")
    private String sampleVideosJson;

    /** 嵌套：pricing 套餐 JSON 数组。 */
    @Column(name = "pricing_json", columnDefinition = "LONGTEXT")
    private String pricingJson;

    // ── v0.4 字段：详情页扩展（admin 后台维护，小程序详情页消费） ──────────────

    /** 一段简介，约 50-200 字。 */
    @Column(columnDefinition = "LONGTEXT")
    private String bio;

    /** 所在地，如 "上海 / 北京"。 */
    private String location;

    /** 粉丝数（原始整数；前端用 formatCompactNumber 格式化）。 */
    private Long fans;

    /** 历史合作次数。 */
    private Integer cooperationCount;

    /** 历史平均单条 GMV（人民币元，原始整数）。 */
    private Long avgGmv;

    /** 嵌套：photos JSON 数组（[{id,url,caption}]）。 */
    @Column(name = "photos_json", columnDefinition = "LONGTEXT")
    private String photosJson;

    /** 嵌套：videos JSON 数组（[{id,title,durationSec,coverUrl,playUrl,tag}]）。 */
    @Column(name = "videos_json", columnDefinition = "LONGTEXT")
    private String videosJson;
}
