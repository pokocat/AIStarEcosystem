package com.aistareco.aep.dap.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 场景资产（SC-xxxx）—— 轻资产：只记来源（实拍上传 / AI 生成），不进授权登记。
 *
 * 光线变体存在 {@code variantsJson} 文档里，元素形如
 * {@code {"label":"夜晚","cdnKey":"dap/scene/xxx.png","spec":"1024×640"}} ——
 * 按 §4.7.7 只存 **cdnKey**（不存会过期的签名 URL），出 wire 时逐条派生。
 */
@Entity
@Table(name = "dap_scene", indexes = {
        @Index(name = "idx_dap_scene_owner", columnList = "ownerUserId"),
        @Index(name = "idx_dap_scene_ip", columnList = "ipId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapScene {

    /** 登记号，形如 SC-0312。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 128)
    private String name;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String description;

    /** shot（实拍上传）| ai（AI 生成）。 */
    @Column(nullable = false, length = 8)
    @Builder.Default
    private String source = "shot";

    /** 空间归类：indoor | outdoor | studio（wire 小写；前端映射中文）。 */
    @Column(length = 16)
    @Builder.Default
    private String space = "indoor";

    /** 光线描述，如「晨间侧逆光」。 */
    @Column(length = 64)
    private String light;

    @Builder.Default
    private int width = 0;

    @Builder.Default
    private int height = 0;

    /** 主图 storage key。 */
    @Column(length = 512)
    private String imageKey;

    /** 归属 IP（可空 —— 场景可以是通用素材）。 */
    @Column(length = 32)
    private String ipId;

    /** ready | running | failed。running 时前端显示「生成中」条纹占位。 */
    @Column(nullable = false, length = 12)
    @Builder.Default
    private String status = "ready";

    /** 生成任务 id（source=ai 或生成变体时）。 */
    @Column(length = 32)
    private String jobId;

    /** AI 生成用的英文 prompt（生成变体时复用作基底）。 */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String promptEn;

    /** 光线变体：{"items":[{label,cdnKey,spec}]}（§4.7.7 存 key 不存 URL）。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> variantsJson;

    @Builder.Default
    private long bytes = 0;

    @Builder.Default
    private int hue = 200;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;

    public Map<String, Object> variantsOrEmpty() {
        return variantsJson != null ? variantsJson : new LinkedHashMap<>();
    }
}
