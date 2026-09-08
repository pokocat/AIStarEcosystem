package com.aistareco.aep.ipstudio.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/** 请求体（docs/ip-studio-plan.md §2 「请求体」段）。 */
public final class IpStudioRequests {

    private IpStudioRequests() {}

    public record IpCreateProjectRequest(String name, String templateId) {}

    /**
     * @param baseDocVersion 客户端加载这份文档时的指纹（IpProjectDto.docVersion）。
     *                      服务端据此拒绝覆盖别处的编辑（多标签页 / 多设备）。
     *                      不传 = 不参与并发控制（老客户端与内部调用保持兼容）。
     */
    public record IpUpdateProjectRequest(String name, JsonNode doc, String baseDocVersion) {
        public IpUpdateProjectRequest(String name, JsonNode doc) { this(name, doc, null); }
    }

    /**
     * 运行节点。
     *
     * @param doc 可选：运行前顺手保存最新文档，避免「先 PUT 再 POST」的竞态
     *            （客户端刚拖完线就点运行，防抖 PUT 还没落地）
     */
    public record IpRunNodeRequest(JsonNode doc) {}

    public record IpPublishRequest(String avatarName, String masterNodeId, List<String> lookNodeIds) {}
}
