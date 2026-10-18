package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueCanvasDigest;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.Connection;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.NodeUpsertData;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Proposes connections between existing (or just created) nodes; applied by the client's save chain. */
@Component
public class ConnectNodesTool implements StudioDialogueTool {
    public String name() { return "connect_nodes"; }
    public String title() { return "连线"; }
    public String description() { return "把画布上的对象连起来（上游 → 下游，例如参考图 → 视频）。最多 24 条。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m, "connections");
        var c = DialogueTools.prop(s, "connections", "array", "连线列表").putObject("items").put("type", "object");
        var p = c.putObject("properties");
        p.putObject("fromNodeId").put("type", "string");
        p.putObject("toNodeId").put("type", "string");
        c.putArray("required").add("fromNodeId").add("toNodeId");
        return s;
    }
    public String validate(JsonNode args, ToolContext ctx) {
        JsonNode conns = args.path("connections");
        if (!conns.isArray() || conns.isEmpty() || conns.size() > CreateNodesTool.MAX_CONNECTIONS) return "一次连 1 到 24 条线";
        Set<String> ids = DialogueCanvasDigest.nodeIds(ctx.effects.readDoc());
        ids.addAll(ctx.createdNodeIds);
        for (JsonNode c : conns) {
            String from = DialogueTools.text(c, "fromNodeId"), to = DialogueTools.text(c, "toNodeId");
            if (from == null || to == null || from.equals(to)) return "连线需要两个不同的对象";
            if (!ids.contains(from) || !ids.contains(to)) return "连线引用了不存在的对象";
        }
        return null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) { return "连 " + args.path("connections").size() + " 条线"; }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        List<NodeUpsertData> upserts = new ArrayList<>();
        for (JsonNode c : args.path("connections")) {
            String from = DialogueTools.text(c, "fromNodeId"), to = DialogueTools.text(c, "toNodeId");
            upserts.add(new NodeUpsertData(to, "connect", null, new Connection(from, to), ctx.executionId, null, null, null, null));
        }
        ctx.effects.publishNodeUpserts(upserts);
        return ToolRun.done("已连 " + upserts.size() + " 条线", DialogueTools.ok(DialogueTools.OM.createObjectNode().put("connections", upserts.size())));
    }
}
