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
    static class ScriptedModel implements DialogueLoop.Model {
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

    private static final java.math.BigDecimal ONE = java.math.BigDecimal.ONE;
    private static com.aistareco.aep.service.AiChatTokenPricing.Rate rate(String inPerK, String outPerK, int maxIn, int maxOut) {
        return new com.aistareco.aep.service.AiChatTokenPricing.Rate(new java.math.BigDecimal(inPerK), new java.math.BigDecimal(outPerK), maxIn, maxOut);
    }

    /** A hold large enough for every scripted test that is not about the hold itself (the default dialogue ceiling). */
    private DialogueLoop.TurnBudget budget() {
        return DialogueLoop.TurnBudget.metered(rate("1", "1", com.aistareco.aep.service.AiChatTokenPricing.DIALOGUE_INPUT_TOKENS,
                com.aistareco.aep.service.AiChatTokenPricing.DIALOGUE_OUTPUT_TOKENS), 1024, Clock.systemUTC());
    }

    /**
     * Exact usage from IPR-3caf6046c68d40dea34b's three dialogue calls and one vision call, which stopped at the old token
     * split before its card. Only the money frozen bounds a task now: both the small old ceiling and the dialogue ceiling
     * reach the card, and what is charged stays within the hold.
     */
    @Test void replaysTheProductionStopAndReachesItsCardWithinTheHold() throws Exception {
        for (var r : List.of(rate(".18", "1.08", 65536, 8192), rate(".18", "1.08", 1048576, 65536))) {
            var budget = DialogueLoop.TurnBudget.metered(r, 8192, Clock.systemUTC());
            int[] input = {17770, 19454, 20363, 15000}, output = {116, 165, 436, 500};
            var script = new ScriptedModel(budget).reply("看剧本", act("read_canvas")).reply("看参考图", act("view_images"))
                    .reply("建视频对象", act("create_nodes")).reply("请确认方案", act("propose_plan"), act("request_approval"));
            DialogueLoop.Model model = new DialogueLoop.Model() {
                public long estimateInputTokens(List<Map<String, Object>> messages) { return 20000; }
                public DialogueLoop.Reply call(List<Map<String, Object>> messages, int index, int allowance) { budget.record(input[index - 1], output[index - 1]); return script.replies.removeFirst(); }
                public void appendExchange(List<Map<String, Object>> messages, DialogueLoop.Reply reply, List<DialogueLoop.ToolResult> results) { script.appendExchange(messages, reply, results); }
                public void appendUser(List<Map<String, Object>> messages, String text) { script.appendUser(messages, text); }
            };
            List<String> executed = new ArrayList<>();
            DialogueLoop.Tools tools = new DialogueLoop.Tools() {
                public Optional<String> reject(DialogueLoop.Action a) { return Optional.empty(); }
                public DialogueLoop.ToolOutcome run(DialogueLoop.Action a) {
                    executed.add(a.tool());
                    if (a.tool().equals("view_images")) { budget.beginSubCall(); budget.record(1034, 537); }
                    if (a.tool().equals("propose_plan")) { budget.beginSubCall(); budget.record(12000, 2000); }
                    return new DialogueLoop.ToolOutcome("{}", a.tool().equals("request_approval") ? DialogueLoop.Reason.WAITING_USER : null);
                }
            };
            var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
            assertEquals(DialogueLoop.Reason.WAITING_USER, outcome.reason());
            assertEquals(List.of("read_canvas", "view_images", "create_nodes", "propose_plan", "request_approval"), executed);
            assertTrue(r.settleContinued(budget.inputTokens(), budget.outputTokens()) <= r.maxCost());
        }
    }

    /** §10: one message, a task past the old 16 steps / 24 tools / 10 minutes / token split, done in one go. */
    @Test void aLongTaskPassesEveryOldPerTaskThresholdInOneGo() throws Exception {
        var clock = new MutableClock();
        var r = rate(".001", ".001", 1000, 1000);
        var budget = DialogueLoop.TurnBudget.metered(r, 1024, clock);
        var model = new ScriptedModel(budget);
        model.duringCall = () -> clock.advance(Duration.ofSeconds(30));
        for (int i = 0; i < 49; i++) model.reply("下一处", act("view_images", "{\"nodeIds\":[\"n" + i + "\"]}"));
        model.reply("已完成");
        var outcome = new DialogueLoop(model, new SubCallingTools(budget), new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertNull(outcome.limit());
        assertEquals(50, outcome.steps()); assertEquals(99, outcome.modelCalls()); assertEquals(49, outcome.toolCalls());
        assertTrue(budget.inputTokens() > r.maxInputTokens()); assertTrue(budget.outputTokens() > r.maxOutputTokens());
        assertTrue(r.settleContinued(budget.inputTokens(), budget.outputTokens()) <= r.maxCost());
    }

    @Test void theHoldUserStopAndRepeatProtectionStillApply() throws Exception {
        var r = rate("1", "1", 500, 500);
        var budget = DialogueLoop.TurnBudget.metered(r, 4096, Clock.systemUTC()); budget.record(900, 0);
        assertEquals("budget", budget.blockReason(0, 256)); assertEquals(100, budget.outputAllowance());
        var stopped = new Hooks(); stopped.stop.set(true); var model = new ScriptedModel(budget).reply("不能运行");
        assertEquals(DialogueLoop.Reason.INTERRUPTED, new DialogueLoop(model, new RecordingTools(), stopped, budget).run(new ArrayList<>()).reason());
        assertTrue(model.log.isEmpty());
        var other = DialogueLoop.TurnBudget.metered(r, 1024, Clock.systemUTC());
        var repeated = new ScriptedModel(other).reply("看", act("read_canvas")).reply("再看", act("read_canvas")).reply("仍然重复", act("read_canvas"));
        var tools = new RecordingTools(); assertEquals("loop", new DialogueLoop(repeated, tools, new Hooks(), other).run(new ArrayList<>()).limit());
        assertEquals(1, tools.ran.size());
    }

    @Test void aNormalMultiStepTaskCanExceedOrdinaryTextUsageAndStillFinish() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget);
        model.tokensPerCall = 3000;
        for (int i = 0; i < 9; i++) model.reply("处理下一部分", act("view_images", "{\"nodeIds\":[\"n" + i + "\"]}"));
        model.reply("已经完成");
        var tools = new SubCallingTools(budget);
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(10, outcome.steps());
        assertEquals(19, outcome.modelCalls());
        assertEquals(9, outcome.toolCalls());
        assertTrue(budget.outputTokens() > 8192, "the former ordinary-text output ceiling no longer interrupts the turn");
    }

    @Test void completesWhenTheModelRequestsNoAction() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("你好");
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(1, outcome.modelCalls());
        assertEquals(0, outcome.toolCalls());
    }

    /** 2026-10-30: 「好的，我来调整第二镜。」 with no action used to be the whole reply; the work now follows in the turn. */
    @Test void aReplyThatOnlyAnnouncesWorkIsCorrectedOnceAndTheWorkFollows() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("好的，我来调整第二镜。").reply("", act("update_nodes")).reply("第二镜改好了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(List.of("update_nodes"), tools.ran);
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(3, outcome.modelCalls());
        assertTrue(model.log.contains("user:" + DialogueLoop.ANNOUNCE_CORRECTION));
    }

    @Test void aPromiseRightAfterItsCorrectionEndsTheTurnInsteadOfLooping() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("我来改").reply("马上改").reply("我这就改").reply("我这就改");
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(2, outcome.modelCalls(), "one correction, then the turn ends");
    }

    @Test void aTurnGetsAtMostTwoCorrectionsEvenWhenWorkHappensInBetween() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("我来改第一镜").reply("", act("update_nodes"))
                .reply("我来改第二镜").reply("", act("create_nodes"))
                .reply("我来改第三镜").reply("不该被调用");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(List.of("update_nodes", "create_nodes"), tools.ran);
        assertEquals(5, outcome.modelCalls(), "the third announcement is not corrected");
        assertEquals(2, model.log.stream().filter(l -> l.equals("user:" + DialogueLoop.ANNOUNCE_CORRECTION)).count());
    }

    @Test void answersQuestionsAndWaitsAreNotAnnouncements() {
        for (String text : java.util.List.of("好的，我来调整第二镜。", "收到，马上改成横屏", "稍等，我这就重新出一张", "明白了，接下来我把字幕改大一点"))
            assertTrue(DialogueLoop.announcesWork(text), text);
        for (String text : java.util.List.of("第二镜改好了，换成了夜景。", "我来改的话，你想要什么风格？", "第二段生成好了我再告诉你",
                "你确认后我马上开始", "我来帮你分析一下这段文案：开头三秒没有钩子，中间卖点太多，结尾没有引导下单，建议把价格放到第二句，再补一句限时。",
                "", "你好"))
            assertFalse(DialogueLoop.announcesWork(text), text);
    }

    @Test void runsToolsInOrderAndFeedsResultsBackBeforeTheNextCall() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("先看画布", act("read_canvas"), act("read_skill")).reply("看完了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(List.of("read_canvas", "read_skill"), tools.ran);
        assertEquals(List.of("call1", "result:read_canvas", "result:read_skill", "call2"), model.log);
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(2, outcome.toolCalls());
    }

    @Test void stopThatArrivesDuringTheModelCallWinsOverItsActions() throws Exception {
        var budget = budget();
        var hooks = new Hooks();
        var model = new ScriptedModel(budget).reply("开始拉片", act("analyze_video"));
        model.duringCall = () -> hooks.stop.set(true);
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, hooks, budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.INTERRUPTED, outcome.reason());
        assertTrue(tools.ran.isEmpty(), "a reply's actions never run after a stop");
    }

    @Test void stopBeforeTheFirstCallMakesNoModelCall() throws Exception {
        var budget = budget();
        var hooks = new Hooks();
        hooks.stop.set(true);
        var model = new ScriptedModel(budget).reply("x");
        var outcome = new DialogueLoop(model, new RecordingTools(), hooks, budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.INTERRUPTED, outcome.reason());
        assertTrue(model.log.isEmpty());
    }

    @Test void rejectedActionsAreFedBackAndNeverExecuted() throws Exception {
        var budget = budget();
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
        var budget = budget();
        var model = new ScriptedModel(budget).reply("问一下", act("ask_question"), act("create_nodes"));
        var tools = new RecordingTools();
        tools.ends.put("ask_question", DialogueLoop.Reason.WAITING_USER);
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.WAITING_USER, outcome.reason());
        assertEquals(List.of("ask_question"), tools.ran);
        assertEquals(1, outcome.modelCalls());
    }

    /** The old 16-step stop is gone: thirty different steps and a final answer finish the task. */
    @Test void moreThanSixteenStepsNoLongerStopATask() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 30; i++) model.reply("再看一处", act("view_images", "{\"nodeIds\":[\"n" + i + "\"]}"));
        model.reply("都看完了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(31, outcome.steps());
        assertEquals(30, tools.ran.size());
    }

    /** A tool's own model call (view_images' look, propose_plan's planner) spends tokens but is not a dialogue step. */
    @Test void toolInternalCallsCountAsModelCallsNotSteps() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 20; i++) model.reply("再看一处", act("view_images", "{\"nodeIds\":[\"n" + i + "\"]}"));
        model.reply("完成");
        var tools = new SubCallingTools(budget);
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(21, outcome.steps());
        assertEquals(41, outcome.modelCalls(), "21 steps plus 20 looks");
        assertEquals(41 * 100L, budget.inputTokens(), "the looks' tokens are in the task budget");
    }

    /**
     * Production 2026-10-21 17:38 CST (run IPR-472ed89b5c174a95808f, canvas IPP-655ea55a): 「用这张图做一段视频」 took five
     * dialogue steps and three tool-internal calls (look, plan, plan), and stopped at the old 8-call cap one step before the
     * confirmation card. The sixth step sends the card.
     */
    @Test void theProductionTurnReachesItsConfirmationCard() throws Exception {
        var budget = budget();
        var model = incidentScript(budget);
        var tools = new IncidentTools(budget);
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.WAITING_USER, outcome.reason(), "the card went out and the turn waits for the user");
        assertEquals(6, outcome.steps());
        assertEquals(9, outcome.modelCalls(), "six steps plus look, plan, plan");
        assertEquals(List.of("view_images", "read_skill", "create_nodes", "propose_plan", "request_approval", "create_nodes",
                "connect_nodes", "propose_plan", "request_approval"), tools.ran);
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

    /** The hidden safety net of one turn counts every model call, tool-internal ones too (300). */
    @Test void theSafetyNetCountsEveryCallOfTheTurn() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 200; i++) model.reply("再看一处", act("view_images", "{\"nodeIds\":[\"n" + i + "\"]}"));
        var tools = new SubCallingTools(budget);
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("safeguard", outcome.limit());
        // Each step makes one look: 150 steps reach 300 calls, the 151st step is not made.
        assertEquals(150, outcome.steps());
        assertEquals(DialogueLoop.MAX_TURN_MODEL_CALLS, outcome.modelCalls());
    }

    /** …and two hours since the turn was accepted. */
    @Test void theSafetyNetEndsATurnAfterTwoHours() throws Exception {
        var clock = new MutableClock();
        var budget = DialogueLoop.TurnBudget.metered(rate("1", "1", 1_000_000, 100_000), 1_000_000, 1024, clock,
                clock.instant().minus(DialogueLoop.MAX_TURN_DURATION).plusSeconds(60), null);
        var model = new ScriptedModel(budget).reply("拉片中", act("analyze_video")).reply("x");
        model.duringCall = () -> clock.advance(Duration.ofMinutes(2));
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals("safeguard", outcome.limit());
        assertEquals(1, outcome.modelCalls());
    }

    /** Eleven minutes per call no longer end a task: the old ten-minute stop is gone. */
    @Test void slowCallsNoLongerEndATask() throws Exception {
        var clock = new MutableClock();
        var budget = DialogueLoop.TurnBudget.metered(rate("1", "1", 1_000_000, 100_000), 1024, clock);
        var model = new ScriptedModel(budget).reply("拉片中", act("analyze_video")).reply("拉完了");
        model.duringCall = () -> clock.advance(Duration.ofMinutes(11));
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(2, outcome.modelCalls());
    }

    /** The old 24-tool stop is gone: twelve batches of three reads all run. */
    @Test void moreThanTwentyFourToolRunsNoLongerStopATask() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 12; i++) model.reply("多做几步", act("read_canvas", "{\"page\":" + (3 * i) + "}"),
                act("read_canvas", "{\"page\":" + (3 * i + 1) + "}"), act("read_canvas", "{\"page\":" + (3 * i + 2) + "}"));
        model.reply("完成");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(36, tools.ran.size());
    }

    /**
     * §3: one turn, one run. A call that does not fit what is held first adds a hold of max(increment, need) to the same
     * run; the turn goes on, and the total held covers the real usage.
     */
    @Test void aCallThatDoesNotFitAddsAHoldAndTheTurnGoesOn() throws Exception {
        List<Long> asked = new ArrayList<>();
        // 1 credit per input token, output free; the first hold is 250 credits.
        var budget = DialogueLoop.TurnBudget.metered(rate("1000", "0", 250, 1), 250, 1024, Clock.systemUTC(), null,
                need -> { asked.add(need); return Math.max(250, need); });
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 6; i++) model.reply("下一段", act("read_canvas", "{\"page\":" + i + "}"));
        model.reply("读完了");
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(7, outcome.modelCalls());
        assertFalse(asked.isEmpty(), "holds were added on the way");
        assertTrue(budget.held() >= budget.inputTokens(), "what is held covers the real usage");
    }

    /** The wallet is empty: the added hold is refused, the call is not made, the turn stops with budget. */
    @Test void aRefusedAddedHoldStopsTheTurnBeforeTheCall() throws Exception {
        var budget = DialogueLoop.TurnBudget.metered(rate("1000", "0", 250, 1), 250, 1024, Clock.systemUTC(), null, need -> 0);
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 5; i++) model.reply("下一段", act("read_canvas", "{\"page\":" + i + "}"));
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("budget", outcome.limit());
        // Each call uses 100 input tokens and the next one is estimated at 10: 0+10, 100+10, 200+10 fit 250; 300+10 does not.
        assertEquals(3, outcome.modelCalls());
    }

    /**
     * A tool's own call (view_images, propose_plan) adds a hold the same way: the tool runs normally, no failed record.
     * Only when the wallet is empty does it end the turn.
     */
    @Test void aToolsOwnCallAddsAHoldInsteadOfFailing() throws Exception {
        var budget = DialogueLoop.TurnBudget.metered(rate("1000", "0", 250, 1), 250, 1024, Clock.systemUTC(), null, need -> need);
        assertNull(budget.blockReason(5000, 256), "the look's 5000 credits are added, not refused");
        assertTrue(budget.held() >= 5000);
        var empty = DialogueLoop.TurnBudget.metered(rate("1000", "0", 250, 1), 250, 1024, Clock.systemUTC(), null, need -> 0);
        var model = new ScriptedModel(empty).reply("看图", act("view_images"), act("create_nodes"));
        DialogueLoop.Tools tools = new DialogueLoop.Tools() {
            public Optional<String> reject(DialogueLoop.Action a) { return Optional.empty(); }
            public DialogueLoop.ToolOutcome run(DialogueLoop.Action a) {
                assertEquals("budget", empty.blockReason(5000, 256));
                return new DialogueLoop.ToolOutcome("{\"ok\":false}", DialogueLoop.Reason.LIMIT);
            }
        };
        var outcome = new DialogueLoop(model, tools, new Hooks(), empty).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("budget", outcome.limit());
        assertEquals(1, outcome.toolCalls(), "the second action did not run");
    }

    @Test void steeringAtTheToolBoundaryReachesTheNextModelCall() throws Exception {
        var budget = budget();
        var hooks = new Hooks();
        var model = new ScriptedModel(budget).reply("先看画布", act("read_canvas")).reply("收到你的调整");
        hooks.steering.add(List.of("第3段换成这张图"));
        var outcome = new DialogueLoop(model, new RecordingTools(), hooks, budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(List.of("call1", "result:read_canvas", "user:用户在你工作时发来新消息（按收到顺序，属于对当前安排的调整）：", "call2"), model.log);
    }

    @Test void pendingSteeringKeepsATurnGoingInsteadOfCompleting() throws Exception {
        var budget = budget();
        var hooks = new Hooks();
        hooks.steering.add(List.of("预算提高到2000"));
        var model = new ScriptedModel(budget).reply("好的").reply("已按 2000 调整");
        var outcome = new DialogueLoop(model, new RecordingTools(), hooks, budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(2, outcome.modelCalls());
    }

    @Test void unparseableActionBlockIsFedBackNotExecuted() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).broken("我来建节点").reply("重新给出", act("create_nodes")).reply("建好了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(List.of("create_nodes"), tools.ran);
        assertEquals(3, outcome.modelCalls());
        assertTrue(model.log.stream().anyMatch(l -> l.startsWith("user:上一条回复里的动作格式无法解析")));
    }

    /** 2026-10-21: the correction carries one complete action, and that action is one the parser accepts as view_images. */
    @Test void theCorrectionShowsACompleteActionTheParserAccepts() throws Exception {
        var budget = budget();
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

    @Test void outputAllowanceShrinksWithTheRemainingHold() {
        // Output costs 1 credit per token, input free: a hold of 1500 credits.
        var budget = DialogueLoop.TurnBudget.metered(rate("0", "1000", 1, 1500), 4096, Clock.systemUTC());
        budget.record(0, 1000);
        assertEquals(500, budget.outputAllowance());
        assertEquals("budget", budget.blockReason(10, 600));
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
        var budget = budget();
        var model = new ScriptedModel(budget).broken("a").broken("b").broken("c").reply("不该到这里");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("protocol", outcome.limit());
        assertEquals(3, outcome.modelCalls(), "two corrections, then stop");
        assertTrue(tools.ran.isEmpty(), "a malformed batch never runs");
    }

    @Test void aCorrectedReplyResetsTheProtocolCounter() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).broken("a").broken("b").reply("看", act("read_canvas")).broken("c").reply("好了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(List.of("read_canvas"), tools.ran);
    }

    // ── Going round in circles ───────────────────────────────────────────────────────────────────────────────────

    /** §2: the first repeat gets one correction and the task goes on; a model that then changes course finishes. */
    @Test void aRepeatIsCorrectedOnceAndADifferentNextStepFinishes() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("看一下", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("再看一下", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("换个做法", act("create_nodes", "{\"nodes\":[{\"type\":\"text\"}]}")).reply("做好了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertNull(outcome.limit());
        assertEquals(List.of("view_images", "create_nodes"), tools.ran, "the repeated batch never runs");
        assertTrue(model.log.contains("user:" + DialogueLoop.REPEAT_CORRECTION));
    }

    /** …and the same batch again after the correction ends the task as a loop. */
    @Test void theSameBatchAgainAfterTheCorrectionEndsTheTask() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("看一下", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("再看一下", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("还是看一下", act("view_images", "{\"nodeIds\":[\"a\"]}")).reply("不该到这里");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("loop", outcome.limit());
        assertEquals(List.of("view_images"), tools.ran, "the repeated batch never runs");
        assertEquals(3, outcome.steps());
    }

    @Test void aTruncatedReadCanRecoverWithinTheSameTurnWithoutRepeatingTheTool() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("读正文", act("read_canvas", "{\"nodeIds\":[\"script\"]}"))
                .reply("再读", act("read_canvas", "{\"nodeIds\":[\"script\"]}"))
                .reply("读下一段", act("read_canvas", "{\"nodeIds\":[\"script\"],\"offset\":8000}"))
                .reply("写完整稿", act("create_nodes")).reply("完成");
        var tools = new RecordingTools(); var messages = new ArrayList<Map<String, Object>>();
        var result = new DialogueLoop(model, tools, new Hooks(), budget).run(messages);
        assertEquals(DialogueLoop.Reason.COMPLETED, result.reason());
        assertEquals(List.of("read_canvas", "read_canvas", "create_nodes"), tools.ran);
        assertTrue(messages.stream().anyMatch(m -> String.valueOf(m.get("content")).contains("READ_ALREADY_RETURNED")));
        assertTrue(messages.stream().anyMatch(m -> String.valueOf(m.get("content")).contains("nextOffset")), "the correction says how to read on");
    }

    @Test void aRepeatedReadOnlyLookIsALoopToo() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("看画布", act("read_canvas")).reply("再看画布", act("read_canvas")).reply("仍然重复", act("read_canvas"));
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals("loop", outcome.limit());
    }

    /** Key order, null fields, surrounding spaces, number spelling and the action id do not make a batch different. */
    @Test void argumentsAreComparedAfterNormalizing() throws Exception {
        var budget = budget();
        var first = act("view_images", "{\"nodeIds\":[\"a\",\"b\"],\"question\":\"画面里有什么\",\"max\":2}");
        var second = new DialogueLoop.Action("call_9f3", "view_images",
                OM.readTree("{\"question\":\" 画面里有什么 \",\"max\":2.0,\"nodeIds\":[\"a\",\"b\"],\"extra\":null}"));
        var model = new ScriptedModel(budget).reply("看", first).reply("再看", second).reply("又看", second);
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals("loop", outcome.limit());
        assertEquals(DialogueLoop.batchSignature(List.of(first)), DialogueLoop.batchSignature(List.of(second)));
    }

    @Test void aMultiActionBatchRepeatedIsALoop() throws Exception {
        var budget = budget();
        var batch = new DialogueLoop.Action[] {act("create_nodes", "{\"nodes\":[{\"type\":\"image\"}]}"), act("connect_nodes", "{\"from\":\"a\",\"to\":\"b\"}")};
        var model = new ScriptedModel(budget).reply("建好再连", batch).reply("建好再连", batch).reply("建好再连", batch);
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals("loop", outcome.limit());
        assertEquals(List.of("create_nodes", "connect_nodes"), tools.ran);
    }

    @Test void differentArgumentsAreNotALoop() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("看 a", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("看 b", act("view_images", "{\"nodeIds\":[\"b\"]}")).reply("看完了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(2, tools.ran.size());
    }

    @Test void onlyConsecutiveRepeatsCount() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("看画布", act("read_canvas")).reply("看图", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("再看画布", act("read_canvas")).reply("好了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(List.of("read_canvas", "view_images", "read_canvas"), tools.ran);
    }

    /** A user message in between is new information: the same batch may run again. */
    @Test void steeringBetweenTwoIdenticalBatchesIsNotALoop() throws Exception {
        var budget = budget();
        var hooks = new Hooks();
        hooks.steering.add(List.of("我刚换了一张图，再看一下"));
        var model = new ScriptedModel(budget).reply("看图", act("view_images", "{\"nodeIds\":[\"a\"]}"))
                .reply("再看一下", act("view_images", "{\"nodeIds\":[\"a\"]}")).reply("看完了");
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, hooks, budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(List.of("view_images", "view_images"), tools.ran);
    }

    /** A reply rejected for its format in between is not a different step: the repeat after it is still a repeat. */
    @Test void aFormatCorrectionInBetweenDoesNotHideARepeat() throws Exception {
        var budget = budget();
        var model = new ScriptedModel(budget).reply("看图", act("view_images", "{\"nodeIds\":[\"a\"]}")).broken("[调用工具 view_images]")
                .reply("看图", act("view_images", "{\"nodeIds\":[\"a\"]}")).reply("看图", act("view_images", "{\"nodeIds\":[\"a\"]}"));
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals("loop", outcome.limit());
        assertEquals(List.of("view_images"), tools.ran);
        assertTrue(model.log.contains("user:" + DialogueLoop.REPEAT_CORRECTION));
    }

    /** §4: every call sees a bounded window; the full exchange keeps growing. */
    @Test void everyCallSeesATrimmedWindowWhileTheExchangeKeepsGrowing() throws Exception {
        var budget = budget();
        List<Integer> seen = new ArrayList<>();
        var model = new ScriptedModel(budget) {
            @Override public DialogueLoop.Reply call(List<Map<String, Object>> messages, int callIndex, int maxOutputTokens) {
                seen.add((int) messages.stream().filter(m -> String.valueOf(m.get("content")).startsWith("（较早的结果，已压缩）")).count());
                return super.call(messages, callIndex, maxOutputTokens);
            }
        };
        for (int i = 0; i < 12; i++) model.reply("读第 " + i + " 段", act("read_canvas", "{\"offset\":" + (i * 8000) + "}"));
        model.reply("读完了");
        var messages = new ArrayList<Map<String, Object>>(List.of(Map.of("role", "system", "content", "系统"), Map.of("role", "user", "content", "任务")));
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(messages);
        assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
        assertEquals(0, (int) seen.get(0));
        assertTrue(seen.get(seen.size() - 1) > 0, "older results were reduced in the window");
        assertTrue(messages.stream().noneMatch(m -> String.valueOf(m.get("content")).startsWith("（较早的结果，已压缩）")), "the exchange itself is unchanged");
    }
}
