package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * 素材运营 · 视频资产（前端真值源：apps/web-celebrity material-ops MaterialVideo）。
 * 字段对齐 mixcut RenderOutput 语义（status / product_id / parent）；完整 MaterialVideo
 * 存 payloadJson。scriptId / productId 关联脚本与商品库。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "material_videos")
public class MaterialVideo {

    @Id
    private String id;

    @Column(name = "script_id")
    private String scriptId;

    @Column(name = "product_id")
    private String productId;

    /** baseline | variant */
    @Column
    private String kind;

    /** ready | rendering | queued | failed */
    @Column
    private String status;

    @Column(name = "parent_video_id")
    private String parentVideoId;

    @Column(name = "ord")
    @Builder.Default
    private int ord = 0;

    @Lob
    @Column(name = "payload_json", columnDefinition = "LONGTEXT", nullable = false)
    private String payloadJson;
}
