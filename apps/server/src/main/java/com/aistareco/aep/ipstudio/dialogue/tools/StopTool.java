package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueLoop;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

/** Loop marker: the model says this turn's reply is complete. No side effect, no work-record card. */
@Component
public class StopTool implements StudioDialogueTool {
    public String name() { return "stop"; }
    public String title() { return "结束本轮"; }
    public String description() { return "本轮回复已完成、不需要再调用工具时使用。"; }
    public ObjectNode parameters(ObjectMapper m) { return DialogueTools.schema(m); }
    public boolean recorded() { return false; }
    public String safeInputSummary(JsonNode args, ToolContext ctx) { return "结束本轮"; }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        return ToolRun.done("本轮结束", DialogueTools.ok(DialogueTools.OM.createObjectNode())).withEnd(DialogueLoop.Reason.COMPLETED);
    }
}
