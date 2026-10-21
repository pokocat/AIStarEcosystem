package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

/**
 * Free: load a skill's method text. When the thread has no skill yet this binds it (stage = analysis). Reading a skill
 * never authorizes anything: operations still pass the stage whitelist and paid steps still need authorization.
 */
@Component
public class ReadSkillTool implements StudioDialogueTool {
    private final StudioSkillCatalog catalog;
    public ReadSkillTool(StudioSkillCatalog catalog) { this.catalog = catalog; }
    public String name() { return "read_skill"; }
    public String title() { return "读取制作方法"; }
    public String description() { return "读取制作方法（技能）的完整说明。给出 key 即选定该方法（没有进行中的制作时也可以换成另一种方法）；已选定且不换时可省略 key。免费，对用户无感。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m);
        DialogueTools.prop(s, "key", "string", "技能标识；已选定方法且不换时可省略");
        return s;
    }
    public String validate(JsonNode args, ToolContext ctx) {
        String key = DialogueTools.text(args, "key");
        if (ctx.skill() == null && key == null) return "还没有选定制作方法，请给出技能 key";
        if (ctx.skill() != null && key != null && !key.equals(ctx.skill().key()) && ctx.executionId != null)
            return "本对话正在按「" + ctx.skill().name() + "」制作，制作结束前不能换方法";
        return null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) {
        String key = DialogueTools.text(args, "key");
        if (ctx.skill() != null && (key == null || key.equals(ctx.skill().key()))) return "读取「" + ctx.skill().name() + "」的方法说明";
        return ctx.skill() == null ? "读取制作方法说明" : "换一种制作方法";
    }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        StudioSkill skill = ctx.skill();
        String key = DialogueTools.text(args, "key");
        if (skill == null || (key != null && !key.equals(skill.key()))) {
            try { skill = catalog.requireForNewSelection(key); } // binding or switching: active skills only
            catch (BusinessException e) { return ToolRun.failed(e.getCode(), e.getMessage(), DialogueTools.fail(e.getMessage())); }
            ctx.effects.bindSkill(skill);
        }
        ObjectNode body = DialogueTools.OM.createObjectNode().put("key", skill.key()).put("name", skill.name())
                .put("version", skill.version()).put("stage", ctx.stage());
        var ops = body.putObject("operations");
        skill.operations().forEach((stage, list) -> { var a = ops.putArray(stage); list.forEach(a::add); });
        body.put("body", skill.body());
        return ToolRun.done("已读取「" + skill.name() + "」v" + skill.version(), DialogueTools.ok(body));
    }
}
