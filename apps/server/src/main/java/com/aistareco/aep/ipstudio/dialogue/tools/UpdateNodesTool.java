package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.Connection;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.NodeUpsertData;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Free: set the structured settings ({@link NodeSpecs}) of image / video objects already on the canvas — the one the user
 * made and described in words, typically. The node keeps its title, position and the user's own writing: a new prompt is
 * offered as a suggestion when the node already has one (the client turns it into an adoption card), settings and
 * reference edges are applied. Nothing is generated; a node that is generating is left alone.
 */
@Component
public class UpdateNodesTool implements StudioDialogueTool {
    static final int MAX_NODES = 8;
    public String name() { return "update_nodes"; }
    public String title() { return "调整画布对象"; }
    public String description() {
        return "调整画布上已有的图片 / 视频对象：把用户说过的画幅、时长、数量写进 aspectRatio / durationSec / count，把要用的人物、场景等素材写进 references（会连线，生成时一起提交），需要时给新的提示词 prompt。"
                + "用户在对话里说了规格或要用哪些素材，就用它写到对应对象上，不要只写在提示词或回复里。只改设置，不生成、不收费。";
    }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m, "nodes");
        var item = DialogueTools.prop(s, "nodes", "array", "最多 " + MAX_NODES + " 个对象").putObject("items").put("type", "object");
        var p = item.putObject("properties");
        p.putObject("id").put("type", "string").put("description", "画布上已有的图片或视频对象 id");
        p.putObject("prompt").put("type", "string").put("description", "新的提示词（可选；对象已有提示词时作为建议给用户采纳）");
        NodeSpecs.describe(p);
        item.putArray("required").add("id");
        return s;
    }
    public String validate(JsonNode args, ToolContext ctx) {
        JsonNode nodes = args.path("nodes");
        if (!nodes.isArray() || nodes.isEmpty() || nodes.size() > MAX_NODES) return "一次调整 1 到 " + MAX_NODES + " 个对象";
        JsonNode doc = ctx.effects.readDoc();
        Set<String> ids = new HashSet<>();
        for (JsonNode n : nodes) {
            String id = DialogueTools.text(n, "id");
            if (id == null || !ids.add(id)) return "每个对象需要不重复的 id";
            JsonNode node = IpDocs.node(doc, id);
            if (node == null) return "画布上没有对象 " + id + "（编号要照素材清单原样填写）";
            String type = node.path("type").asText();
            if (!Set.of("image", "video").contains(type)) return "「" + node.path("title").asText() + "」不是图片或视频对象";
            if ("loading".equals(node.path("metadata").path("status").asText())) return "「" + node.path("title").asText() + "」正在生成，等它结束再调整";
            if (n.path("prompt").asText("").length() > 4000) return "提示词最多 4000 字";
            if (!n.has("prompt") && NodeSpecs.spec(n, DialogueTools.OM) == null) return "没有要调整的内容";
            String spec = NodeSpecs.validate(n, type, doc, Set.of());
            if (spec != null) return spec;
            for (JsonNode r : n.path("references")) if (id.equals(DialogueTools.text(r, "nodeId"))) return "对象不能引用它自己";
        }
        return null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) { return "调整 " + args.path("nodes").size() + " 个对象的设置"; }

    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        JsonNode doc = ctx.effects.readDoc();
        List<NodeUpsertData> upserts = new ArrayList<>(), edges = new ArrayList<>();
        var changed = DialogueTools.OM.createArrayNode();
        List<String> ids = new ArrayList<>();
        for (JsonNode n : args.path("nodes")) {
            String id = DialogueTools.text(n, "id");
            JsonNode existing = IpDocs.node(doc, id);
            ObjectNode node = DialogueTools.OM.createObjectNode().put("id", id).put("type", existing.path("type").asText()).put("title", existing.path("title").asText());
            ObjectNode md = node.putObject("metadata");
            if (n.hasNonNull("prompt")) md.put("prompt", n.path("prompt").asText());
            ObjectNode spec = NodeSpecs.spec(n, DialogueTools.OM);
            if (spec != null) md.putObject("studio").set("spec", spec);
            upserts.add(new NodeUpsertData(id, "update", node, null, ctx.executionId, null, null, null, null));
            if (spec != null) for (JsonNode r : spec.path("references"))
                edges.add(new NodeUpsertData(id, "connect", null, new Connection(r.path("nodeId").asText(), id), ctx.executionId, null, null, null, null));
            var item = changed.addObject().put("id", id).put("title", existing.path("title").asText());
            if (spec != null) item.put("settings", NodeSpecs.summary(spec));
            if (n.hasNonNull("prompt")) item.put("prompt", existing.path("metadata").path("prompt").asText("").isBlank() ? "已写入" : "作为建议，等用户采纳");
            ids.add(id);
        }
        upserts.addAll(edges);
        ctx.effects.publishNodeUpserts(upserts);
        var body = DialogueTools.OM.createObjectNode();
        body.set("updated", changed);
        body.put("note", "设置已发到画布，由画布保存。所选模型做不到的画幅或时长，生成面板会在提交前明确提示，不会悄悄改掉");
        return ToolRun.done("已调整 " + ids.size() + " 个对象的设置", DialogueTools.ok(body)).withNodes(List.copyOf(ids));
    }
}
