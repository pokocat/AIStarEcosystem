package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueCanvasDigest;
import com.aistareco.aep.ipstudio.dialogue.StudioExecutionGate;
import com.aistareco.aep.ipstudio.execution.StudioSkillRules;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.aistareco.aep.ipstudio.service.ModelJson;
import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Model-side structured plan inside the parent dialogue run (S1): the same endpoint, JSON mode and prompt
 * {@code dap.ip_studio_skill_plan}. The output is validated by the executor's skill-plan validator against the skill's
 * current-stage whitelist and typed settings, quoted by the executor's quoter when available, fingerprinted with the
 * executor's fingerprint, and stored as a plan block. Tokens count in this turn's own billing; a plan never authorizes
 * anything by itself.
 *
 * <p>The planner's input (stage line, whitelist, the typed {@code settings} contract, model capabilities) comes from
 * {@link StudioWorkflowService} so this tool, the executor's planning runs and the admin dry-run all show the model the same
 * thing. A second hand-written copy of that contract once left out the per-operation field names, and a real model had to
 * guess them.
 */
@Component
public class ProposePlanTool implements StudioDialogueTool {
    private static final Logger log = LoggerFactory.getLogger(ProposePlanTool.class);
    static final int MIN_OUTPUT = 2048, DESIRED_OUTPUT = 8192;
    private final AiModelInvocationService models;
    private final PromptService prompts;
    private final ObjectProvider<StudioWorkflowService> workflow;
    private final ObjectProvider<StudioExecutionGate> quoter;
    private final ObjectMapper mapper;

    public ProposePlanTool(AiModelInvocationService models, PromptService prompts, ObjectProvider<StudioWorkflowService> workflow,
                           ObjectProvider<StudioExecutionGate> quoter, ObjectMapper mapper) {
        this.models = models; this.prompts = prompts; this.workflow = workflow; this.quoter = quoter; this.mapper = mapper;
    }

    public String name() { return "propose_plan"; }
    public String title() { return "整理制作方案"; }
    public String description() { return "按已选制作方法为当前阶段整理制作方案：推荐方案、必要的替代方案、每一步做法与依赖。方案会显示给用户，不会自动执行；报价由服务端计算。没有参考视频的出图、出片（原创三视图、海报、原创短片）用「原创创作」方法，直接整理制作方案，不需要分析阶段。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m, "brief");
        DialogueTools.prop(s, "brief", "string", "用户目标、保留与替换范围、已知事实的整理，≤4000 字");
        DialogueTools.prop(s, "feedback", "string", "用户对上一版方案的反馈，≤2000 字");
        DialogueTools.prop(s, "stage", "string", "analysis（分析方案）| production（制作方案：没有分析阶段的方法直接填它，否则要等分析完成）；省略为当前阶段").putArray("enum").add("analysis").add("production");
        return s;
    }
    public String validate(JsonNode args, ToolContext ctx) {
        if (ctx.skill() == null) return "还没有选定制作方法，请先 read_skill";
        String brief = DialogueTools.text(args, "brief");
        if (brief == null || brief.length() > 4000) return "brief 不能为空且不超过 4000 字";
        if (args.path("feedback").asText("").length() > 2000) return "feedback 不超过 2000 字";
        String stage = DialogueTools.text(args, "stage");
        if (stage != null && !java.util.Set.of("analysis", "production").contains(stage)) return "stage 只能是 analysis 或 production";
        // A direct skill (no analysis operations) proposes its production plan straight away; the others only after analysis.
        if ("production".equals(stage) && ctx.executionId == null && !ctx.skill().direct()) return "还没有进行中的分析，先整理并确认分析方案";
        if ("analysis".equals(stage) && ctx.skill().direct()) return "这个方法没有分析阶段，stage 请填 production";
        return null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) {
        String stage = DialogueTools.text(args, "stage") != null ? DialogueTools.text(args, "stage") : ctx.stage();
        return "按「" + (ctx.skill() == null ? "制作方法" : ctx.skill().name()) + "」整理" + ("production".equals(stage) ? "制作" : "分析") + "方案";
    }

    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) throws Exception {
        if (ctx.mock) return ToolRun.failed("STUDIO_FIXTURE_UNAVAILABLE", "测试响应不生成制作方案", DialogueTools.fail("测试响应模式不生成制作方案，请如实告诉用户"));
        StudioSkill skill = ctx.skill();
        String stage = DialogueTools.text(args, "stage") != null ? DialogueTools.text(args, "stage") : ctx.stage() == null ? skill.firstStage() : ctx.stage();
        var resolved = prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_PLAN);
        if ("code".equals(resolved.origin()))
            return ToolRun.failed("PROMPT_NOT_CONFIGURED", "尚未配置制作方案提示词", DialogueTools.fail("制作方案提示词尚未配置，暂时不能整理方案"));
        JsonNode doc = ctx.effects.readDoc();
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("skill", skill.body());
        StudioSkillRules.Rules rules = StudioSkillRules.fromSnapshot(skill.snapshot(mapper));
        vars.put("stage", StudioWorkflowService.skillPlanStageText(stage));
        vars.put("constraints", StudioWorkflowService.skillPlanConstraints(mapper, rules, stage).toString());
        vars.put("brief", DialogueTools.text(args, "brief"));
        vars.put("analysis", analysis(doc));
        vars.put("assets", assets(doc, ctx));
        vars.put("capabilities", capabilities());
        vars.put("budget", ctx.executionId == null ? "尚未批准任何制作预算（报价由服务端计算，用户确认后才执行）" : "已有进行中的制作，预算以服务端记录为准");
        vars.put("feedback", args.path("feedback").asText("（无）"));
        List<Map<String, Object>> messages = List.of(Map.of("role", "system", "content", resolved.system()),
                Map.of("role", "user", "content", PromptService.fill(resolved.userTemplate(), vars)));
        long estimate = estimate(messages);
        String blocked = ctx.budget.blockReason(estimate, MIN_OUTPUT);
        if (blocked != null) return ToolRun.failed("STUDIO_TURN_BUDGET", "本轮额度不够整理方案", DialogueTools.fail("本轮的模型额度不足以整理完整方案，请告诉用户回复后继续"));
        ctx.effects.beforeModelCall();
        ctx.budget.beginSubCall();
        var options = new HashMap<String, Object>();
        options.put("timeout_seconds", 300);
        options.put("max_tokens", ctx.budget.outputAllowance(DESIRED_OUTPUT));
        options.put("temperature", 0.4);
        options.put("response_format", Map.of("type", "json_object"));
        var reply = models.invokeChatTurnOnEndpoint(ctx.endpoint, AiModelPurpose.DAP_PERSONA, messages, options, null, null);
        if (reply.promptTokens() == null || reply.completionTokens() == null)
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_USAGE_MISSING", "模型未返回有效Token用量，本次未扣积分");
        ctx.budget.record(reply.promptTokens(), reply.completionTokens());
        if ("length".equals(reply.finishReason()))
            return ToolRun.failed("AI_BAD_OUTPUT", "方案太长被截断了", DialogueTools.fail("方案输出被截断，请缩小范围（减少段数或步骤）后重试")).settlingInTurn();
        JsonNode raw;
        try { raw = ModelJson.parse(mapper, reply.content()); }
        catch (Exception e) { raw = null; }
        if (raw == null || !raw.isObject()) {
            log.info("[dialogue] plan reply is not a JSON object run={} finish={} chars={}", ctx.runId, reply.finishReason(), reply.content() == null ? 0 : reply.content().length());
            return ToolRun.failed("AI_BAD_OUTPUT", "方案格式不完整", DialogueTools.fail("方案不是有效 JSON，请重新整理")).settlingInTurn();
        }
        Set<String> contextIds = DialogueCanvasDigest.nodeIds(doc);
        contextIds.addAll(ctx.createdNodeIds);
        ObjectNode plan;
        try { plan = StudioPlanValidator.validateSkillPlan(raw, rules, stage, contextIds); }
        catch (BusinessException e) {
            log.info("[dialogue] plan rejected run={} code={} reason={}", ctx.runId, e.getCode(), e.getMessage());
            return ToolRun.failed(e.getCode(), e.getMessage(), DialogueTools.fail(e.getMessage() + "。请按允许的操作和参数重新整理方案。")).settlingInTurn();
        }
        Set<String> offered = needsVideo(plan) ? offeredVideoModels() : null;
        if (offered != null && offered.isEmpty()) {
            log.info("[dialogue] plan needs a video model but none is offered run={}", ctx.runId);
            return ToolRun.failed("VIDEO_NOT_CONFIGURED", "现在没有可用的视频模型",
                    DialogueTools.fail("现在没有可用的视频模型（后台还没有为视频生成配置模型），含拉片或出片的方案暂时做不了。"
                            + "如实告诉用户，不要换一个模型名重试，也不要估算价格")).settlingInTurn();
        }
        String unknown = unknownVideoModel(plan);
        if (unknown != null) {
            log.info("[dialogue] plan names a video model that is not offered run={} {}", ctx.runId, unknown);
            return ToolRun.failed("AI_BAD_OUTPUT", "方案里的视频模型不可用", DialogueTools.fail(unknown + "。请重新整理方案。")).settlingInTurn();
        }
        plan.put("skillKey", skill.key()).put("skillVersion", skill.version()).put("stage", stage);
        boolean quoted = false;
        var planQuoter = quoter.getIfAvailable();
        if (planQuoter != null) {
            try { planQuoter.quotePlan(ctx.userId, ctx.projectId, plan); quoted = true; }
            catch (BusinessException e) {
                log.info("[dialogue] plan quote unavailable run={} code={} reason={}", ctx.runId, e.getCode(), e.getMessage());
                return ToolRun.failed(e.getCode(), "方案暂时无法报价：" + e.getMessage(),
                        DialogueTools.fail("方案暂时无法报价（" + e.getMessage() + "），请如实告诉用户，不要估算价格")).settlingInTurn();
            }
        }
        String fingerprint = StudioPlanValidator.fingerprint(plan);
        ObjectNode block = ctx.effects.appendPlan(plan, fingerprint);
        var body = DialogueTools.OM.createObjectNode().put("revision", block.path("revision").asInt()).put("summary", plan.path("summary").asText())
                .put("steps", plan.path("steps").size()).put("quoted", quoted);
        if (quoted) body.put("estimatedCredits", plan.path("budget").path("estimated").asLong());
        var approaches = body.putArray("approaches");
        for (JsonNode a : plan.path("approaches")) approaches.addObject().put("id", a.path("id").asText()).put("title", a.path("title").asText());
        body.put("note", "方案已显示给用户；用户确认方案和预算前不会执行。" + (quoted ? "" : "服务端暂时没有报价，不要自行估价。"));
        return new ToolRun("done", "方案第 " + block.path("revision").asInt() + " 版：" + plan.path("steps").size() + " 步"
                + (quoted ? "，报价 " + plan.path("budget").path("estimated").asLong() + " 积分" : ""),
                DialogueTools.ok(body), List.of(), List.of(), null, null, true, null, null, null);
    }

    /**
     * The saved canvas catalog plus the objects this turn created that the canvas has not saved yet: a draft the assistant
     * just made for this step is what {@code targetNodeId} should name (docs/ip-studio-new-canvas-and-threads.md §6.1).
     */
    static String assets(JsonNode doc, ToolContext ctx) {
        String saved = DialogueCanvasDigest.build(doc, List.of(), List.of());
        Set<String> present = DialogueCanvasDigest.nodeIds(doc);
        StringBuilder fresh = new StringBuilder();
        for (var entry : ctx.createdNodeLines.entrySet()) if (!present.contains(entry.getKey())) fresh.append(entry.getValue()).append('\n');
        return fresh.length() == 0 ? saved : saved + "本轮刚新建、画布还没保存的对象：\n" + fresh;
    }

    static String analysis(JsonNode doc) {
        StringBuilder out = new StringBuilder();
        int n = 0;
        for (JsonNode node : IpDocs.nodes(doc)) {
            if (!"recreation".equals(node.path("metadata").path("studio").path("kind").asText())) continue;
            String content = node.path("metadata").path("content").asText("");
            if (content.isBlank()) continue;
            out.append("[").append(node.path("id").asText()).append("] ").append(node.path("title").asText()).append("\n")
                    .append(DialogueTools.excerpt(content, 6000)).append("\n");
            if (++n >= 2) break;
        }
        return out.length() == 0 ? "（还没有分析结果）" : out.toString();
    }

    private String capabilitiesJson() {
        var planner = workflow.getIfAvailable();
        if (planner == null) return null;
        try {
            return planner.planCapabilities();
        } catch (RuntimeException e) {
            log.warn("[dialogue] video capabilities unavailable: {}", e.toString());
            return null;
        }
    }

    private String capabilities() {
        String json = capabilitiesJson();
        return json == null ? "（视频模型信息暂不可用）" : DialogueTools.excerpt(json, 8000);
    }

    /**
     * A recreation step has to name one of the endpoints the planner was shown; the quote would otherwise fail much later with
     * a message that tells the assistant to stop. Null when every named model is offered (or the offer could not be read, in
     * which case the quote reports it).
     */
    private String unknownVideoModel(ObjectNode plan) {
        Set<String> offered = offeredVideoModels();
        if (offered == null || offered.isEmpty()) return null;
        int index = 0;
        for (JsonNode step : plan.path("steps")) {
            index++;
            if (!"recreation".equals(step.path("operation").asText())) continue;
            String named = step.path("settings").path("videoModel").asText("");
            if (!offered.contains(named))
                return "第 " + index + " 步的视频模型「" + named + "」不在可用列表里，videoModel 必须原样填写 videoModels 里的 endpointId，可选：" + String.join("、", offered);
        }
        return null;
    }

    /**
     * The video endpoints the planner was shown; null when the offer could not be read (the quote reports that). Empty means
     * none is configured: a plan with a recreation or video step cannot run, and the model once named one it made up
     * (「sora-2」, local e2e 2026-10-19) because the list it was told to copy from was empty.
     */
    private Set<String> offeredVideoModels() {
        String json = capabilitiesJson();
        if (json == null) return null;
        Set<String> offered = new LinkedHashSet<>();
        try {
            JsonNode caps = mapper.readTree(json);
            if (caps.path("videoModelsUnavailable").asBoolean(false)) return null;
            for (JsonNode model : caps.path("videoModels")) if (model.path("endpointId").isTextual()) offered.add(model.path("endpointId").asText());
        } catch (Exception e) { return null; }
        return offered;
    }

    static boolean needsVideo(JsonNode plan) {
        for (JsonNode step : plan.path("steps")) if (Set.of("recreation", "video").contains(step.path("operation").asText())) return true;
        return false;
    }

    static long estimate(List<Map<String, Object>> messages) {
        long chars = 0;
        for (var m : messages) chars += String.valueOf(m.get("content")).length();
        return chars + 64;
    }
}
