package com.aistareco.aep.ipstudio.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/** 请求体（docs/ip-studio-plan.md §2 「请求体」段）。 */
public final class IpStudioRequests {

    private IpStudioRequests() {}

    public record IpCreateProjectRequest(String name, String templateId) {}

    public record IpUpdateProjectRequest(String name, JsonNode doc) {}

    /**
     * 运行节点。
     *
     * @param doc 可选：运行前顺手保存最新文档，避免「先 PUT 再 POST」的竞态
     *            （客户端刚拖完线就点运行，防抖 PUT 还没落地）
     */
    public record IpRunNodeRequest(JsonNode doc) {}

    public record IpPublishRequest(String avatarName, String masterNodeId, List<String> lookNodeIds) {}
}
