package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.dialogue.tools.ProposePlanTool;
import com.aistareco.aep.ipstudio.dialogue.tools.ToolContext;
import com.aistareco.aep.ipstudio.dialogue.tools.ToolHandle;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.AiModelInvocationService.ChatTurnResult;
import com.aistareco.aep.service.PromptService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * propose_plan against replies shaped like the first real production run of 2026-10-18 (Qwen on the Jusuan endpoint): the
 * JSON came wrapped in a markdown fence, the questions were {question, default} objects, and the step settings used
 * invented keys because the planner had not been shown the contract. The fixtures are those shapes, not the shapes this
 * code would have liked to receive.
 */
class ProposePlanToolTest {
    static final ToolHandle HANDLE = new ToolHandle() {
        public String toolCallId() { return "tc-1"; }
        public void progress(String text) { }
        public void childRun(String runId) { }
    };
    final ObjectMapper om = new ObjectMapper();
    AiModelInvocationService models;
    ToolContext.Effects effects;
    ProposePlanTool tool;
    ToolContext ctx;
    ObjectNode appended;
    StudioWorkflowService planner;

    @BeforeEach void setUp() throws Exception {
        models = mock(AiModelInvocationService.class);
        var prompts = mock(PromptService.class);
        String[] file = planPrompt();
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_PLAN)).thenReturn(new PromptService.ResolvedPrompt(file[0], file[1], new PromptParamsDto(null, null, null), "resource"));
        planner = mock(StudioWorkflowService.class);
        when(planner.planCapabilities()).thenReturn("{\"videoModels\":[{\"endpointId\":\"ep-h3\",\"name\":\"H3\",\"isDefault\":true,\"minSeconds\":5,\"maxSeconds\":15}]}");
        @SuppressWarnings("unchecked") ObjectProvider<StudioWorkflowService> workflow = mock(ObjectProvider.class);
        when(workflow.getIfAvailable()).thenReturn(planner);
        @SuppressWarnings("unchecked") ObjectProvider<StudioExecutionGate> gates = mock(ObjectProvider.class);
        tool = new ProposePlanTool(models, prompts, workflow, gates, om, new StudioSkillCatalog());

        effects = mock(ToolContext.Effects.class);
        when(effects.readDoc()).thenReturn(om.readTree("""
                {"nodes":[{"id":"vid-1","type":"video","title":"06 H3第2段｜商品与质疑","metadata":{}},
                          {"id":"img-1","type":"image","title":"图片 · 1","metadata":{}}],"connections":[]}"""));
        when(effects.appendPlan(any(), any())).thenAnswer(call -> {
            appended = call.getArgument(0);
            return om.createObjectNode().put("revision", 1);
        });
        ctx = new ToolContext("u1", "P1", "IPT-P1", "TRN-1", "IPR-1", "IDM-A", "IDM-U", null, null, false, null, null,
                DialogueLoop.TurnBudget.unmetered(8192, Clock.systemUTC()), skill(), "analysis", () -> false, effects);
    }

    com.aistareco.aep.ipstudio.skill.StudioSkill skill() throws Exception {
        try (var in = getClass().getResourceAsStream("/studio/skills/reference-video-recreation.md")) {
            return StudioSkillCatalog.parse(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    /** The real prompt file, split like PromptService does: system above the first --- line, user template below it. */
    String[] planPrompt() throws Exception {
        try (var in = getClass().getResourceAsStream("/prompts/material/dap.ip_studio_skill_plan.md")) {
            String text = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            int cut = text.indexOf("\n---\n");
            return new String[]{text.substring(0, cut).strip(), text.substring(cut + 5)};
        }
    }

    void modelReplies(String content) {
        when(models.invokeChatTurnOnEndpoint(any(), eq(com.aistareco.aep.model.AiModelPurpose.DAP_PERSONA), any(), any(), any(), any()))
                .thenReturn(new ChatTurnResult(content, "stop", 3000L, 1200L, List.of(), false, false, "qwen38-27b"));
    }

    @SuppressWarnings("unchecked")
    String userPromptSentToTheModel() {
        ArgumentCaptor<List<Map<String, Object>>> messages = ArgumentCaptor.forClass(List.class);
        verify(models).invokeChatTurnOnEndpoint(any(), any(), messages.capture(), any(), any(), any());
        return String.valueOf(messages.getValue().get(1).get("content"));
    }

    static final String FOLLOWS_THE_CONTRACT = """
            ```json
            {"summary":"先拉片再编排制作计划",
             "approaches":[{"id":"analysis-only","title":"先看懂原片","summary":"逐段拉片","rationale":"用户要先确认再制作","preserve":["叙事骨架"],"change":["主角"],"tradeoffs":["要等分析结果"],"requiredCapabilities":["film-study"]}],
             "recommendedApproachId":"analysis-only",
             "steps":[
               {"id":"cut","operation":"recreation","title":"参考视频分段拉片","prompt":"分段读画面与字幕","strategy":{"approachId":"analysis-only","method":"film-study","reason":"先拿到事实"},"execution":"auto",
                "settings":{"sourceNodeId":"vid-1","mode":"segments","maxSegmentSec":"model","videoModel":"ep-h3"},"referenceNodeIds":["vid-1"],"dependsOn":[]},
               {"id":"compile","operation":"text","title":"编排制作计划","prompt":"按分析结果编排","execution":"auto",
                "settings":{"purpose":"plan-compile"},"referenceNodeIds":["img-1"],"dependsOn":["cut"]}],
             "questions":[{"id":"q1","question":"原片主角是成人还是婴儿？","default":"先看分析结果再定"}],
             "notes":["本阶段只分析，不生成新画面"]}
            ```""";

    @Test void aFencedReplyThatFollowsTheContractBecomesAPlanAndQuestionObjectsBecomeOneLine() throws Exception {
        modelReplies(FOLLOWS_THE_CONTRACT);
        var run = tool.run(om.createObjectNode().put("brief", "照参考视频复刻"), ctx, HANDLE);
        assertEquals("done", run.status(), run.forModel());
        assertEquals(2, appended.path("steps").size());
        assertEquals("vid-1", appended.path("steps").get(0).path("settings").path("sourceNodeId").asText());
        assertEquals("原片主角是成人还是婴儿？（默认：先看分析结果再定）", appended.path("questions").get(0).asText());
        verify(effects).appendPlan(any(), any());
    }

    @Test void thePlannerIsShownTheTypedSettingsContractAndTheRealVideoModels() throws Exception {
        modelReplies(FOLLOWS_THE_CONTRACT);
        tool.run(om.createObjectNode().put("brief", "照参考视频复刻"), ctx, HANDLE);
        String sent = userPromptSentToTheModel();
        assertTrue(sent.contains("recreation{sourceNodeId"), "the per-operation field names must reach the model, not just the operation names");
        assertTrue(sent.contains("plan-compile"), "the two-stage rule must reach the model");
        assertTrue(sent.contains("分析阶段的步骤顺序固定"), "the analysis plan's step order must reach the model");
        assertTrue(sent.contains("referenceNodeIds 只能填素材清单里的画布对象 id"), "step numbers are not assets");
        assertTrue(sent.contains("原样复制「可用模型与合同」里 videoModels[].endpointId"), "videoModel is an endpoint id, not a name");
        assertTrue(sent.contains("\"endpointId\":\"ep-h3\""), "videoModel is picked from the real capability list");
        assertTrue(sent.contains("[vid-1]"), "canvas ids come from the digest");
    }

    @Test void guessedSettingsKeysAreStillRefusedAndTheRefusalNamesWhatToFix() throws Exception {
        // The first production reply: videoId / analysisType are the model's own invention.
        modelReplies(FOLLOWS_THE_CONTRACT.replace("\"sourceNodeId\":\"vid-1\",\"mode\":\"segments\",\"maxSegmentSec\":\"model\",\"videoModel\":\"ep-h3\"",
                "\"videoId\":\"vid-1\",\"analysisType\":\"detailed_breakdown\""));
        var run = tool.run(om.createObjectNode().put("brief", "照参考视频复刻"), ctx, HANDLE);
        assertEquals("failed", run.status());
        assertEquals("AI_BAD_OUTPUT", run.errorCode());
        assertTrue(run.forModel().contains("参考视频"), "the model is told which step needs which choice");
        verify(effects, never()).appendPlan(any(), any());
    }

    @Test void aReplyThatIsNotJsonIsRefusedWithoutStoringAPlan() throws Exception {
        modelReplies("好的，我来整理一下方案。");
        var run = tool.run(om.createObjectNode().put("brief", "照参考视频复刻"), ctx, HANDLE);
        assertEquals("failed", run.status());
        assertEquals("AI_BAD_OUTPUT", run.errorCode());
        assertTrue(run.forModel().contains("不是有效 JSON"));
        verify(effects, never()).appendPlan(any(), any());
    }

    @Test void aReplyWithProseAroundTheObjectIsStillRead() throws Exception {
        modelReplies("方案如下：\n" + FOLLOWS_THE_CONTRACT.replace("```json", "").replace("```", "") + "\n以上。");
        var run = tool.run(om.createObjectNode().put("brief", "照参考视频复刻"), ctx, HANDLE);
        assertEquals("done", run.status(), run.forModel());
    }

    @Test void aPlanThatCompilesBeforeTheFilmStudyIsRefusedWithTheReorderReason() throws Exception {
        // Shape of the third production reply: plan-compile first, recreation second and dependent on it.
        modelReplies("""
                {"summary":"先编排再拉片","approaches":[{"id":"a","title":"t","summary":"s","rationale":"r"}],"recommendedApproachId":"a",
                 "steps":[{"id":"step_1","operation":"text","title":"编排","prompt":"p","settings":{"purpose":"plan-compile"},"referenceNodeIds":["vid-1"],"dependsOn":[]},
                          {"id":"step_2","operation":"recreation","title":"拉片","prompt":"p","settings":{"sourceNodeId":"vid-1","mode":"segments","maxSegmentSec":"model","videoModel":"minimax-h3"},"referenceNodeIds":["img-1"],"dependsOn":["step_1"]}],
                 "questions":[]}""");
        var run = tool.run(om.createObjectNode().put("brief", "照参考视频复刻"), ctx, HANDLE);
        assertEquals("failed", run.status());
        assertTrue(run.forModel().contains("拉片"), run.forModel());
        verify(effects, never()).appendPlan(any(), any());
    }

    @Test void aVideoModelThatIsNotAnOfferedEndpointIsRefusedWithTheOfferedIds() throws Exception {
        // Second production reply: the capability list had ai-jusuan-minimax-h3 and the model wrote its own short name.
        modelReplies(FOLLOWS_THE_CONTRACT.replace("\"videoModel\":\"ep-h3\"", "\"videoModel\":\"minimax-h3\""));
        var run = tool.run(om.createObjectNode().put("brief", "照参考视频复刻"), ctx, HANDLE);
        assertEquals("failed", run.status());
        assertTrue(run.forModel().contains("minimax-h3") && run.forModel().contains("ep-h3"), run.forModel());
        verify(effects, never()).appendPlan(any(), any());
    }

    @Test void withNoVideoModelConfiguredAPlanThatNeedsVideoIsRefusedAsNotConfigured() throws Exception {
        // Local e2e 2026-10-19: no video candidate had a contract, the offer was empty, and the plan named 「sora-2」.
        when(planner.planCapabilities()).thenReturn("{\"videoModels\":[]}");
        modelReplies(FOLLOWS_THE_CONTRACT.replace("\"videoModel\":\"ep-h3\"", "\"videoModel\":\"sora-2\""));
        var run = tool.run(om.createObjectNode().put("brief", "照参考视频复刻"), ctx, HANDLE);
        assertEquals("failed", run.status());
        assertEquals("VIDEO_NOT_CONFIGURED", run.errorCode());
        assertTrue(run.forModel().contains("不要换一个模型名重试"), run.forModel());
        verify(effects, never()).appendPlan(any(), any());
    }

    @Test void anUnreadableOfferIsLeftToTheQuoteRatherThanCalledUnconfigured() throws Exception {
        when(planner.planCapabilities()).thenReturn("{\"videoModels\":[],\"videoModelsUnavailable\":true}");
        modelReplies(FOLLOWS_THE_CONTRACT);
        var run = tool.run(om.createObjectNode().put("brief", "照参考视频复刻"), ctx, HANDLE);
        assertEquals("done", run.status(), run.forModel());
    }


    /** 意图直达 2026-10-20: a direct skill proposes its production plan with no execution; analysis is refused for it. */
    @Test void aDirectSkillProposesProductionStraightAwayAndNeverAnalysis() throws Exception {
        com.aistareco.aep.ipstudio.skill.StudioSkill image;
        try (var in = getClass().getResourceAsStream("/studio/skills/image-generation.md")) {
            image = StudioSkillCatalog.parse(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
        var direct = new ToolContext("u1", "P1", "IPT-P1", "TRN-1", "IPR-1", "IDM-A", "IDM-U", null, null, false, null, null,
                DialogueLoop.TurnBudget.unmetered(8192, Clock.systemUTC()), image, "production", () -> false, effects);
        assertNull(tool.validate(om.createObjectNode().put("brief", "一张海报").put("stage", "production"), direct));
        assertNull(tool.validate(om.createObjectNode().put("brief", "一张海报"), direct), "stage may be omitted: it defaults to the skill's own");
        assertNotNull(tool.validate(om.createObjectNode().put("brief", "一张海报").put("stage", "analysis"), direct));
        assertNotNull(tool.validate(om.createObjectNode().put("brief", "照参考视频复刻").put("stage", "production"), ctx), "recreation still needs the analysis first");
        modelReplies("""
                {"summary":"一张国风少女海报，9:16","steps":[{"id":"poster","operation":"image","title":"国风少女海报","prompt":"竖版海报……","execution":"auto",
                 "settings":{"count":1,"referenceBindings":[]},"referenceNodeIds":[],"dependsOn":[]}],"questions":[]}""");
        var run = tool.run(om.createObjectNode().put("brief", "一张国风少女海报"), direct, HANDLE);
        assertEquals("done", run.status(), run.forModel());
        assertEquals("production", appended.path("stage").asText());
        assertEquals("image-generation", appended.path("skillKey").asText());
        assertTrue(userPromptSentToTheModel().contains("没有分析阶段"), "the planner is told there is no analysis stage");
    }
    @Test void nextVideoPlanSwitchesFromTheOldImageMethodBeforePlanningAndCanBeConfirmed() throws Exception {
        var image = new StudioSkillCatalog().requireForNewSelection("image-generation");
        ctx.bindSkill(image, "production");
        doAnswer(call -> {
            var selected = (com.aistareco.aep.ipstudio.skill.StudioSkill) call.getArgument(0);
            ctx.bindSkill(selected, selected.firstStage());
            return null;
        }).when(effects).bindSkill(any());
        modelReplies("""
                {"summary":"发布会视频，16:9、8秒","steps":[{"id":"shot","operation":"video","title":"发布会视频","prompt":"人物从侧幕走向讲台",
                 "settings":{"video":{"mode":"t2v","resolutionTier":"768p"},"durationSec":8,"aspectRatio":"16:9","count":1,"referenceBindings":[]},"referenceNodeIds":["img-1"],"dependsOn":[]}],"questions":[]}""");
        var args = om.createObjectNode().put("brief", "按第1集剧本出第一段视频，用人物设定图做首帧").put("stage", "production");
        assertNull(tool.validate(args, ctx));
        var run = tool.run(args, ctx, HANDLE);
        assertEquals("done", run.status(), run.forModel());
        assertEquals("video-generation", ctx.skill().key());
        assertEquals("video-generation", appended.path("skillKey").asText());
        assertEquals("video", appended.path("steps").get(0).path("operation").asText());
        assertTrue(ctx.planReady);
        var block = om.createObjectNode().put("planRunId", ctx.runId).put("fingerprint", "fp");
        appended.putObject("budget").put("estimated", 200);
        block.set("plan", appended);
        when(effects.latestPlanBlock()).thenReturn(java.util.Optional.of(block));
        var approval = new com.aistareco.aep.ipstudio.dialogue.tools.RequestApprovalTool();
        var request = om.createObjectNode(); request.putArray("scope").add("发布会视频，16:9、8秒");
        assertEquals(DialogueLoop.Reason.WAITING_USER, approval.run(request, ctx, HANDLE).end());
        verify(effects).appendBlock(any(), eq(StudioDialogueEventTypes.APPROVAL_REQUIRED), any());
    }

    @Test void aRunningExecutionKeepsItsMethodEvenWhenTheBriefNamesAnotherOutput() throws Exception {
        var image = new StudioSkillCatalog().requireForNewSelection("image-generation");
        var locked = new ToolContext("u1", "P1", "IPT-P1", "TRN-1", "IPR-1", "IDM-A", "IDM-U", "PEX-1", null, false, null, null,
                DialogueLoop.TurnBudget.unmetered(8192, Clock.systemUTC()), image, "production", () -> false, effects);
        modelReplies("""
                {"summary":"视频","steps":[{"id":"v","operation":"video","title":"视频","prompt":"人物走向讲台",
                 "settings":{"durationSec":8,"count":1},"referenceNodeIds":[],"dependsOn":[]}]}""");
        var run = tool.run(om.createObjectNode().put("brief", "出第一段视频"), locked, HANDLE);
        assertEquals("STUDIO_SKILL_OPERATION_NOT_ALLOWED", run.errorCode());
        assertFalse(run.summary().contains("当前阶段"));
        assertFalse(locked.planReady);
        verify(effects, never()).bindSkill(any());
        verify(effects, never()).appendPlan(any(), any());
    }

    @Test void failedPlanAndApprovalInOneBatchRecoverInTheSameTurnWithoutAnOldCard() throws Exception {
        ctx.bindSkill(new StudioSkillCatalog().requireForNewSelection("image-generation"), "production");
        var valid = """
                {"summary":"发布会视频","steps":[{"id":"v","operation":"video","title":"发布会视频","prompt":"人物走向讲台",
                 "settings":{"video":{"mode":"t2v","resolutionTier":"768p"},"durationSec":8,"aspectRatio":"16:9","count":1},"referenceNodeIds":[],"dependsOn":[]}]}""";
        modelReplies(valid);
        doAnswer(call -> { var skill = (com.aistareco.aep.ipstudio.skill.StudioSkill) call.getArgument(0); ctx.bindSkill(skill, skill.firstStage()); return null; })
                .when(effects).bindSkill(any());
        var old = om.createObjectNode().put("planRunId", "IPR-old").put("fingerprint", "old-image");
        old.putObject("plan").putObject("budget").put("estimated", 30);
        when(effects.latestPlanBlock()).thenReturn(java.util.Optional.of(old));
        when(effects.appendPlan(any(), any())).thenAnswer(call -> {
            var plan = (ObjectNode) call.getArgument(0); plan.putObject("budget").put("estimated", 200);
            var block = om.createObjectNode().put("planRunId", ctx.runId).put("revision", 5).put("fingerprint", "new-video");
            block.set("plan", plan); when(effects.latestPlanBlock()).thenReturn(java.util.Optional.of(block)); return block;
        });
        var approval = new com.aistareco.aep.ipstudio.dialogue.tools.RequestApprovalTool();
        var approvalArgs = om.createObjectNode(); approvalArgs.putArray("scope").add("发布会视频");
        var exchanges = new java.util.ArrayList<DialogueLoop.ToolResult>();
        var loopModel = new DialogueLoop.Model() {
            public long estimateInputTokens(List<Map<String,Object>> messages) { return 10; }
            public DialogueLoop.Reply call(List<Map<String,Object>> messages, int index, int max) {
                String brief = index == 1 ? "继续下一步" : "按设定图出第一段视频";
                return new DialogueLoop.Reply("", List.of(
                        new DialogueLoop.Action("p" + index, "propose_plan", om.createObjectNode().put("brief", brief)),
                        new DialogueLoop.Action("a" + index, "request_approval", approvalArgs)), null, null);
            }
            public void appendExchange(List<Map<String,Object>> messages, DialogueLoop.Reply reply, List<DialogueLoop.ToolResult> results) { exchanges.addAll(results); }
            public void appendUser(List<Map<String,Object>> messages, String text) { }
        };
        var loopTools = new DialogueLoop.Tools() {
            public java.util.Optional<String> reject(DialogueLoop.Action action) { return java.util.Optional.ofNullable(
                    action.tool().equals("propose_plan") ? tool.validate(action.args(), ctx) : approval.validate(action.args(), ctx)); }
            public DialogueLoop.ToolOutcome run(DialogueLoop.Action action) throws Exception {
                var result = action.tool().equals("propose_plan") ? tool.run(action.args(), ctx, HANDLE) : approval.run(action.args(), ctx, HANDLE);
                return new DialogueLoop.ToolOutcome(result.forModel(), result.end());
            }
        };
        var hooks = new DialogueLoop.Hooks() {
            public boolean stopRequested() { return false; }
            public List<String> drainSteering() { return List.of(); }
            public void heartbeat() { }
        };
        var outcome = new DialogueLoop(loopModel, loopTools, hooks, ctx.budget).run(new java.util.ArrayList<>());
        assertEquals(DialogueLoop.Reason.WAITING_USER, outcome.reason());
        assertEquals(2, outcome.steps(), "the failed batch must recover before asking the user");
        assertTrue(exchanges.get(1).content().contains("不能给旧方案发确认卡"));
        var card = org.mockito.ArgumentCaptor.forClass(ObjectNode.class);
        verify(effects, times(1)).appendBlock(card.capture(), any(), any());
        assertEquals("new-video", card.getValue().path("planFingerprint").asText());
        assertEquals(200, card.getValue().path("quotedCost").asLong());
        verify(effects, times(1)).appendPlan(any(), any());
    }

}
