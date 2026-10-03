package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 短剧画布（v0.198，设计真源 docs/drama-canvas-plan.md · 契约 packages/types/src/drama-canvas.ts）。
 *
 * <p>照小云雀「短剧 Agent」做的一条独立流水：剧本 → 角色和场景 → 逐集制作 → 单集编辑器 → 合成成片。
 * 和原来的「我的短剧」（{@link DramaProject}）<b>互相独立</b>：不共享表、不互相跳转。
 *
 * <p>{@code docJson} 是 {@code DramaCanvasDoc} 的<b>整存整取</b>文档：客户端拥有，服务端只校验外形、
 * 落库前剥掉派生的 {@code url} / {@code lastFrameUrl}、读出时只给本人的 key 派生签名地址，<b>绝不改写内容</b>。
 * 生成结果另存 {@code drama_canvas_run}，由前端合进文档再保存（ipstudio 同一条教训：服务端写文档会和防抖保存互相覆盖）。
 *
 * <p>{@code docVersion} = SHA-256(规范化 JSON + NUL + 标题) 前 16 位 hex（只改标题也换版本）；
 * 保存带 baseDocVersion，对不上 409。
 * 按 ownerUserId 严格隔离；软删用 deletedAt。表由 V36 迁移建（实体与迁移列名一一对应）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_canvas", indexes = {
        @Index(name = "idx_drama_canvas_owner", columnList = "owner_user_id,deleted_at,updated_at")
})
public class DramaCanvas {

    /** 业务 id，形如 dcv_3f9a1c02e4b5。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(name = "owner_user_id", nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 128)
    private String title;

    /** 9:16 | 16:9 */
    @Column(nullable = false, length = 8)
    private String ratio;

    @Lob
    @Column(name = "doc_json", nullable = false, columnDefinition = "LONGTEXT")
    private String docJson;

    @Column(name = "doc_version", nullable = false, length = 16)
    private String docVersion;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}
