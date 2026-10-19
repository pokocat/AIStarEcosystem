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

    @BeforeEach void setUp() throws Exception {
        models = mock(AiModelInvocationService.class);
        var prompts = mock(PromptService.class);
        String[] file = planPrompt();
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_PLAN)).thenReturn(new PromptService.ResolvedPrompt(file[0], file[1], new PromptParamsDto(null, null, null), "resource"));
        var planner = mock(StudioWorkflowService.class);
        when(planner.planCapabilities()).thenReturn("{\"videoModels\":[{\"endpointId\":\"ep-h3\",\"name\":\"H3\",\"isDefault\":true,\"minSeconds\":5,\"maxSeconds\":15}]}");
        @SuppressWarnings("unchecked") ObjectProvider<StudioWorkflowService> workflow = mock(ObjectProvider.class);
        when(workflow.getIfAvailable()).thenReturn(planner);
        @SuppressWarnings("unchecked") ObjectProvider<StudioExecutionGate> gates = mock(ObjectProvider.class);
        tool = new ProposePlanTool(models, prompts, workflow, gates, om);

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
}
