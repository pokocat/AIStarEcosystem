package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.StudioDialogueEventTypes;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.NodeUpsertData;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.Proposal;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Set;

/**
 * Proposes a replacement for a user-authored field. Never overwrites: the client shows an adoption card and only an
 * explicit user adoption writes it back (with the snapshot taken here for conflict detection).
 */
@Component
public class ProposeTextTool implements StudioDialogueTool {
    public String name() { return "propose_text"; }
    public String title() { return "改稿建议"; }
    public String description() { return "为画布上已有对象提出完整的修改稿：文字正文（content）、剧本（script）或图片/视频/音频的提示词（prompt）。只是建议，用户采用后才写回。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m, "nodeId", "field", "content");
        DialogueTools.prop(s, "nodeId", "string", "要修改的对象 id");
        DialogueTools.prop(s, "field", "string", "content | prompt | script").putArray("enum").add("content").add("prompt").add("script");
        DialogueTools.prop(s, "content", "string", "完整修改稿，≤16000 字");
        return s;
    }
    public String validate(JsonNode args, ToolContext ctx) {
        String field = DialogueTools.text(args, "field"), content = args.path("content").asText("");
        if (!Set.of("content", "prompt", "script").contains(String.valueOf(field))) return "field 只能是 content、prompt 或 script";
        if (content.isBlank() || content.length() > 16000) return "修改稿不能为空且不超过 16000 字";
        JsonNode node = IpDocs.node(ctx.effects.readDoc(), DialogueTools.text(args, "nodeId"));
        if (node == null) return "画布上没有这个对象，请先 read_canvas 确认 id";
        String type = node.path("type").asText();
        if ("prompt".equals(field) && "text".equals(type)) return "文字对象请修改 content";
        if (!"prompt".equals(field) && !"text".equals(type)) return "图片、视频、音频对象只能修改提示词";
        return null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) {
        JsonNode node = IpDocs.node(ctx.effects.readDoc(), DialogueTools.text(args, "nodeId"));
        String label = switch (String.valueOf(DialogueTools.text(args, "field"))) { case "prompt" -> "提示词"; case "script" -> "剧本"; default -> "正文"; };
        return "为「" + (node == null ? "对象" : DialogueTools.excerpt(node.path("title").asText(), 30)) + "」提出" + label + "修改稿";
    }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        String nodeId = DialogueTools.text(args, "nodeId"), field = DialogueTools.text(args, "field"), content = args.path("content").asText();
        JsonNode node = IpDocs.node(ctx.effects.readDoc(), nodeId);
        if (node == null) return ToolRun.failed("STUDIO_CONTEXT_NOT_FOUND", "这个对象已不在画布上", DialogueTools.fail("对象已不在画布上"));
        JsonNode md = node.path("metadata");
        String snapshot = switch (field) {
            case "script" -> md.path("studio").path("scriptMarkdown").asText(md.path("content").asText(""));
            case "prompt" -> md.path("studio").path("composerDraft").path("prompt").isTextual()
                    ? md.path("studio").path("composerDraft").path("prompt").asText() : md.path("prompt").asText("");
            default -> md.path("content").asText("");
        };
        ObjectNode block = DialogueTools.OM.createObjectNode().put("type", "adoption").put("nodeId", nodeId).put("field", field)
                .put("content", content).put("snapshot", snapshot).put("status", "proposed");
        ctx.effects.appendBlock(block, null, null);
        ctx.effects.publishNodeUpserts(List.of(new NodeUpsertData(nodeId, "propose", null, null, ctx.executionId, null, null, null, new Proposal(field, content))));
        return ToolRun.done("修改稿已给出，等你采用", DialogueTools.ok(DialogueTools.OM.createObjectNode()
                .put("summary", "修改稿已显示给用户，采用前不会改动画布"))).withNodes(List.of(nodeId));
    }
}
