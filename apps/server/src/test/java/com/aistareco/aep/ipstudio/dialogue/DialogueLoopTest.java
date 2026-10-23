package com.aistareco.aep.ipstudio.dialogue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/** The bounded agent loop as a pure state machine: ordering, limits, stop priority, steering and rejection rules. */
class DialogueLoopTest {
    private static final ObjectMapper OM = new ObjectMapper();

    /** Scripted model: each call returns the next reply and records what the loop sent. */
    static final class ScriptedModel implements DialogueLoop.Model {
        final Deque<DialogueLoop.Reply> replies = new ArrayDeque<>();
        final List<String> log = new ArrayList<>();
        final DialogueLoop.TurnBudget budget;
        Runnable duringCall = () -> { };
        long tokensPerCall = 100;
        ScriptedModel(DialogueLoop.TurnBudget budget) { this.budget = budget; }
        ScriptedModel reply(String text, DialogueLoop.Action... actions) { replies.add(new DialogueLoop.Reply(text, List.of(actions), null, null)); return this; }
        ScriptedModel broken(String text) { replies.add(new DialogueLoop.Reply(text, List.of(), "bad", null)); return this; }
        public long estimateInputTokens(List<Map<String, Object>> messages) { return 10; }
        public DialogueLoop.Reply call(List<Map<String, Object>> messages, int callIndex, int maxOutputTokens) {
            log.add("call" + callIndex);
            duringCall.run();
            budget.record(tokensPerCall, tokensPerCall);
            return replies.isEmpty() ? new DialogueLoop.Reply("（没有更多）", List.of(), null, null) : replies.poll();
        }
        public void appendExchange(List<Map<String, Object>> messages, DialogueLoop.Reply reply, List<DialogueLoop.ToolResult> results) {
            messages.add(Map.of("role", "assistant", "content", reply.visibleText()));
            for (var r : results) { messages.add(Map.of("role", "tool", "content", r.content())); log.add("result:" + r.action().tool()); }
        }
        public void appendUser(List<Map<String, Object>> messages, String text) { messages.add(Map.of("role", "user", "content", text)); log.add("user:" + text.split("\n")[0]); }
    }

    static final class RecordingTools implements DialogueLoop.Tools {
        final List<String> ran = new ArrayList<>();
        final Map<String, DialogueLoop.Reason> ends = new HashMap<>();
        final Set<String> rejected = new HashSet<>();
        public Optional<String> reject(DialogueLoop.Action action) { return rejected.contains(action.tool()) ? Optional.of("当前阶段不允许") : Optional.empty(); }
        public DialogueLoop.ToolOutcome run(DialogueLoop.Action action) { ran.add(action.tool()); return new DialogueLoop.ToolOutcome("{\"ok\":true}", ends.get(action.tool())); }
    }

    static final class Hooks implements DialogueLoop.Hooks {
        final AtomicBoolean stop = new AtomicBoolean();
        final Deque<List<String>> steering = new ArrayDeque<>();
        int heartbeats;
        public boolean stopRequested() { return stop.get(); }
        public List<String> drainSteering() { return steering.isEmpty() ? List.of() : steering.poll(); }
        public void heartbeat() { heartbeats++; }
    }

    static DialogueLoop.Action act(String tool) { return new DialogueLoop.Action("a-" + tool, tool, OM.createObjectNode()); }

    /** Every run makes one tool-internal model call, the way view_images and propose_plan do. */
    static final class SubCallingTools implements DialogueLoop.Tools {
        final DialogueLoop.TurnBudget budget;
        final List<String> ran = new ArrayList<>();
        SubCallingTools(DialogueLoop.TurnBudget budget) { this.budget = budget; }
        public Optional<String> reject(DialogueLoop.Action action) { return Optional.empty(); }
        public DialogueLoop.ToolOutcome run(DialogueLoop.Action action) {
            ran.add(action.tool());
            budget.beginSubCall();
            budget.record(100, 100);
            return DialogueLoop.ToolOutcome.of("{\"ok\":true}");
        }
    }

    /**
     * The production turn's tools: view_images looks (one internal call), propose_plan plans (one internal call; the first
     * plan is refused because the three-view sheet cannot be a first frame), request_approval sends the card only once a
     * plan exists and then waits for the user.
     */
    static final class IncidentTools implements DialogueLoop.Tools {
        final DialogueLoop.TurnBudget budget;
        final List<String> ran = new ArrayList<>();
        int plans;
        boolean planReady;
        IncidentTools(DialogueLoop.TurnBudget budget) { this.budget = budget; }
        public Optional<String> reject(DialogueLoop.Action action) { return Optional.empty(); }
        public DialogueLoop.ToolOutcome run(DialogueLoop.Action action) {
            ran.add(action.tool());
            switch (action.tool()) {
                case "view_images" -> { budget.beginSubCall(); budget.record(100, 100); }
                case "propose_plan" -> {
                    budget.beginSubCall(); budget.record(100, 100);
                    if (++plans == 1) return DialogueLoop.ToolOutcome.of("{\"ok\":false,\"code\":\"STUDIO_VIDEO_FIRST_FRAME_REQUIRED\"}");
                    planReady = true;
                }
                case "request_approval" -> {
                    if (!planReady) return DialogueLoop.ToolOutcome.of("{\"ok\":false,\"summary\":\"还没有方案\"}");
                    return new DialogueLoop.ToolOutcome("{\"ok\":true}", DialogueLoop.Reason.WAITING_USER);
                }
                default -> { }
            }
            return DialogueLoop.ToolOutcome.of("{\"ok\":true}");
        }
    }

    /** An action with JSON arguments (distinct arguments keep consecutive batches from reading as a loop). */
    static DialogueLoop.Action act(String tool, String args) {
        try { return new DialogueLoop.Action("a-" + tool, tool, OM.readTree(args)); } catch (Exception e) { throw new IllegalStateException(e); }
    }

    private DialogueLoop.TurnBudget budget(long maxIn, long maxOut) {
        return DialogueLoop.TurnBudget.standard(maxIn, maxOut, 1024, Clock.systemUTC());
    }

    /** Exact usage from IPR-3caf6046c68d40dea34b's three dialogue calls and one vision call. */
    @Test void replaysTheProductionStopAndReachesItsCardWithTheIndependentOrContinuedBudget() throws Exception {
        var oldRate=new com.aistareco.aep.service.AiChatTokenPricing.Rate(new java.math.BigDecimal(".18"),new java.math.BigDecimal("1.08"),65536,8192);
        for(int mode=0;mode<3;mode++) {
            var budget=mode==0?budget(65536,8192):mode==1?budget(1048576,65536):DialogueLoop.TurnBudget.continued(oldRate,8192,Clock.systemUTC());
            int[] input={17770,19454,20363,15000},output={116,165,436,500};
            var script=new ScriptedModel(budget).reply("看剧本",act("read_canvas")).reply("看参考图",act("view_images"))
                    .reply("建视频对象",act("create_nodes")).reply("请确认方案",act("propose_plan"),act("request_approval"));
            DialogueLoop.Model model=new DialogueLoop.Model() {
                public long estimateInputTokens(List<Map<String,Object>> messages){return 20000;}
                public DialogueLoop.Reply call(List<Map<String,Object>> messages,int index,int allowance){budget.record(input[index-1],output[index-1]);return script.replies.removeFirst();}
                public void appendExchange(List<Map<String,Object>> messages,DialogueLoop.Reply reply,List<DialogueLoop.ToolResult> results){script.appendExchange(messages,reply,results);}
                public void appendUser(List<Map<String,Object>> messages,String text){script.appendUser(messages,text);}
            };
            List<String> executed=new ArrayList<>();
            DialogueLoop.Tools tools=new DialogueLoop.Tools() {
                public Optional<String> reject(DialogueLoop.Action a){return Optional.empty();}
                public DialogueLoop.ToolOutcome run(DialogueLoop.Action a){
                    executed.add(a.tool());
                    if(a.tool().equals("view_images")){budget.beginSubCall();budget.record(1034,537);}
                    if(a.tool().equals("propose_plan")){budget.beginSubCall();budget.record(12000,2000);}
                    return new DialogueLoop.ToolOutcome("{}",a.tool().equals("request_approval")?DialogueLoop.Reason.WAITING_USER:null);
                }
            };
            var outcome=new DialogueLoop(model,tools,new Hooks(),budget).run(new ArrayList<>());
            assertEquals(1,Collections.frequency(executed,"create_nodes"));
            if(mode==0){
                assertEquals("tokens",outcome.limit());assertEquals(3,outcome.steps());assertEquals(4,outcome.modelCalls());
                assertEquals(58621,budget.inputTokens());assertEquals(1254,budget.outputTokens());
                assertFalse(executed.contains("request_approval"));
            } else {
                assertEquals(DialogueLoop.Reason.WAITING_USER,outcome.reason());
                assertEquals(List.of("read_canvas","view_images","create_nodes","propose_plan","request_approval"),executed);
                if(mode==2)assertTrue(oldRate.settleContinued(budget.inputTokens(),budget.outputTokens())<=oldRate.maxCost());
            }
        }
    }

    @Test void confirmedContinuationPassesTokenStepToolCallAndTimeThresholdsInOneLoop() throws Exception {
        var clock=new MutableClock();
        var rate=new com.aistareco.aep.service.AiChatTokenPricing.Rate(new java.math.BigDecimal(".001"),new java.math.BigDecimal(".001"),1000,1000);
        var budget=DialogueLoop.TurnBudget.continued(rate,1024,clock);
        var model=new ScriptedModel(budget);
        model.duringCall=()->clock.advance(Duration.ofSeconds(30));
        for(int i=0;i<49;i++)model.reply("下一处",act("view_images","{\"nodeIds\":[\"n"+i+"\"]}"));
        model.reply("已完成");
        var outcome=new DialogueLoop(model,new SubCallingTools(budget),new Hooks(),budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED,outcome.reason());
        assertEquals(50,outcome.steps());assertEquals(99,outcome.modelCalls());assertEquals(49,outcome.toolCalls());
        assertTrue(budget.inputTokens()>rate.maxInputTokens());assertTrue(budget.outputTokens()>rate.maxOutputTokens());
        assertTrue(budget.remainingTime().compareTo(Duration.ofMinutes(10))>0);
        assertTrue(rate.settleContinued(budget.inputTokens(),budget.outputTokens())<=rate.maxCost());
    }

    @Test void continuationStillHonorsRealBudgetUserStopAndRepeatProtection() throws Exception {
        var rate=new com.aistareco.aep.service.AiChatTokenPricing.Rate(java.math.BigDecimal.ONE,java.math.BigDecimal.ONE,500,500);
        var budget=DialogueLoop.TurnBudget.continued(rate,4096,Clock.systemUTC());budget.record(900,0);
        assertEquals("budget",budget.blockReason(0,256));assertEquals(100,budget.outputAllowance());
        var stopped=new Hooks();stopped.stop.set(true);var model=new ScriptedModel(budget).reply("不能运行");
        assertEquals(DialogueLoop.Reason.INTERRUPTED,new DialogueLoop(model,new RecordingTools(),stopped,budget).run(new ArrayList<>()).reason());
        assertTrue(model.log.isEmpty());
        var other=DialogueLoop.TurnBudget.continued(rate,1024,Clock.systemUTC());
        var repeated=new ScriptedModel(other).reply("看",act("read_canvas")).reply("再看",act("read_canvas"));
        var tools=new RecordingTools();assertEquals("loop",new DialogueLoop(repeated,tools,new Hooks(),other).run(new ArrayList<>()).limit());
        assertEquals(1,tools.ran.size());
    }

    @Test void aNormalMultiStepTaskCanExceedOrdinaryTextUsageAndStillFinish() throws Exception {
        var budget=budget(com.aistareco.aep.service.AiChatTokenPricing.DIALOGUE_INPUT_TOKENS,
                com.aistareco.aep.service.AiChatTokenPricing.DIALOGUE_OUTPUT_TOKENS);
        var model=new ScriptedModel(budget);
        model.tokensPerCall=3000;
        // Ten steps plus nine tool-internal calls: enough room to inspect, adjust and finish the task.
        for(int i=0;i<9;i++)model.reply("处理下一部分",act("view_images","{\"nodeIds\":[\"n"+i+"\"]}"));
        model.reply("已经完成");
        var tools=new SubCallingTools(budget);
        var outcome=new DialogueLoop(model,tools,new Hooks(),budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED,outcome.reason());
        assertEquals(10,outcome.steps());
        assertEquals(19,outcome.modelCalls());
        assertEquals(9,outcome.toolCalls());
        assertTrue(budget.outputTokens()>8192,"the former ordinary-text output ceiling no longer interrupts the turn");
    }

    @Test void completesWhenTheModelRequestsNoAction() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).reply("你好");
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(1, outcome.modelCalls());
        assertEquals(0, outcome.toolCalls());
    }

    @Test void runsToolsInOrderAndFeedsResultsBackBeforeTheNextCall() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).reply("先看画布", act("read_canvas"), act("read_skill")).reply("看完了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(List.of("read_canvas", "read_skill"), tools.ran);
        assertEquals(List.of("call1", "result:read_canvas", "result:read_skill", "call2"), model.log);
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(2, outcome.toolCalls());
    }

    @Test void stopThatArrivesDuringTheModelCallWinsOverItsActions() throws Exception {
        var budget = budget(100_000, 100_000);
        var hooks = new Hooks();
        var model = new ScriptedModel(budget).reply("开始拉片", act("analyze_video"));
        model.duringCall = () -> hooks.stop.set(true);
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, hooks, budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.INTERRUPTED, outcome.reason());
        assertTrue(tools.ran.isEmpty(), "a reply's actions never run after a stop");
    }

    @Test void stopBeforeTheFirstCallMakesNoModelCall() throws Exception {
        var budget = budget(100_000, 100_000);
        var hooks = new Hooks();
        hooks.stop.set(true);
        var model = new ScriptedModel(budget).reply("x");
        var outcome = new DialogueLoop(model, new RecordingTools(), hooks, budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.INTERRUPTED, outcome.reason());
        assertTrue(model.log.isEmpty());
    }

    @Test void rejectedActionsAreFedBackAndNeverExecuted() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).reply("提交", act("submit_generation")).reply("好的，先确认方案");
        var tools = new RecordingTools();
        tools.rejected.add("submit_generation");
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertTrue(tools.ran.isEmpty());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(0, outcome.toolCalls(), "a rejected action is not a tool call");
        assertTrue(model.log.contains("result:submit_generation"), "the model hears why");
    }

    @Test void aToolThatNeedsTheUserEndsTheTurnAndSkipsLaterActions() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).reply("问一下", act("ask_question"), act("create_nodes"));
        var tools = new RecordingTools();
        tools.ends.put("ask_question", DialogueLoop.Reason.WAITING_USER);
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.WAITING_USER, outcome.reason());
        assertEquals(List.of("ask_question"), tools.ran);
        assertEquals(1, outcome.modelCalls());
    }

    @Test void dialogueStepLimitStopsTheLoopAfterSixteenSteps() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 30; i++) model.reply("再看一处", act("view_images", "{\"nodeIds\":[\"n" + i + "\"]}"));
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget, 100).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("steps", outcome.limit());
        assertEquals(16, DialogueLoop.MAX_DIALOGUE_STEPS);
        assertEquals(DialogueLoop.MAX_DIALOGUE_STEPS, outcome.steps());
        assertEquals(DialogueLoop.MAX_DIALOGUE_STEPS, outcome.modelCalls());
        assertEquals(DialogueLoop.MAX_DIALOGUE_STEPS, tools.ran.size(), "every step before the limit ran its action");
    }

    /** A tool's own model call (view_images' look, propose_plan's planner) spends tokens but is not a dialogue step. */
    @Test void toolInternalCallsCountAsModelCallsNotSteps() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 30; i++) model.reply("再看一处", act("view_images", "{\"nodeIds\":[\"n" + i + "\"]}"));
        var tools = new SubCallingTools(budget);
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget, 100).run(new ArrayList<>());
        assertEquals("steps", outcome.limit(), "the step limit, not the call limit, ends it");
        assertEquals(DialogueLoop.MAX_DIALOGUE_STEPS, outcome.steps());
        assertEquals(2 * DialogueLoop.MAX_DIALOGUE_STEPS, outcome.modelCalls(), "16 steps plus 16 looks");
        assertEquals(2 * DialogueLoop.MAX_DIALOGUE_STEPS * 100L, budget.inputTokens(), "the looks' tokens are in the turn budget");
    }

    /**
     * Production 2026-10-21 17:38 CST (run IPR-472ed89b5c174a95808f, canvas IPP-655ea55a): 「用这张图做一段视频」 took five
     * dialogue steps and three tool-internal calls (look, plan, plan), and stopped at the old 8-call cap one step before the
     * confirmation card. Steps now count only the loop's own calls, so the sixth step sends the card.
     */
    @Test void theProductionTurnNowReachesItsConfirmationCard() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = incidentScript(budget);
        var tools = new IncidentTools(budget);
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.WAITING_USER, outcome.reason(), "the card went out and the turn waits for the user");
        assertEquals(6, outcome.steps());
        assertEquals(9, outcome.modelCalls(), "six steps plus look, plan, plan");
        assertEquals(List.of("view_images", "read_skill", "create_nodes", "propose_plan", "request_approval", "create_nodes",
                "connect_nodes", "propose_plan", "request_approval"), tools.ran);
    }

    /** The same turn under a total cap of 8 calls stops exactly where production did: the total cap still sees every call. */
    @Test void theTotalCallSafetyNetStillCountsToolInternalCalls() throws Exception {
        var budget = new DialogueLoop.TurnBudget(DialogueLoop.MAX_DIALOGUE_STEPS, 8, 100_000, 100_000, 1024, DialogueLoop.MAX_DURATION, Clock.systemUTC());
        var tools = new IncidentTools(budget);
        var outcome = new DialogueLoop(incidentScript(budget), tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("calls", outcome.limit());
        assertEquals(5, outcome.steps());
        assertEquals(8, outcome.modelCalls());
        assertEquals(1, Collections.frequency(tools.ran, "request_approval"), "only the early, refused card request ran; the card never went out");
    }

    private static ScriptedModel incidentScript(DialogueLoop.TurnBudget budget) {
        return new ScriptedModel(budget)
                .reply("我先看一下这张图。", act("view_images", "{\"nodeIds\":[\"img-sheet\"],\"question\":\"画面里有什么\"}"))
                .reply("用出视频的方法，先建一个视频对象。", act("read_skill", "{\"key\":\"video-generation\"}"),
                        act("create_nodes", "{\"nodes\":[{\"type\":\"video\",\"aspectRatio\":\"9:16\"}]}"))
                .reply("整理方案。", act("propose_plan", "{\"brief\":\"用三视图做视频\"}"), act("request_approval", "{}"))
                .reply("三视图是拼版，先出一张单人首帧。", act("create_nodes", "{\"nodes\":[{\"type\":\"image\"}]}"))
                .reply("连上首帧，再整理方案。", act("connect_nodes", "{\"from\":\"img-frame\",\"to\":\"dlg-video\"}"),
                        act("propose_plan", "{\"brief\":\"用单人首帧做视频\"}"))
                .reply("方案好了，请确认。", act("request_approval", "{\"scope\":\"production\"}"));
    }

    @Test void toolCallLimitStopsTheLoop() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 12; i++) model.reply("多做几步", act("read_canvas", "{\"page\":" + (3 * i) + "}"),
                act("read_canvas", "{\"page\":" + (3 * i + 1) + "}"), act("read_canvas", "{\"page\":" + (3 * i + 2) + "}"));
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("tools", outcome.limit());
        assertEquals(24, DialogueLoop.MAX_TOOL_CALLS);
        assertEquals(DialogueLoop.MAX_TOOL_CALLS, tools.ran.size());
    }

    @Test void tokenBudgetStopsBeforeACallThatCannotFit() throws Exception {
        var budget = budget(250, 100_000);
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 5; i++) model.reply("继续", act("read_canvas", "{\"page\":" + i + "}"));
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("tokens", outcome.limit());
        // Each call uses 100 input tokens and the next one is estimated at 10: 0+10, 100+10, 200+10 fit 250; 300+10 does not.
        assertEquals(3, outcome.modelCalls());
    }

    @Test void wallClockLimitStopsTheLoop() throws Exception {
        var clock = new MutableClock();
        var budget = new DialogueLoop.TurnBudget(DialogueLoop.MAX_DIALOGUE_STEPS, DialogueLoop.MAX_MODEL_CALLS, 100_000, 100_000, 1024, Duration.ofMinutes(10), clock);
        var model = new ScriptedModel(budget).reply("拉片中", act("analyze_video")).reply("x");
        model.duringCall = () -> clock.advance(Duration.ofMinutes(11));
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("time", outcome.limit());
        assertEquals(1, outcome.modelCalls());
    }

    @Test void steeringAtTheToolBoundaryReachesTheNextModelCall() throws Exception {
        var budget = budget(100_000, 100_000);
        var hooks = new Hooks();
        var model = new ScriptedModel(budget).reply("先看画布", act("read_canvas")).reply("收到你的调整");
        hooks.steering.add(List.of("第3段换成这张图"));
        var outcome = new DialogueLoop(model, new RecordingTools(), hooks, budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(List.of("call1", "result:read_canvas", "user:用户在你工作时发来新消息（按收到顺序，属于对当前安排的调整）：", "call2"), model.log);
    }

    @Test void pendingSteeringKeepsATurnGoingInsteadOfCompleting() throws Exception {
        var budget = budget(100_000, 100_000);
        var hooks = new Hooks();
        hooks.steering.add(List.of("预算提高到2000"));
        var model = new ScriptedModel(budget).reply("好的").reply("已按 2000 调整");
        var outcome = new DialogueLoop(model, new RecordingTools(), hooks, budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(2, outcome.modelCalls());
    }

    @Test void unparseableActionBlockIsFedBackNotExecuted() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).broken("我来建节点").reply("重新给出", act("create_nodes")).reply("建好了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(List.of("create_nodes"), tools.ran);
        assertEquals(3, outcome.modelCalls());
        assertTrue(model.log.stream().anyMatch(l -> l.startsWith("user:上一条回复里的动作格式无法解析")));
    }

    /** 2026-10-21: the correction carries one complete action, and that action is one the parser accepts as view_images. */
    @Test void theCorrectionShowsACompleteActionTheParserAccepts() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).broken("[调用工具 view_images]").reply("看完了");
        var messages = new ArrayList<Map<String, Object>>();
        new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(messages);
        String correction = messages.stream().filter(m -> "user".equals(m.get("role"))).map(m -> String.valueOf(m.get("content")))
                .filter(t -> t.startsWith("上一条回复里的动作格式无法解析")).findFirst().orElseThrow();
        assertTrue(correction.contains(DialogueActionProtocol.MARKER + "\n" + DialogueLoop.ACTION_EXAMPLE), correction);
        var example = DialogueActionProtocol.parse(DialogueActionProtocol.MARKER + "\n" + DialogueLoop.ACTION_EXAMPLE, StudioDialoguePromptWiringTest.toolNames());
        assertNull(example.parseError());
        assertEquals("view_images", example.actions().get(0).tool());
        assertTrue(example.actions().get(0).args().path("nodeIds").isArray(), "the argument names are view_images' own");
    }

    @Test void outputAllowanceShrinksWithTheRemainingBudget() {
        var budget = budget(100_000, 1500);
        budget.record(0, 1000);
        assertEquals(500, budget.outputAllowance());
        assertEquals("tokens", budget.blockReason(10, 600));
        assertNull(budget.blockReason(10, 256));
    }

    static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-10-18T00:00:00Z");
        void advance(Duration d) { now = now.plus(d); }
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test void repeatedProtocolErrorsStopTheTurnInsteadOfPayingForMoreTries() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).broken("a").broken("b").broken("c").reply("不该到这里");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("protocol", outcome.limit());
        assertEquals(3, outcome.modelCalls(), "two corrections, then stop");
        assertTrue(tools.ran.isEmpty(), "a malformed batch never runs");
    }

    @Test void aCorrectedReplyResetsTheProtocolCounter() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).broken("a").broken("b").reply("看", act("read_canvas")).broken("c").reply("好了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(List.of("read_canvas"), tools.ran);
    }

    // ── Going round in circles ───────────────────────────────────────────────────────────────────────────────────

    @Test void theSameBatchTwiceInARowStopsWithoutRunningItAgain() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).reply("看一下", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("再看一下", act("view_images", "{\"nodeIds\":[\"a\"]}")).reply("不该到这里");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("loop", outcome.limit());
        assertEquals(List.of("view_images"), tools.ran, "the repeated batch never runs");
        assertEquals(2, outcome.steps());
    }

    @Test void aRepeatedReadOnlyLookIsALoopToo() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).reply("看画布", act("read_canvas")).reply("再看画布", act("read_canvas"));
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals("loop", outcome.limit());
    }

    /** Key order, null fields, surrounding spaces, number spelling and the action id do not make a batch different. */
    @Test void argumentsAreComparedAfterNormalizing() throws Exception {
        var budget = budget(100_000, 100_000);
        var first = act("view_images", "{\"nodeIds\":[\"a\",\"b\"],\"question\":\"画面里有什么\",\"max\":2}");
        var second = new DialogueLoop.Action("call_9f3", "view_images",
                OM.readTree("{\"question\":\" 画面里有什么 \",\"max\":2.0,\"nodeIds\":[\"a\",\"b\"],\"extra\":null}"));
        var model = new ScriptedModel(budget).reply("看", first).reply("再看", second);
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals("loop", outcome.limit());
        assertEquals(DialogueLoop.batchSignature(List.of(first)), DialogueLoop.batchSignature(List.of(second)));
    }

    @Test void aMultiActionBatchRepeatedIsALoop() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).reply("建好再连", act("create_nodes", "{\"nodes\":[{\"type\":\"image\"}]}"), act("connect_nodes", "{\"from\":\"a\",\"to\":\"b\"}"))
                .reply("建好再连", act("create_nodes", "{\"nodes\":[{\"type\":\"image\"}]}"), act("connect_nodes", "{\"from\":\"a\",\"to\":\"b\"}"));
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals("loop", outcome.limit());
        assertEquals(List.of("create_nodes", "connect_nodes"), tools.ran);
    }

    @Test void differentArgumentsAreNotALoop() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).reply("看 a", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("看 b", act("view_images", "{\"nodeIds\":[\"b\"]}")).reply("看完了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(2, tools.ran.size());
    }

    @Test void onlyConsecutiveRepeatsCount() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).reply("看画布", act("read_canvas")).reply("看图", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("再看画布", act("read_canvas")).reply("好了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(List.of("read_canvas", "view_images", "read_canvas"), tools.ran);
    }

    /** A user message in between is new information: the same batch may run again. */
    @Test void steeringBetweenTwoIdenticalBatchesIsNotALoop() throws Exception {
        var budget = budget(100_000, 100_000);
        var hooks = new Hooks();
        hooks.steering.add(List.of("我刚换了一张图，再看一下"));
        var model = new ScriptedModel(budget).reply("看图", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("再看一下", act("view_images", "{\"nodeIds\":[\"a\"]}")).reply("看完了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, hooks, budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(List.of("view_images", "view_images"), tools.ran);
    }

    /** A reply rejected for its format in between is not a different step: repeating the batch after it is still a loop. */
    @Test void aFormatCorrectionInBetweenDoesNotHideARepeat() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget).reply("看图", act("view_images", "{\"nodeIds\":[\"a\"]}")).broken("[调用工具 view_images]")
                .reply("看图", act("view_images", "{\"nodeIds\":[\"a\"]}"));
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals("loop", outcome.limit());
        assertEquals(List.of("view_images"), tools.ran);
    }
}
