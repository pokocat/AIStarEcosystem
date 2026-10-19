package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.NodeUpsertData;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Reference;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Paid image / video generation for a canvas node. Only inside an authorized plan execution: the executor's gate binds the
 * execution's billing and the approved per-step cost before the native pipeline holds anything. Without that the tool
 * refuses ("制作尚未授权") and never freezes credits. The native task keeps running after this turn; the card says so.
 */
@Component
public class SubmitGenerationTool implements StudioDialogueTool {
    static final Set<String> ROLES = Set.of("character", "scene", "product", "frame");
    private final ChildRuns children;
    public SubmitGenerationTool(ChildRuns children) { this.children = children; }

    public String name() { return "submit_generation"; }
    public String title() { return "提交生成"; }
    public String description() { return "在已确认的制作范围和预算内，为画布上的图片或视频对象提交生成。收费；没有已授权的制作时会被拒绝。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m, "operation", "nodeId", "prompt");
        DialogueTools.prop(s, "operation", "string", "image | video").putArray("enum").add("image").add("video");
        DialogueTools.prop(s, "nodeId", "string", "要生成内容的画布对象 id");
        DialogueTools.prop(s, "prompt", "string", "生成指令，≤4000 字");
        DialogueTools.prop(s, "count", "integer", "1、2 或 4");
        DialogueTools.prop(s, "aspectRatio", "string", "画幅，如 9:16");
        DialogueTools.prop(s, "durationSec", "integer", "视频秒数（按模型合同）");
        DialogueTools.prop(s, "model", "string", "模型（省略用默认）");
        var refs = DialogueTools.prop(s, "references", "array", "参考素材（画布对象），按顺序").putObject("items").put("type", "object");
        var p = refs.putObject("properties");
        p.putObject("nodeId").put("type", "string");
        p.putObject("role").put("type", "string").putArray("enum").add("character").add("scene").add("product").add("frame");
        refs.putArray("required").add("nodeId").add("role");
        return s;
    }
    public String operation(JsonNode args) { return DialogueTools.text(args, "operation"); }
    public String validate(JsonNode args, ToolContext ctx) {
        String op = DialogueTools.text(args, "operation");
        if (!Set.of("image", "video").contains(String.valueOf(op))) return "operation 只能是 image 或 video";
        JsonNode doc = ctx.effects.readDoc();
        JsonNode node = IpDocs.node(doc, DialogueTools.text(args, "nodeId"));
        if (node == null || !op.equals(node.path("type").asText())) return "请选择画布上对应类型的对象";
        String prompt = DialogueTools.text(args, "prompt");
        if (prompt == null || prompt.length() > 4000) return "生成指令不能为空且不超过 4000 字";
        if (args.has("count") && !Set.of(1, 2, 4).contains(args.path("count").asInt())) return "数量只能是 1、2 或 4";
        if (args.path("references").size() > 8) return "参考素材最多 8 份";
        for (JsonNode r : args.path("references")) {
            JsonNode ref = IpDocs.node(doc, DialogueTools.text(r, "nodeId"));
            if (ref == null || IpDocs.primaryStorageKey(ref) == null) return "参考素材不存在或还没有内容";
            if (!ROLES.contains(String.valueOf(DialogueTools.text(r, "role")))) return "参考用途不正确";
        }
        return null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) {
        JsonNode node = IpDocs.node(ctx.effects.readDoc(), DialogueTools.text(args, "nodeId"));
        return ("video".equals(DialogueTools.text(args, "operation")) ? "生成视频「" : "生成图片「")
                + (node == null ? "对象" : DialogueTools.excerpt(node.path("title").asText(), 30)) + "」";
    }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        String unavailable = children.unavailableReason(ctx);
        if (unavailable != null)
            return ToolRun.failed(ChildRuns.NOT_AUTHORIZED, unavailable, DialogueTools.fail("生成是收费操作，目前" + unavailable + "。没有提交、没有扣费；不要声称已开始生成。"));
        JsonNode doc = ctx.effects.readDoc();
        List<Reference> refs = new ArrayList<>();
        for (JsonNode r : args.path("references")) {
            JsonNode ref = IpDocs.node(doc, DialogueTools.text(r, "nodeId"));
            refs.add(new Reference(null, null, null, IpDocs.primaryStorageKey(ref), DialogueTools.text(r, "role"), null));
        }
        String nodeId = DialogueTools.text(args, "nodeId");
        var draft = ChildRuns.request(ChildRuns.requestId(ctx), nodeId, DialogueTools.text(args, "operation"), DialogueTools.text(args, "prompt"),
                refs.isEmpty() ? null : refs, DialogueTools.text(args, "model"), args.has("durationSec") ? args.path("durationSec").asInt() : null,
                DialogueTools.text(args, "aspectRatio"), args.has("count") ? args.path("count").asInt() : null, null, null, null, ctx);
        var child = children.submit(ctx, draft, handle);
        ctx.effects.publishNodeUpserts(List.of(new NodeUpsertData(nodeId, "update", null, null, ctx.executionId, null, child.id(), null, null)));
        var body = DialogueTools.OM.createObjectNode().put("runId", child.id()).put("summary", "已提交生成，完成后会出现在画布上");
        return new ToolRun("running", "已提交，完成后出现在画布上", DialogueTools.ok(body), List.of(nodeId), List.of(), child.id(), null, true, null, null, null);
    }
}
