package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 通用存储用量台账（v0.92）—— 跨子应用的「资产存储占用」单条记录。
 *
 * 设计目标：做成通用后台能力，drama / celebrity / music 等任意子应用都能用同一张表 +
 * {@link com.aistareco.aep.service.storage.StorageQuotaService} 记账、查用量 / 余量、配额校验。
 *
 * 每生成 / 上传一个落 CDN 的资产（首帧、视频、成片、参考图、混剪产物…）就写一行；
 * 用量 = 按 (app, ownerUserId) SUM(bytes)，分类明细按 category 分组。
 * 回收站语义：软删（如 DramaProject.deletedAt）不删本表行 → 仍计占用；
 * 仅在「彻底删除 / 到期清理」时按 refId 释放（{@code releaseByRef}）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "storage_assets",
    indexes = {
        @Index(name = "idx_storage_app_owner", columnList = "app,owner_user_id"),
        @Index(name = "idx_storage_app_ref", columnList = "app,ref_id"),
        @Index(name = "idx_storage_cdn_key", columnList = "cdn_key"),
    }
)
public class StorageAsset {

    @Id
    private String id;

    /** 子应用域：drama / celebrity / music / aiavatar … */
    private String app;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    /** 用量明细分类（展示 + 分组名），如「分镜首帧」「成片」「参考图素材」「混剪产物」。 */
    private String category;

    /**
     * 归属业务对象 id（如 DramaProject id）——用于「彻底删除」时按引用释放占用；
     * 用户级资产（如素材库参考图）可为 null。
     */
    @Column(name = "ref_id")
    private String refId;

    /** CDN object key（同时作幂等键，避免同一文件重复记账）。 */
    @Column(name = "cdn_key", length = 512)
    private String cdnKey;

    /** 文件字节数。 */
    private long bytes;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
