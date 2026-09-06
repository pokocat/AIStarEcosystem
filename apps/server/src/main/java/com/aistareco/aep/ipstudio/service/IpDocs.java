package com.aistareco.aep.ipstudio.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.aistareco.common.BusinessException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 画布文档（{@code IpProjectDoc}）的只读导航工具。
 *
 * <p>刻意只读：文档是客户端拥有的整存整取块，服务端读它来编译运行输入，
 * 但绝不往里写运行/发布结果（见 {@code IpRun} 的类注释）。
 *
 * <p>节点形态 {@code {id, position, label?, type, data}}；边 {@code {id, source, target}}。
 */
public final class IpDocs {

    public static final String T_SOURCE = "source";
    public static final String T_IDENTITY = "identity";
    public static final String T_STYLE = "style";
    public static final String T_LOOK = "look";
    public static final String T_GENERATE = "generate";
    public static final String T_REFERENCE = "reference";
    public static final String T_PUBLISH = "publish";

    private IpDocs() {}

    /** 空白画布骨架。 */
    public static ObjectNode emptyDoc(ObjectMapper om) {
        ObjectNode doc = om.createObjectNode();
        doc.putArray("nodes");
        doc.putArray("edges");
        ObjectNode vp = doc.putObject("viewport");
        vp.put("x", 0);
        vp.put("y", 0);
        vp.put("zoom", 1);
        return doc;
    }

    /**
     * 校验客户端提交的文档：必须是含 nodes / edges 数组的对象。
     *
     * <p>不做更深的形状校验 —— 文档是客户端拥有的，后端多写一条规则就多一次
     * 「前端加了字段、后端 400」的联调事故。这里挡的只是「明显不是一张画布」。
     */
    public static void requireValidDoc(JsonNode doc) {
        if (doc == null || !doc.isObject()
                || !doc.path("nodes").isArray() || !doc.path("edges").isArray()) {
            throw BusinessException.badRequest("IP_DOC_INVALID",
                    "画布数据格式不正确（需要包含 nodes / edges 的对象）");
        }
    }

    public static List<JsonNode> nodes(JsonNode doc) {
        List<JsonNode> out = new ArrayList<>();
        if (doc == null) return out;
        JsonNode arr = doc.path("nodes");
        if (arr.isArray()) arr.forEach(out::add);
        return out;
    }

    public static JsonNode node(JsonNode doc, String nodeId) {
        if (nodeId == null) return null;
        for (JsonNode n : nodes(doc)) {
            if (nodeId.equals(n.path("id").asText(null))) return n;
        }
        return null;
    }

    public static String typeOf(JsonNode node) {
        return node == null ? null : node.path("type").asText(null);
    }

    public static JsonNode dataOf(JsonNode node) {
        return node == null ? null : node.path("data");
    }

    public static String text(JsonNode data, String field) {
        if (data == null) return null;
        JsonNode v = data.path(field);
        if (!v.isTextual()) return null;
        String s = v.asText().trim();
        return s.isEmpty() ? null : s;
    }

    /** nodeId → 直接上游节点（沿入边），保持 edges 顺序 —— 客户端连线顺序即用户意图顺序。 */
    public static List<JsonNode> upstream(JsonNode doc, String nodeId) {
        Map<String, JsonNode> byId = new LinkedHashMap<>();
        for (JsonNode n : nodes(doc)) {
            String id = n.path("id").asText(null);
            if (id != null) byId.put(id, n);
        }
        List<JsonNode> out = new ArrayList<>();
        JsonNode edges = doc == null ? null : doc.path("edges");
        if (edges != null && edges.isArray()) {
            for (JsonNode e : edges) {
                if (!nodeId.equals(e.path("target").asText(null))) continue;
                JsonNode src = byId.get(e.path("source").asText(null));
                if (src != null && !out.contains(src)) out.add(src);
            }
        }
        return out;
    }

    /**
     * 沿入边向上广度遍历，收集指定类型的节点（深度受限，防客户端提交环形图把服务端转死）。
     *
     * <p>为什么要向上多跳：模板里 {@code style} / {@code identity} 通常挂在 master generate 上，
     * 各 look 的 generate 只连 {@code look} + master。用户不该为了让风格生效而把风格节点
     * 手动连到每一个 generate 上。
     */
    public static List<JsonNode> ancestorsOfType(JsonNode doc, String nodeId, String type, int maxDepth) {
        List<JsonNode> out = new ArrayList<>();
        List<String> frontier = List.of(nodeId);
        List<String> visited = new ArrayList<>();
        visited.add(nodeId);
        for (int depth = 0; depth < Math.max(1, maxDepth) && !frontier.isEmpty(); depth++) {
            List<String> next = new ArrayList<>();
            for (String cur : frontier) {
                for (JsonNode up : upstream(doc, cur)) {
                    String id = up.path("id").asText(null);
                    if (id == null || visited.contains(id)) continue;
                    visited.add(id);
                    next.add(id);
                    if (type.equals(typeOf(up)) && !out.contains(up)) out.add(up);
                }
            }
            frontier = next;
        }
        return out;
    }
}
