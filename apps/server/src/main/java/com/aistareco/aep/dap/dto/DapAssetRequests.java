package com.aistareco.aep.dap.dto;

import java.util.List;

/** 数字资产平台 · 六类资产 + 合成的请求体（字段名与 apps/web-aiavatar/src/proto/api.ts 一致）。 */
public final class DapAssetRequests {

    private DapAssetRequests() {}

    // ── IP 容器 ────────────────────────────────────────────────

    /** POST /api/v1/assets/ips —— 新建 IP 容器（免费，纯登记）。 */
    public record CreateIpRequest(String name, String tagline, String summary) {}

    /** PATCH /api/v1/assets/ips/{id} —— 全部可选；null = 不改。 */
    public record PatchIpRequest(String name, String tagline, String summary, String status) {}

    /**
     * POST /api/v1/assets/ips/{id}/members —— 关联 / 取消关联成员资产。
     * assetType: character | scene | product | voice；attach=false 时解绑。
     */
    public record IpMemberRequest(String assetType, String assetId, Boolean attach) {}

    /** POST /api/v1/assets/ips/{id}/license —— 登记 / 续签 IP 授权（生成 LIC 凭证）。 */
    public record IpLicenseRequest(String subject, String scope, Integer years, List<String> platforms) {}

    // ── 场景 ──────────────────────────────────────────────────

    /** POST /api/v1/assets/scenes —— AI 生成场景（异步任务 + 扣费）。 */
    public record CreateSceneRequest(String name, String description, String prompt,
                                     String space, String light, String ipId, String ratio) {}

    /** PATCH /api/v1/assets/scenes/{id} */
    public record PatchSceneRequest(String name, String description, String space, String light, String ipId) {}

    /** POST /api/v1/assets/scenes/{id}/variants —— 生成光线变体（labels 为空则用默认三档）。 */
    public record SceneVariantRequest(List<String> labels) {}

    // ── 产品 ──────────────────────────────────────────────────

    /** POST /api/v1/assets/products —— AI 生成产品图（异步任务 + 扣费）。 */
    public record CreateProductRequest(String name, String category, String description, String prompt,
                                       String ipId, Boolean brandAuthorized, String brandLicenseUntil) {}

    /** PATCH /api/v1/assets/products/{id} */
    public record PatchProductRequest(String name, String category, String description, String ipId,
                                      Boolean brandAuthorized, String brandLicenseUntil) {}

    /** POST /api/v1/assets/products/{id}/angles —— 补充角度（labels 为空则用默认「45° / 背面 / 细节」）。 */
    public record ProductAngleRequest(List<String> labels) {}

    // ── 风格模板 ───────────────────────────────────────────────

    /** POST /api/v1/assets/styles —— 新建风格模板（免费，纯登记）。 */
    public record CreateStyleRequest(String name, String summary, String promptEn, List<String> tags,
                                     String source) {}

    /** PATCH /api/v1/assets/styles/{id} */
    public record PatchStyleRequest(String name, String summary, String promptEn, List<String> tags) {}

    // ── 合成 ──────────────────────────────────────────────────

    /** POST /api/v1/compositions —— 人物 × 场景 × 产品 → 成片（异步任务 + 扣费）。 */
    public record CreateCompositionRequest(String avatarId, String sceneId, String productId,
                                           String styleId, String ratio, Integer count, String extraPrompt) {}
}
