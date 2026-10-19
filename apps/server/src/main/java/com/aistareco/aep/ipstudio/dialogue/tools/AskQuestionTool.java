package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueLoop;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.util.UUID;

/** Inline question in the timeline (at most two per turn); the turn then waits for the user. */
@Component
public class AskQuestionTool implements StudioDialogueTool {
    static final int MAX_PER_TURN = 2;
    public String name() { return "ask_question"; }
    public String title() { return "向你确认"; }
    public String description() { return "向用户提一个真正影响结果的问题，可附 2-4 个候选答案（含默认做法）。每轮最多 2 个；提问后本轮结束等待用户。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m, "text");
        DialogueTools.prop(s, "text", "string", "问题正文，≤300 字");
        DialogueTools.prop(s, "options", "array", "候选答案，最多 4 个").putObject("items").put("type", "string");
        return s;
    }
    public boolean recorded() { return false; }
    public String validate(JsonNode args, ToolContext ctx) {
        String text = DialogueTools.text(args, "text");
        if (text == null || text.length() > 300) return "问题不能为空且不超过 300 字";
        if (args.has("options") && (!args.path("options").isArray() || args.path("options").size() > 4)) return "候选答案最多 4 个";
        for (JsonNode o : args.path("options")) if (!o.isTextual() || o.asText().isBlank() || o.asText().length() > 100) return "候选答案每个不超过 100 字";
        return null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) { return DialogueTools.excerpt(DialogueTools.text(args, "text"), 60); }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        if (ctx.nextQuestion() > MAX_PER_TURN) return ToolRun.failed("STUDIO_QUESTION_LIMIT", "本轮问题已经够多了", DialogueTools.fail("本轮最多问 2 个问题，其余按默认处理并在正文说明"));
        ObjectNode block = DialogueTools.OM.createObjectNode().put("type", "question").put("questionId", "Q-" + UUID.randomUUID().toString().substring(0, 8))
                .put("text", DialogueTools.text(args, "text"));
        if (args.path("options").isArray() && !args.path("options").isEmpty()) block.set("options", args.path("options").deepCopy());
        ctx.effects.appendBlock(block, null, null);
        return ToolRun.done("已向你提问", DialogueTools.ok(DialogueTools.OM.createObjectNode().put("summary", "问题已显示给用户，等待回复")))
                .withEnd(DialogueLoop.Reason.WAITING_USER);
    }
}
