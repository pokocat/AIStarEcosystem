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

    private DialogueLoop.TurnBudget budget(long maxIn, long maxOut) {
        return new DialogueLoop.TurnBudget(DialogueLoop.MAX_MODEL_CALLS, maxIn, maxOut, 1024, DialogueLoop.MAX_DURATION, Clock.systemUTC());
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

    @Test void modelCallLimitStopsTheLoop() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 20; i++) model.reply("再看一次", act("read_canvas"));
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget, 100).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("calls", outcome.limit());
        assertEquals(DialogueLoop.MAX_MODEL_CALLS, outcome.modelCalls());
    }

    @Test void toolCallLimitStopsTheLoop() throws Exception {
        var budget = budget(100_000, 100_000);
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 5; i++) model.reply("多做几步", act("read_canvas"), act("read_canvas"), act("read_canvas"));
        var tools = new RecordingTools();
        var outcome = new DialogueLoop(model, tools, new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("tools", outcome.limit());
        assertEquals(DialogueLoop.MAX_TOOL_CALLS, tools.ran.size());
    }

    @Test void tokenBudgetStopsBeforeACallThatCannotFit() throws Exception {
        var budget = budget(250, 100_000);
        var model = new ScriptedModel(budget);
        for (int i = 0; i < 5; i++) model.reply("继续", act("read_canvas"));
        var outcome = new DialogueLoop(model, new RecordingTools(), new Hooks(), budget).run(new ArrayList<>());
        assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
        assertEquals("tokens", outcome.limit());
        // Each call uses 100 input tokens and the next one is estimated at 10: 0+10, 100+10, 200+10 fit 250; 300+10 does not.
        assertEquals(3, outcome.modelCalls());
    }

    @Test void wallClockLimitStopsTheLoop() throws Exception {
        var clock = new MutableClock();
        var budget = new DialogueLoop.TurnBudget(8, 100_000, 100_000, 1024, Duration.ofMinutes(10), clock);
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
}
