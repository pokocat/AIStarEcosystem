package com.aistareco.aep.dap.model;

import jakarta.persistence.Column;
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

/**
 * 送审素材（MAT-xxxx）—— 七牛 modelink「资产 asset」在本地的镜像（v0.105）。
 *
 * <p>两条来源：
 * <ul>
 *   <li>{@code refType=capture}：真人捕获素材（动作视频 / 关键帧），核验通过后随刷脸分组送审；</li>
 *   <li>{@code refType=avatar}：数字人定妆图，走 aigc 默认组送审。</li>
 * </ul>
 *
 * <p>{@code sourceKey} 是 §4.7.4 的真值（OSS object key）；送审时才由
 * {@code FileStorageService.signedUrl(key)} 派生一个可公网拉取的 URL 交给上游，**不落库 URL**。
 * 状态：pending → reviewing → approved | failed（fail_reason 由上游给）。
 */
@Entity
@Table(name = "dap_material", indexes = {
        @Index(name = "idx_dap_mat_owner", columnList = "ownerUserId"),
        @Index(name = "idx_dap_mat_ref", columnList = "refType,refId"),
        @Index(name = "idx_dap_mat_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapMaterial {

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    /** 本地素材分组 id（liveness 组送审时非空；aigc 走平台默认组时为空）。 */
    @Column(length = 32)
    private String groupId;

    /** modelink 侧素材 id（创建成功后回填）。 */
    @Column(length = 64)
    private String qassetid;

    /** image | video | audio。 */
    @Column(nullable = false, length = 8)
    private String type;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(length = 128)
    private String model;

    /** 源文件 storage key（§4.7.4 真值）。 */
    @Column(nullable = false, length = 512)
    private String sourceKey;

    /** pending | reviewing | approved | failed。 */
    @Column(nullable = false, length = 16)
    private String status;

    @Column(length = 512)
    private String failReason;

    /** avatar | capture。 */
    @Column(nullable = false, length = 16)
    private String refType;

    @Column(nullable = false, length = 32)
    private String refId;

    @Builder.Default
    private boolean mock = false;

    private Instant createdAt;
    private Instant updatedAt;
}
