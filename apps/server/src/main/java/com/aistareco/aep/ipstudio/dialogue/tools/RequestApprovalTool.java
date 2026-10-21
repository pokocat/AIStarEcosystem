package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueLoop;
import com.aistareco.aep.ipstudio.dialogue.StudioDialogueEventTypes;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Timeline approval card for the latest quoted plan revision. The numbers come only from the server quote on the plan;
 * the card is a request, never an approval: the user confirms through the plan-execution entry. The turn then waits.
 */
@Component
public class RequestApprovalTool implements StudioDialogueTool {
    static final Duration EXPIRES = Duration.ofHours(24);
    public String name() { return "request_approval"; }
    public String title() { return "请你确认"; }
    public String description() { return "请用户确认最新一版方案的范围与预算（报价来自服务端）。可给出用户提过的总上限 budgetCap（不低于报价）；省略时总上限 = 报价 + 重做额度 + 一轮对话的预留。之后本轮结束，等待用户确认；不要替用户同意。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m, "scope");
        DialogueTools.prop(s, "scope", "array", "要做出的东西，每条一句、不超过 20 字，写画面、规格、风格，不写计费、上限、流程，最多 8 条").putObject("items").put("type", "string");
        DialogueTools.prop(s, "budgetCap", "integer", "用户提过的总上限（积分）；省略则等于报价");
        return s;
    }
    public String validate(JsonNode args, ToolContext ctx) {
        JsonNode scope = args.path("scope");
        if (!scope.isArray() || scope.isEmpty() || scope.size() > 8) return "scope 需要 1 到 8 条";
        for (JsonNode s : scope) if (!s.isTextual() || s.asText().isBlank() || s.asText().length() > 200) return "scope 每条不超过 200 字";
        if (args.has("budgetCap") && (!args.path("budgetCap").canConvertToLong() || args.path("budgetCap").asLong() < 0)) return "budgetCap 必须是非负整数";
        return null;
    }
    public boolean recorded() { return false; }
    public String safeInputSummary(JsonNode args, ToolContext ctx) { return "请你确认方案与预算"; }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        var latest = ctx.effects.latestPlanBlock().orElse(null);
        if (latest == null) return ToolRun.failed("STUDIO_PLAN_STALE", "还没有可确认的方案", DialogueTools.fail("还没有方案，请先用 propose_plan 整理方案"));
        JsonNode plan = latest.path("plan");
        if (!plan.path("budget").path("estimated").isIntegralNumber())
            return ToolRun.failed("STUDIO_PRICE_UNAVAILABLE", "方案还没有服务端报价，暂不能确认", DialogueTools.fail("方案没有服务端报价，不能发起确认；请如实告诉用户报价服务暂不可用"));
        long quoted = plan.path("budget").path("estimated").asLong();
        long autoFix = plan.path("budget").path("autoFixCap").asLong(0);
        // D06: turns during the stage count against its cap, so the default leaves room for one turn's ceiling.
        long reserve = ctx.rate == null ? 0 : ctx.rate.maxCost();
        boolean named = args.has("budgetCap");
        long cap = named ? args.path("budgetCap").asLong() : quoted + autoFix + reserve;
        if (cap < quoted) return ToolRun.failed("STUDIO_PLAN_BUDGET_EXCEEDED", "上限低于当前报价",
                DialogueTools.fail("用户给的上限 " + cap + " 低于服务端报价 " + quoted + "，差 " + (quoted - cap) + " 积分。请说明差额和可以缩小的范围。"));
        ObjectNode block = DialogueTools.OM.createObjectNode().put("type", "approval").put("approvalId", "APV-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                .put("stage", plan.path("stage").asText(ctx.stage())).put("planFingerprint", latest.path("fingerprint").asText());
        block.set("scope", args.path("scope").deepCopy());
        block.put("quotedCost", quoted).put("budgetCap", cap).put("autoFixCap", Math.min(autoFix, cap));
        if (!named && reserve > 0) block.put("dialogueReserve", reserve);
        if (ctx.billing != null) block.set("billingSelection", DialogueTools.OM.valueToTree(ctx.billing));
        block.put("status", "pending");
        if (ctx.executionId != null) block.put("executionId", ctx.executionId);
        block.put("expiresAt", Instant.now().plus(EXPIRES).toString());
        var data = DialogueTools.OM.createObjectNode().put("messageId", ctx.assistantMessageId);
        data.set("block", block);
        ctx.effects.appendBlock(block, StudioDialogueEventTypes.APPROVAL_REQUIRED, data);
        return ToolRun.done("等你确认：报价 " + quoted + " 积分", DialogueTools.ok(DialogueTools.OM.createObjectNode()
                .put("summary", "确认卡已显示给用户，等待用户决定").put("quotedCost", quoted).put("budgetCap", cap))).withEnd(DialogueLoop.Reason.WAITING_USER);
    }
}
