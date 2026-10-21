package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

/**
 * Free: load a skill's method text. When the thread has no skill yet this binds it (stage = the skill's first stage:
 * analysis for 参考视频复刻, production for 原创创作). While no execution runs on the thread, a different key switches the
 * thread to that method: a thread once bound to the wrong method (原创三视图 bound to 参考视频复刻, IPP-51a92043) used to be
 * stuck with a stage whitelist that could never produce an image. Reading a skill never authorizes anything: operations
 * still pass the stage whitelist and paid steps still need authorization.
 */
@Component
public class ReadSkillTool implements StudioDialogueTool {
    private final StudioSkillCatalog catalog;
    public ReadSkillTool(StudioSkillCatalog catalog) { this.catalog = catalog; }
    public String name() { return "read_skill"; }
    public String title() { return "读取制作方法"; }
    public String description() { return "读取制作方法（技能）的完整说明并选定它。给出 key 即选定该方法（没有进行中的制作时，也可以换成另一种更合适的方法）；已选定时可省略 key。只选和用户要做的事对得上的方法，不为过流程挂不相关的方法。免费。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m);
        DialogueTools.prop(s, "key", "string", "技能标识；已选定方法时可省略");
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
        return ctx.skill() != null && switching(args, ctx) == null ? "读取「" + ctx.skill().name() + "」的方法说明" : "读取制作方法说明";
    }
    /** The requested key when it differs from the bound skill, else null. */
    private static String switching(JsonNode args, ToolContext ctx) {
        String key = DialogueTools.text(args, "key");
        return ctx.skill() != null && key != null && !key.equals(ctx.skill().key()) ? key : null;
    }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        StudioSkill skill = ctx.skill();
        if (skill == null || switching(args, ctx) != null) {
            try { skill = catalog.requireForNewSelection(DialogueTools.text(args, "key")); } // binding a new thread: active skills only
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
