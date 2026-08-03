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
 * 素材分组（MG-xxxx）—— 七牛 modelink「资产分组 asset-group」在本地的镜像（v0.105）。
 *
 * <p>两种分组：
 * <ul>
 *   <li>{@code liveness_face}：真人授权（刷脸认证）分组。一次真人捕获对应一个分组，
 *       用户在分组的 h5_link 上完成刷脸后浏览器回跳我们的 callback，我们再把 resultCode +
 *       byted_token 回传给 modelink，平台异步判定 → active/failed。分组 active 才算「授权已完成」。</li>
 *   <li>{@code aigc}：AI 生成素材分组。本域**不建本地 aigc 分组行**（见
 *       {@code DapMaterialService.submitAvatarModeration}：aigc 素材一律不传 group_id，
 *       由平台落到默认组），该 kind 仅为字段语义保留。</li>
 * </ul>
 *
 * <p>状态（wire 小写，与 modelink 状态非 1:1）：
 * <pre>
 *   preparing     ← modelink pending（分组创建中）
 *   awaiting_auth ← modelink awaiting_auth（可取 h5_link 去刷脸）
 *   validating    ← 本地态：已调 visual-validate-result，等平台异步判定
 *   active        ← modelink active（授权生效）
 *   failed        ← modelink failed（刷脸未通过 / 校验失败）
 * </pre>
 */
@Entity
@Table(name = "dap_material_group", indexes = {
        @Index(name = "idx_dap_mg_owner", columnList = "ownerUserId"),
        @Index(name = "idx_dap_mg_capture", columnList = "captureId"),
        @Index(name = "idx_dap_mg_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapMaterialGroup {

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    /** aigc | liveness_face（modelink 分组类型）。 */
    @Column(nullable = false, length = 24)
    private String kind;

    /** 绑定的上游模型 id（分组创建时固定）。 */
    @Column(length = 128)
    private String model;

    /** modelink 侧分组 id（创建成功后回填）。 */
    @Column(length = 64)
    private String qgroupid;

    /** preparing | awaiting_auth | validating | active | failed。 */
    @Column(nullable = false, length = 16)
    private String status;

    @Column(length = 512)
    private String failReason;

    @Column(length = 32)
    private String avatarId;

    @Column(length = 32)
    private String captureId;

    /**
     * 回调防伪串（随机 UUID hex）。刷脸回跳地址是 {@code /api/v1/real-auth/callback?state=<token>}，
     * 该端点无 JWT（浏览器直跳），只认这个不可枚举的 state。
     */
    @Column(nullable = false, unique = true, length = 64)
    private String callbackToken;

    /** 刷脸一次性凭证（awaiting_auth 时由 modelink 下发 / 回调带回）。 */
    @Column(length = 512)
    private String bytedToken;

    /** 已调用 visual-validate-result 的时间 —— 重复回调的幂等闸（byted_token 一次性）。 */
    private Instant validateCalledAt;

    /** 走的是 mock 网关（未配置端点 + dev 允许降级）—— 产物打标，绝不与真实认证混淆。 */
    @Builder.Default
    private boolean mock = false;

    private Instant createdAt;
    private Instant updatedAt;
}
