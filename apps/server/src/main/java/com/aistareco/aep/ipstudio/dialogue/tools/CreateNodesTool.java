package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueCanvasDigest;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.Connection;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.NodeUpsertData;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Proposes ordinary canvas nodes (text / image / video / audio drafts) and their connections as node.upsert events.
 * The client applies them through its normal save chain; the server never writes the canvas document. Media nodes are
 * drafts only: generating them is a separate, authorized step.
 */
@Component
public class CreateNodesTool implements StudioDialogueTool {
    static final int MAX_NODES = 12, MAX_CONNECTIONS = 24;
    static final Set<String> TYPES = Set.of("text", "image", "video", "audio");
    public String name() { return "create_nodes"; }
    public String title() { return "搭建画布"; }
    public String description() { return "在画布上新建普通对象（文字正文、图片/视频/音频的提示词草稿）并可连线。每个对象给一个临时 key，连线可用 key 或已有对象 id。"
            + "图片/视频对象把用户说过的画幅、时长、数量和要用的参考素材写进 aspectRatio / durationSec / count / references（不要只写在提示词里），生成面板会按这些打开。只建草稿，不会生成图片或视频。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m, "nodes");
        var nodes = DialogueTools.prop(s, "nodes", "array", "最多 12 个对象");
        var item = nodes.putObject("items").put("type", "object");
        var p = item.putObject("properties");
        p.putObject("key").put("type", "string").put("description", "本次调用内的临时标识");
        p.putObject("type").put("type", "string").putArray("enum").add("text").add("image").add("video").add("audio");
        p.putObject("title").put("type", "string");
        p.putObject("content").put("type", "string").put("description", "文字对象的正文");
        p.putObject("prompt").put("type", "string").put("description", "图片/视频/音频对象的提示词草稿");
        NodeSpecs.describe(p);
        item.putArray("required").add("key").add("type").add("title");
        var conns = DialogueTools.prop(s, "connections", "array", "连线（上游 → 下游），最多 24 条");
        var c = conns.putObject("items").put("type", "object");
        c.putObject("properties").putObject("from").put("type", "string");
        ((ObjectNode) c.path("properties")).putObject("to").put("type", "string");
        c.putArray("required").add("from").add("to");
        return s;
    }
    public String validate(JsonNode args, ToolContext ctx) {
        JsonNode nodes = args.path("nodes");
        if (!nodes.isArray() || nodes.isEmpty() || nodes.size() > MAX_NODES) return "一次新建 1 到 12 个对象";
        Set<String> keys = new HashSet<>();
        for (JsonNode n : nodes) { String k = DialogueTools.text(n, "key"); if (k != null) keys.add(k); }
        JsonNode doc = ctx.effects.readDoc();
        for (JsonNode n : nodes) {
            String spec = NodeSpecs.validate(n, DialogueTools.text(n, "type"), doc, keys);
            if (spec != null) return spec;
        }
        keys.clear();
        for (JsonNode n : nodes) {
            String key = DialogueTools.text(n, "key"), type = DialogueTools.text(n, "type"), title = DialogueTools.text(n, "title");
            if (key == null || key.length() > 64 || !keys.add(key)) return "每个对象需要唯一的 key";
            if (!TYPES.contains(String.valueOf(type))) return "对象类型只能是 text、image、video、audio";
            if (title == null || title.length() > 64) return "对象标题不能为空且不超过 64 字";
            if (n.path("content").asText("").length() > 16000 || n.path("prompt").asText("").length() > 4000) return "正文最多 16000 字、提示词最多 4000 字";
        }
        JsonNode conns = args.path("connections");
        if (conns.isMissingNode() || conns.isNull()) return null;
        if (!conns.isArray() || conns.size() > MAX_CONNECTIONS) return "连线最多 24 条";
        Set<String> existing = DialogueCanvasDigest.nodeIds(doc);
        existing.addAll(ctx.createdNodeIds);
        for (JsonNode c : conns) {
            String from = DialogueTools.text(c, "from"), to = DialogueTools.text(c, "to");
            if (from == null || to == null || from.equals(to)) return "连线需要两个不同的对象";
            if (!keys.contains(from) && !existing.contains(from) || !keys.contains(to) && !existing.contains(to)) return "连线引用了不存在的对象";
        }
        return null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) {
        int conns = args.path("connections").size();
        return "新建 " + args.path("nodes").size() + " 个对象" + (conns > 0 ? "，连 " + conns + " 条线" : "");
    }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        JsonNode doc = ctx.effects.readDoc();
        double[] origin = origin(doc);
        Map<String, String> ids = new LinkedHashMap<>();
        List<NodeUpsertData> upserts = new ArrayList<>(), referenceEdges = new ArrayList<>();
        var created = DialogueTools.OM.createArrayNode();
        int i = 0;
        for (JsonNode spec : args.path("nodes")) {
            String id = "dlg-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            String type = DialogueTools.text(spec, "type");
            ids.put(DialogueTools.text(spec, "key"), id);
            int[] size = size(type);
            ObjectNode node = DialogueTools.OM.createObjectNode().put("id", id).put("type", type).put("title", DialogueTools.text(spec, "title"));
            node.putObject("position").put("x", origin[0] + (i % 3) * 400).put("y", origin[1] + (i / 3) * 380);
            node.put("width", size[0]).put("height", size[1]);
            ObjectNode md = node.putObject("metadata");
            if ("text".equals(type)) md.put("content", spec.path("content").asText(""));
            else md.put("prompt", spec.path("prompt").asText(""));
            ObjectNode settings = NodeSpecs.spec(spec, DialogueTools.OM);
            if (settings != null) md.putObject("studio").put("kind", "shot").set("spec", settings);
            upserts.add(new NodeUpsertData(id, "create", node, null, ctx.executionId, null, null, null, null));
            var item = created.addObject().put("key", DialogueTools.text(spec, "key")).put("id", id).put("type", type).put("title", node.path("title").asText());
            if (settings != null) item.put("settings", NodeSpecs.summary(settings));
            // References are edges into the node: the composer and the request read inputs from these connections.
            for (JsonNode r : settings == null ? DialogueTools.OM.createArrayNode() : settings.path("references"))
                referenceEdges.add(new NodeUpsertData(id, "connect", null, new Connection(r.path("nodeId").asText(), id), ctx.executionId, null, null, null, null));
            ctx.createdNodeIds.add(id);
            i++;
        }
        upserts.addAll(referenceEdges);
        for (JsonNode c : args.path("connections")) {
            String from = ids.getOrDefault(DialogueTools.text(c, "from"), DialogueTools.text(c, "from"));
            String to = ids.getOrDefault(DialogueTools.text(c, "to"), DialogueTools.text(c, "to"));
            upserts.add(new NodeUpsertData(to, "connect", null, new Connection(from, to), ctx.executionId, null, null, null, null));
        }
        ctx.effects.publishNodeUpserts(upserts);
        var body = DialogueTools.OM.createObjectNode();
        body.set("created", created);
        body.put("connections", args.path("connections").size()).put("note", "对象已发到画布，由画布保存；之后可用 read_canvas 确认");
        return ToolRun.done("已在画布上新建 " + ids.size() + " 个对象", DialogueTools.ok(body)).withNodes(List.copyOf(ids.values()));
    }

    /** Place new nodes to the right of the existing content so they never cover the user's work. */
    static double[] origin(JsonNode doc) {
        double maxX = Double.NEGATIVE_INFINITY, minY = Double.POSITIVE_INFINITY;
        for (JsonNode n : IpDocs.nodes(doc)) {
            double x = n.path("position").path("x").asDouble(0) + n.path("width").asDouble(320);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, n.path("position").path("y").asDouble(0));
        }
        return Double.isInfinite(maxX) ? new double[]{0, 0} : new double[]{maxX + 120, minY};
    }

    static int[] size(String type) {
        return switch (type) {
            case "image" -> new int[]{320, 320};
            case "video" -> new int[]{360, 240};
            case "audio" -> new int[]{320, 140};
            default -> new int[]{320, 240};
        };
    }
}
