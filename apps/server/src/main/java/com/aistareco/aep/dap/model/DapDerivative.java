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

/** 衍生物单条产物（图集一张图 / 一条运镜视频 / 一张 3D 预览图）。 */
@Entity
@Table(name = "dap_derivative", indexes = {
        @Index(name = "idx_dap_deriv_avatar", columnList = "avatarId"),
        @Index(name = "idx_dap_deriv_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapDerivative {

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 32)
    private String avatarId;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    /** 衍生模块 key：atlas | expr | scene | ward | d3 | video */
    @Column(nullable = false, length = 8)
    private String derivKey;

    /** 组内序号（缩略图顺序）。 */
    @Builder.Default
    private int idx = 0;

    /** image | video | model3d */
    @Column(nullable = false, length = 12)
    private String kind;

    /** 产物 storage key。 */
    @Column(length = 512)
    private String fileKey;

    /** 视频缩略图 storage key（kind=video 时）。 */
    @Column(length = 512)
    private String thumbKey;

    /** 展示标签，如「正面半身」「微笑」「环绕运镜 · 5s」。 */
    @Column(length = 128)
    private String label;

    /** 规格说明，如「1080×1440 · PNG」「768×1152 · 5s · MP4」。 */
    @Column(length = 128)
    private String spec;

    @Column(length = 32)
    private String jobId;

    @Builder.Default
    private long bytes = 0;

    private Instant createdAt;
}
