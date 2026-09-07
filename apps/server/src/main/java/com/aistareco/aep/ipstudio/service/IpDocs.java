package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 画布文档的只读访问器。
 *
 * <p><b>文档形状（v0.157 起）</b>：与画布前端同一份结构（{@code src/canvas/types/canvas.ts}）——
 * <pre>
 * { nodes: [{ id, type, title, position, width, height, metadata:{…} }],
 *   connections: [{ id, fromNodeId, toNodeId }],
 *   viewport: { x, y, k } }
 * </pre>
 *
 * <p>此前是一套「照片 / 特征卡 / 风格 / 形象卡 / 出图」的定型节点，一张图要连四个节点才能跑。
 * 画布换成 basketikun/infinite-canvas 之后，节点只有图 / 文字 / 视频这些通用类型，
 * 「要生成什么」写在节点自己的 {@code metadata.prompt} 里，参考图就是连进来的上游图节点 ——
 * 一致性不再靠节点类型强制，靠的是把上游图当参考图喂下去。
 *
 * <p>文档是**客户端拥有**的：服务端整存整取、不改内容（与画布同一条纪律）。这里只读不写。
 */
public final class IpDocs {

    /** 节点类型 —— 与前端 CanvasNodeType 逐字一致。 */
    public static final String T_IMAGE = "image";
    public static final String T_TEXT = "text";
    public static final String T_VIDEO = "video";
    public static final String T_AUDIO = "audio";
    public static final String T_CONFIG = "config";
    public static final String T_GROUP = "group";

    /** 能作为参考图喂给模型的节点类型。 */
    private static final Set<String> REFERENCEABLE = Set.of(T_IMAGE, T_VIDEO);

    /** 上游回溯的跳数上限 —— 防环已由 visited 保证，这条只防超长链把一次编译拖垮。 */
    private static final int MAX_UPSTREAM_DEPTH = 6;

    private IpDocs() {}

    public static ObjectNode emptyDoc(ObjectMapper om) {
        ObjectNode doc = om.createObjectNode();
        doc.putArray("nodes");
        doc.putArray("connections");
        ObjectNode vp = doc.putObject("viewport");
        vp.put("x", 0).put("y", 0).put("k", 1);
        return doc;
    }

    /**
     * 文档得是个能认的形状才收。
     *
     * <p>只validates外形不校验内容 —— 内容是客户端的事。但形状不对就直接拒，
     * 否则一个手写的坏 JSON 会一路带到运行编译才炸，错误信息还指不到点上。
     */
    public static void requireValidDoc(JsonNode doc) {
        if (doc == null || !doc.isObject()) {
            throw BusinessException.badRequest("IP_DOC_INVALID", "画布内容格式不对");
        }
        if (!doc.path("nodes").isArray() || !doc.path("connections").isArray()) {
            throw BusinessException.badRequest("IP_DOC_INVALID", "画布内容缺 nodes / connections");
        }
    }

    public static List<JsonNode> nodes(JsonNode doc) {
        JsonNode arr = doc == null ? null : doc.path("nodes");
        if (arr == null || !arr.isArray()) return List.of();
        List<JsonNode> out = new ArrayList<>();
        arr.forEach(out::add);
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

    /** 节点的业务数据。画布把一切都放在 metadata 里（提示词 / 模型 / 尺寸 / 图集…）。 */
    public static JsonNode metadataOf(JsonNode node) {
        if (node == null) return null;
        JsonNode m = node.path("metadata");
        return m.isObject() ? m : null;
    }

    /** 取字段的非空文本；空串按不存在处理（画布会把清空的输入留成 ""）。 */
    public static String text(JsonNode data, String field) {
        if (data == null) return null;
        JsonNode v = data.path(field);
        if (!v.isTextual()) return null;
        String s = v.asText().trim();
        return s.isEmpty() ? null : s;
    }

    /** 直接上游（连进这个节点的那些）。顺序即连线顺序 —— 参考图的先后由用户连线决定。 */
    public static List<JsonNode> upstream(JsonNode doc, String nodeId) {
        if (nodeId == null) return List.of();
        JsonNode conns = doc == null ? null : doc.path("connections");
        if (conns == null || !conns.isArray()) return List.of();
        List<JsonNode> out = new ArrayList<>();
        for (JsonNode c : conns) {
            if (!nodeId.equals(c.path("toNodeId").asText(null))) continue;
            JsonNode up = node(doc, c.path("fromNodeId").asText(null));
            if (up != null) out.add(up);
        }
        return out;
    }

    /**
     * 沿上游收集可作参考的节点（图 / 视频），近的排前面、去重、有界。
     *
     * <p>为什么要往上多走几层：用户常常是「照片 → 主形象 → 换个装」这样一层层接下去，
     * 只看直接上游会把原始照片这个身份锚丢掉。但也不能无界 ——
     * 一条长链上所有历史产物都当参考图喂进去，模型只会被拖花。
     */
    public static List<JsonNode> referenceChain(JsonNode doc, String nodeId) {
        List<JsonNode> out = new ArrayList<>();
        Set<String> visited = new LinkedHashSet<>();
        visited.add(nodeId);
        List<String> frontier = List.of(nodeId);
        for (int depth = 0; depth < MAX_UPSTREAM_DEPTH && !frontier.isEmpty(); depth++) {
            List<String> next = new ArrayList<>();
            for (String cur : frontier) {
                for (JsonNode up : upstream(doc, cur)) {
                    String id = up.path("id").asText(null);
                    if (id == null || !visited.add(id)) continue;
                    next.add(id);
                    if (REFERENCEABLE.contains(typeOf(up))) out.add(up);
                }
            }
            frontier = next;
        }
        return Collections.unmodifiableList(out);
    }

    /**
     * 节点上「已经出好的那张图」的存储键。
     *
     * <p>画布的图节点可以带多张候选（{@code metadata.images[]}）并用
     * {@code primaryImageId} 指定用哪张；也可能只有节点级的单个 {@code storageKey}。
     * 两种都要认，否则用户明明看到图、连过去却说没有参考。
     */
    public static String primaryStorageKey(JsonNode node) {
        JsonNode md = metadataOf(node);
        if (md == null) return null;
        String direct = text(md, "storageKey");
        JsonNode images = md.path("images");
        if (images.isArray() && !images.isEmpty()) {
            String primaryId = text(md, "primaryImageId");
            JsonNode chosen = null;
            for (JsonNode img : images) {
                if (primaryId != null && primaryId.equals(img.path("id").asText(null))) { chosen = img; break; }
                if (chosen == null && text(img, "storageKey") != null) chosen = img;
            }
            if (chosen != null) {
                String key = text(chosen, "storageKey");
                if (key != null) return key;
            }
        }
        return direct;
    }
}
