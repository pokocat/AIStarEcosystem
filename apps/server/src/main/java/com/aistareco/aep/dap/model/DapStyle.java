package com.aistareco.aep.dap.model;

import com.aistareco.common.StringListConverter;
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
import java.util.ArrayList;
import java.util.List;

/**
 * 风格模板资产（ST-xxxx）—— 把一组出片基调存成可复用模板；轻资产，不进授权登记。
 *
 * 合成工作台的「风格模板」槽位取它，promptEn 直接叠加进出图 prompt。
 */
@Entity
@Table(name = "dap_style", indexes = {
        @Index(name = "idx_dap_style_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapStyle {

    /** 登记号，形如 ST-0004。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 128)
    private String name;

    /** 一句话说明，如「暖调 · 柔光 · 生活方式」。 */
    @Column(length = 256)
    private String summary;

    /** 叠加进出图 prompt 的英文基调。 */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String promptEn;

    /** 基调标签（中文，展示用）。 */
    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    /** manual（手动新建）| work（从作品提炼）。 */
    @Column(nullable = false, length = 8)
    @Builder.Default
    private String source = "manual";

    /** 封面 storage key（从作品提炼时取那张图）。 */
    @Column(length = 512)
    private String coverKey;

    @Builder.Default
    private int hue = 210;

    /** 被合成引用次数（排序用）。 */
    @Builder.Default
    private int useCount = 0;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
}
