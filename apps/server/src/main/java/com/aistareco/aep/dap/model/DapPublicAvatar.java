package com.aistareco.aep.dap.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.Map;

/**
 * 数字人广场 · 运营可管理的公开数字人（v0.58）。
 *
 * <p>与 {@link com.aistareco.aep.dap.service.DapCatalogService#publicAvatars()} 内置 10 个静态样板并列：
 * 内置样板用 app 自带静态图（/plaza/*），只读；本表是运营（OPERATOR / SUPER_ADMIN）通过
 * web-aiavatar 内嵌后台「新增公开数字人」上传的形象，图存 OSS（§4.7，存 storage key，URL 由
 * DTO 出 wire 时经 FileStorageService 派生）。两者在 GET /api/v1/avatars?scope=public 合并返回。
 *
 * <p>id 以 "PA-" 前缀（前端据此判定只读 / 另存为），与内置 PA-01..PA-10 不冲突（本表用 PA-<hex>）。
 */
@Entity
@Table(name = "dap_public_avatar", indexes = {
        @Index(name = "idx_dap_public_avatar_cat", columnList = "cat")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapPublicAvatar {

    /** 业务 id，形如 PA-7f3a9c2b，直接暴露给前端。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(length = 128)
    private String codename;

    @Column(length = 128)
    private String archetype;

    @Column(length = 256)
    private String tagline;

    /** 广场分类：pro | life | ugc | community。 */
    @Column(length = 16)
    private String cat;

    private int hue;

    /** 固定 "ai"（平台原创）。 */
    @Column(length = 8)
    private String path;

    @Column(length = 64)
    private String engine;

    /** 绑定内置 AI 音色名。 */
    @Column(length = 64)
    private String voiceName;

    /** 占位画像调色板 {bg1,bg2,skin,hair,cloth,accent}。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> palette;

    /** 设定档案（中文键：年龄/气质/用途/性格/服饰/形象来源/设定语）。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> def;

    /** 正面半身（= 定妆主图）storage key。 */
    @Column(length = 512)
    private String frontKey;

    /** 右侧脸 storage key。 */
    @Column(length = 512)
    private String rightKey;

    /** 左侧脸 storage key。 */
    @Column(length = 512)
    private String leftKey;

    private boolean fav;

    /** 排序权重（小在前）。 */
    private int sortOrder;

    /** 创建者（运营）userId，审计用。 */
    @Column(length = 64)
    private String createdByUserId;

    private Instant createdAt;

    private Instant updatedAt;
}
