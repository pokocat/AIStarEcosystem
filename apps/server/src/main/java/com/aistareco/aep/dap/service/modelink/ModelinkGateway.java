package com.aistareco.aep.dap.service.modelink;

/**
 * 七牛云 modelink 资产合规 API 的最小抽象（v0.105）。
 *
 * <p>只覆盖本域用到的 5 个动作：建分组 / 查分组 / 回传刷脸结果 / 建素材 / 查素材。
 * 真实实现 {@link HttpModelinkGateway}；未配置端点且 dev 允许降级时用
 * {@link MockModelinkGateway}（产物打 mock 标记，§8.0）。业务侧只依赖
 * {@link ModelinkService} 这个 facade，不直接引用具体实现。
 */
public interface ModelinkGateway {

    /**
     * 分组状态快照。
     *
     * @param status   modelink 原始状态：pending | awaiting_auth | active | failed
     * @param h5Link   刷脸页地址（仅 awaiting_auth 时下发，约 120s 有效；不落库）
     * @param bytedToken 刷脸一次性凭证（awaiting_auth 时下发）
     */
    record GroupState(String qgroupid, String status, String h5Link, String bytedToken, String failReason) {}

    /** 素材状态快照。status：pending | reviewing | approved | failed。 */
    record AssetState(String qassetid, String status, String failReason) {}

    /**
     * 创建资产分组。
     *
     * @param kind        aigc | liveness_face
     * @param name        分组名（≤64）
     * @param model       上游模型 id
     * @param callbackUrl liveness_face 必填；刷脸完成后浏览器回跳地址（生产须 https）
     */
    GroupState createGroup(String kind, String name, String model, String callbackUrl);

    GroupState getGroup(String qgroupid);

    /**
     * 回传浏览器刷脸结果 → 平台异步判定（202 受理，需继续轮询 {@link #getGroup} 看终态）。
     * byted_token 是一次性凭证，成功后只允许调用一次（本地用 validateCalledAt 挡重复回调）。
     */
    void visualValidate(String qgroupid, String resultCode, String bytedToken);

    /**
     * 创建素材（送审）。
     *
     * @param type     image | video | audio
     * @param url      源文件 URL（须可公网拉取）
     * @param qgroupid 真人素材必须显式传已 active 的 liveness 分组；aigc 传 null 走平台默认组
     */
    AssetState createAsset(String type, String name, String model, String url, String qgroupid);

    AssetState getAsset(String qassetid);
}
