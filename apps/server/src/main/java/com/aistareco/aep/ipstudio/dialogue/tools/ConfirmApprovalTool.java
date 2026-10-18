package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.IpDialogueMessage;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueMessageRepository;
import com.aistareco.aep.ipstudio.dialogue.StudioExecutionGate;
import com.aistareco.aep.ipstudio.dto.StudioPlanDtos.PlanExecution;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * D04: the user approved a pending card in words ("就按这个做，上限 300"). The model only names the card and the caps the
 * user said; the authority is the user's own message of this turn, and every check is the server's: the card is still
 * the pending card of the thread's current plan revision and was shown before that message, the message is not a
 * question or hesitation, no cap goes above the card unless the user wrote that number, the payer is the card's, and the
 * execution is created / confirmed through exactly the path the card button uses (StudioPlanExecutionService).
 */
@Component
public class ConfirmApprovalTool implements StudioDialogueTool {
    private final ObjectProvider<StudioExecutionGate> gates;
    private final IpDialogueMessageRepository messages;

    public ConfirmApprovalTool(ObjectProvider<StudioExecutionGate> gates, IpDialogueMessageRepository messages) {
        this.gates = gates; this.messages = messages;
    }

    public String name() { return "confirm_approval"; }
    public String title() { return "按你的确认开始"; }
    public String description() {
        return "只在用户这一轮明确同意了某张待确认卡时调用（例如「就按这个方案开始，上限 300 积分」）。传卡片的 approvalId；"
                + "用户亲口说了总上限或重做额度才传 budgetCap / autoFixCap，没说就省略（按卡片上的）。服务端会核对卡片仍是最新的那张、"
                + "数字是用户说过的，再像点按钮一样开始。用户在提问、讨论、犹豫、没说清确认哪份方案，或这一轮之前还没有确认卡时，不要调用，先问清楚。";
    }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m, "approvalId");
        DialogueTools.prop(s, "approvalId", "string", "用户同意的那张确认卡的 approvalId");
        DialogueTools.prop(s, "budgetCap", "integer", "用户亲口说的总上限（积分）；没说就省略");
        DialogueTools.prop(s, "autoFixCap", "integer", "用户亲口说的重做额度（积分）；没说就省略");
        return s;
    }
    public String validate(JsonNode args, ToolContext ctx) {
        String id = DialogueTools.text(args, "approvalId");
        if (id == null || id.length() > 64) return "approvalId 不能为空";
        for (String field : new String[]{"budgetCap", "autoFixCap"})
            if (args.has(field) && (!args.path(field).canConvertToLong() || args.path(field).asLong() < 0)) return field + " 必须是非负整数";
        return null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) {
        return args.has("budgetCap") ? "按你的确认开始，上限 " + args.path("budgetCap").asLong() + " 积分" : "按你的确认开始";
    }

    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        if (ctx.mock) return ToolRun.failed("STUDIO_FIXTURE_UNAVAILABLE", "测试响应模式不开始收费制作", DialogueTools.fail("测试响应模式不能开始收费制作，请如实告诉用户"));
        var gate = gates.getIfAvailable();
        if (gate == null) return ToolRun.failed("STUDIO_EXECUTION_UNAVAILABLE", "后台制作尚未开放", DialogueTools.fail("后台制作尚未开放，不能开始；请如实告诉用户"));
        IpDialogueMessage approving = approvingMessage(ctx);
        if (approving == null) return ToolRun.failed("STUDIO_MESSAGE_NOT_FOUND", "没有找到你的确认消息", DialogueTools.fail("这一轮没有用户消息可作为确认，不能开始"));
        String approvalId = DialogueTools.text(args, "approvalId");
        Long cap = args.has("budgetCap") ? args.path("budgetCap").asLong() : null, fix = args.has("autoFixCap") ? args.path("autoFixCap").asLong() : null;
        String requestId = "nl-" + sha1(approving.getId() + "|" + approvalId + "|" + cap + "|" + fix).substring(0, 40);
        try {
            Object result = gate.confirmFromDialogue(ctx.userId, ctx.projectId, new StudioExecutionGate.NaturalApproval(approvalId, approving.getId(), cap, fix, requestId));
            var body = DialogueTools.OM.createObjectNode().put("summary", "已按用户的确认开始，后台会接着做；不要再请用户确认同一张卡");
            String line = "已开始";
            if (result instanceof PlanExecution e) {
                body.put("executionId", e.id()).put("stage", e.stage()).put("status", e.status());
                var budget = e.budgets().stream().filter(b -> b.stage().equals(e.stage())).findFirst().orElse(null);
                if (budget != null) { body.put("approvedCap", budget.approvedCap()); line = "已开始，" + ("production".equals(e.stage()) ? "制作" : "分析") + "上限 " + budget.approvedCap() + " 积分"; }
            }
            return ToolRun.done(line, DialogueTools.ok(body));
        } catch (BusinessException e) {
            return ToolRun.failed(e.getCode(), e.getMessage(), DialogueTools.fail("没有开始（" + e.getMessage() + "）。如实告诉用户原因；需要时请用户点确认卡，或说清确认哪份方案和上限"));
        }
    }

    /** The user's newest message of this turn (its input, or steering it already read): the confirmation source. */
    private IpDialogueMessage approvingMessage(ToolContext ctx) {
        for (var m : messages.findByThreadIdOrderBySeqDesc(ctx.threadId, PageRequest.of(0, 50)))
            // Queued messages carry this turn id too but the model has not read them yet: never an approval source.
            if ("user".equals(m.getRole()) && ctx.turnId.equals(m.getTurnId()) && !IpDialogueMessage.QUEUED.equals(m.getStatus())) return m;
        return null;
    }

    private static String sha1(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
}
