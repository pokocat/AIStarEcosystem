package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueCanvasDigest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.util.List;

/** Free: re-read the saved canvas (catalog, or specific nodes in full). */
@Component
public class ReadCanvasTool implements StudioDialogueTool {
    public String name() { return "read_canvas"; }
    public String title() { return "查看画布"; }
    public String description() { return "重新读取已保存的画布：不带参数返回对象目录与连线；带 nodeIds 返回这些对象的完整内容（最多 8 个）。免费。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m);
        DialogueTools.prop(s, "nodeIds", "array", "要读取完整内容的对象 id").putObject("items").put("type", "string");
        return s;
    }
    public String validate(JsonNode args, ToolContext ctx) {
        return args.has("nodeIds") && (!args.path("nodeIds").isArray() || args.path("nodeIds").size() > 8) ? "nodeIds 最多 8 个" : null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) {
        int n = args.path("nodeIds").size();
        return n == 0 ? "查看画布上的全部对象" : "查看 " + n + " 个对象的完整内容";
    }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        JsonNode doc = ctx.effects.readDoc();
        List<String> ids = DialogueTools.strings(args.path("nodeIds"), 8);
        int count = DialogueCanvasDigest.nodeIds(doc).size();
        String digest;
        if (ids.isEmpty()) digest = DialogueCanvasDigest.build(doc, List.of(), List.of());
        else {
            StringBuilder b = new StringBuilder();
            for (String id : ids) b.append(DialogueCanvasDigest.full(doc, id)).append('\n');
            digest = b.toString();
        }
        var body = DialogueTools.OM.createObjectNode().put("count", count).put("digest", digest);
        return ToolRun.done(ids.isEmpty() ? "画布上有 " + count + " 个对象" : "已读取 " + ids.size() + " 个对象", DialogueTools.ok(body));
    }
}
