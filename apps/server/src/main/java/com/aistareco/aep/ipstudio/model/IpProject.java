package com.aistareco.aep.ipstudio.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * AI IP 工作台项目（无限画布一张图 = 一行）。
 *
 * <p>{@code docJson} 是 {@code IpProjectDoc}（nodes / edges / viewport）的**整存整取**文档：
 * 客户端拥有、服务端逐字保存、绝不改写。运行结果与发布结果一律另存
 * （{@link IpRun} / dap 实体），否则前端防抖自动保存与服务端异步写入会互相覆盖
 * —— 这是 v0.101 「§6.1 只 upsert 实体表、不重写 payloadJson」同一条教训。
 *
 * <p>文件字段只存 storage key（§4.7.4），URL 由 DTO 出 wire 时经
 * {@code FileStorageService.signedUrl} 派生。
 */
@Entity
@Table(name = "ip_project", indexes = {
        @Index(name = "idx_ip_project_owner", columnList = "ownerUserId,deletedAt")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IpProject {

    public static final String STATUS_DRAFT = "draft";
    public static final String STATUS_PUBLISHED = "published";

    /** 业务 id，形如 IPP-3f9a1c02。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 128)
    private String name;

    /** 内置工作流模板 id（空 = 空白画布）。 */
    @Column(length = 64)
    private String templateId;

    /** draft | published */
    @Column(nullable = false, length = 16)
    private String status;

    /** IpProjectDoc 整存整取（nodes/edges/viewport）。 */
    @Lob
    @Column(nullable = false, columnDefinition = "TEXT")
    private String docJson;

    /** 封面 = 主形象选中图的 storage key（发布时写入；coverUrl 出 wire 派生）。 */
    @Column(length = 512)
    private String coverKey;

    /** 发布产出的 DapAvatar id（DH-xxxxx）。 */
    @Column(length = 32)
    private String publishedAvatarId;

    private Instant createdAt;
    private Instant updatedAt;

    /** 软删（列表过滤 + 单查按不存在处理）。 */
    private Instant deletedAt;
}
