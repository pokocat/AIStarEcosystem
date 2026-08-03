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
 *   <li>{@code aigc}：AI 生成素材分组（v0.105-补丁起启用）。数字人 AI 原创素材送审到一个
 *       **账号级共享的专属分组**（owner = {@code __platform__}，见 {@code DapAigcGroupResolver}），
 *       不再混进平台默认组。</li>
 * </ul>
 *
 * <p>配额治理（v0.105-补丁）：modelink 账号级上限只有 **3 个分组 / 30 个素材**，而 liveness 是
 * 「每次真人捕获建一个分组」，任何失败重试都会占掉一个槽位。因此终态（failed）分组会被
 * {@code DapModelinkPoller} 的回收器 / 重试路径调 {@code deleteGroup} 删回上游，本地行保留并打
 * {@link #recycledAt}（可追溯，不删行）。**active 分组绝不删** —— 那是生效授权的取证凭据。
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
     *
     * <p><b>aigc 分组的二义</b>：aigc 分组根本没有回调，这一列改承载**确定性去重键**
     * （{@code aigc:<model>}，见 {@code DapAigcGroupResolver}）—— 复用这列自带的
     * unique 约束，就得到「账号级只建一个专属 aigc 分组」的 DB 级幂等，无需新加列 / 新索引。
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

    /**
     * 上游分组已被删除、配额已归还的时间（本地行保留作审计追溯）。
     * 非 null = 该 qgroupid 在上游已不存在，回收器不再重试、也不得再往里塞素材。
     */
    private Instant recycledAt;

    private Instant createdAt;
    private Instant updatedAt;
}
