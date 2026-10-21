package com.aistareco.aep.ipstudio.dialogue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The bounded agent loop of one dialogue turn: model → typed actions → validate and run tools → feed results back →
 * continue (docs/ip-studio-conversational-video-recreation-plan.md §一轮为有界agent循环).
 *
 * <p>Pure state machine: no Spring, no repositories. The model, tools and side channels are injected so the ordering,
 * limits, stop priority and steering rules are unit-testable. It ends when the model returns no actions (and no steering
 * is pending), when a tool needs a user decision, when a limit is hit (dialogue steps, model calls, tool calls, wall time,
 * token budget), when the model repeats its previous action batch, or when a stop arrived. Actions from a reply are only
 * executed after that reply finished and parsed completely.
 *
 * <p>What bounds the spend of a turn is the token budget (the user-approved per-turn ceiling) and {@link #MAX_DURATION};
 * the step and call counts only guard against a runaway loop. Production 2026-10-21 (IPR-472ed89b5c174a95808f): a turn
 * stopped at 8 model calls one step before its confirmation card, because the cap also counted the calls tools make
 * themselves (looking at images, planning). Steps now count only the loop's own model calls; tool-internal calls still
 * spend tokens and time, and a looser total cap catches anything abnormal.
 */
public final class DialogueLoop {
    /** Calls of the loop's model (dialogue steps) per turn. */
    public static final int MAX_DIALOGUE_STEPS = 16;
    /** Every model call of a turn: dialogue steps plus tool-internal calls and the history summary. A safety net only. */
    public static final int MAX_MODEL_CALLS = 40;
    /** Tool runs per turn (rejected actions are not runs). The batch that reaches it is cut there and the turn stops. */
    public static final int MAX_TOOL_CALLS = 24;
    public static final Duration MAX_DURATION = Duration.ofMinutes(10);
    /** Smallest output budget worth another model call. */
    public static final int MIN_OUTPUT_TOKENS = 256;

    public enum Reason { COMPLETED, WAITING_USER, HANDED_OFF, INTERRUPTED, LIMIT }

    /** One typed action requested by the model; {@code id} is the native tool_call id or a generated one. */
    public record Action(String id, String tool, JsonNode args) {}

    /**
     * One model reply. {@code visibleText} is what the user saw; {@code parseError} is set when the reply contained an
     * action block that could not be parsed (fed back so the model can correct itself; nothing is executed).
     */
    public record Reply(String visibleText, List<Action> actions, String parseError, Object protocolPayload) {
        public Reply { actions = actions == null ? List.of() : List.copyOf(actions); }
    }

    /** Outcome of one tool run: content goes back to the model; {@code end} set when the turn must stop afterwards. */
    public record ToolOutcome(String content, Reason end) {
        public static ToolOutcome of(String content) { return new ToolOutcome(content, null); }
    }

    public record ToolResult(Action action, String content) {}

    /**
     * {@code limit} is set for {@link Reason#LIMIT}: steps | calls | tools | time | tokens | loop | protocol.
     * {@code modelCalls} counts every model call of the turn (steps plus tool-internal calls); {@code steps} the loop's own.
     */
    public record Outcome(Reason reason, String limit, int modelCalls, int steps, int toolCalls) {}

    /** Model side. Implementations stream text to the user, record real usage in the shared {@link TurnBudget}. */
    public interface Model {
        long estimateInputTokens(List<Map<String, Object>> messages);
        Reply call(List<Map<String, Object>> messages, int callIndex, int maxOutputTokens) throws Exception;
        /** Append the assistant reply and its tool results in this protocol's message shape (native tools or JSON actions). */
        void appendExchange(List<Map<String, Object>> messages, Reply reply, List<ToolResult> results);
        void appendUser(List<Map<String, Object>> messages, String text);
        /**
         * The turn's loop is over (any reason, also an exception). A model that held back the prose of a reply rejected for
         * its action format, waiting for the corrected try, shows it now: every try was rejected, or the turn stopped
         * before the next try.
         */
        default void endTurn() { }
    }

    public interface Tools {
        /** Reason the action is not allowed (unknown tool, stage whitelist, arguments), or empty when it may run. */
        Optional<String> reject(Action action);
        ToolOutcome run(Action action) throws Exception;
    }

    public interface Hooks {
        boolean stopRequested();
        /** Queued user steering read at a safe boundary; returned texts are marked applied by the implementation. */
        List<String> drainSteering();
        void heartbeat();
    }

    private final Model model;
    private final Tools tools;
    private final Hooks hooks;
    private final TurnBudget budget;
    private final int maxToolCalls;

    public DialogueLoop(Model model, Tools tools, Hooks hooks, TurnBudget budget) { this(model, tools, hooks, budget, MAX_TOOL_CALLS); }

    public DialogueLoop(Model model, Tools tools, Hooks hooks, TurnBudget budget, int maxToolCalls) {
        this.model = model; this.tools = tools; this.hooks = hooks; this.budget = budget; this.maxToolCalls = maxToolCalls;
    }

    /** Consecutive replies whose actions could not be parsed before the turn stops instead of paying for another try. */
    static final int MAX_PROTOCOL_RETRIES = 2;

    public Outcome run(List<Map<String, Object>> messages) throws Exception {
        Outcome outcome;
        try { outcome = loop(messages); }
        catch (Exception e) {
            try { model.endTurn(); } catch (RuntimeException shown) { e.addSuppressed(shown); }
            throw e;
        }
        model.endTurn();
        return outcome;
    }

    private Outcome loop(List<Map<String, Object>> messages) throws Exception {
        int toolCalls = 0, protocolErrors = 0;
        // The previous step's action batch, normalized; cleared when user steering is added (new information).
        String lastBatch = null;
        while (true) {
            if (hooks.stopRequested()) return outcome(Reason.INTERRUPTED, null, toolCalls);
            String limit = budget.stepBlockReason(model.estimateInputTokens(messages), MIN_OUTPUT_TOKENS);
            if (limit != null) return outcome(Reason.LIMIT, limit, toolCalls);
            budget.beginStep();
            Reply reply = model.call(messages, budget.steps(), budget.outputAllowance());
            hooks.heartbeat();
            // A stop that arrived while the model was answering wins over the reply's actions.
            if (hooks.stopRequested()) return outcome(Reason.INTERRUPTED, null, toolCalls);
            if (reply.parseError() != null) {
                // Nothing in a malformed batch runs. Two corrections are enough; a third paid call that repeats the same
                // wrong spelling only spends the user's turn budget.
                if (++protocolErrors > MAX_PROTOCOL_RETRIES) return outcome(Reason.LIMIT, "protocol", toolCalls);
                model.appendExchange(messages, reply, List.of());
                model.appendUser(messages, correctionText(reply.parseError()));
                continue;
            }
            protocolErrors = 0;
            if (reply.actions().isEmpty()) {
                List<String> steering = canContinue(messages) ? hooks.drainSteering() : List.of();
                if (steering.isEmpty()) return outcome(Reason.COMPLETED, null, toolCalls);
                model.appendExchange(messages, reply, List.of());
                model.appendUser(messages, steeringText(steering));
                lastBatch = null;
                continue;
            }
            // The same batch as the previous step, with no user message in between: the model is going round in circles
            // (also for read-only tools: another identical look at the canvas tells it nothing new). A reply rejected for
            // its format in between does not count as a different step. Nothing of the repeated batch runs.
            String batch = batchSignature(reply.actions());
            if (batch.equals(lastBatch)) return outcome(Reason.LIMIT, "loop", toolCalls);
            lastBatch = batch;
            List<ToolResult> results = new ArrayList<>();
            Reason end = null;
            boolean toolLimit = false, interrupted = false;
            for (Action action : reply.actions()) {
                if (interrupted || hooks.stopRequested()) {
                    interrupted = true;
                    results.add(new ToolResult(action, "{\"ok\":false,\"summary\":\"用户已停止，本动作未执行\"}"));
                    continue;
                }
                if (end != null) {
                    results.add(new ToolResult(action, "{\"ok\":false,\"summary\":\"需要先等用户回复，本动作未执行\"}"));
                    continue;
                }
                if (toolCalls >= maxToolCalls) {
                    toolLimit = true;
                    results.add(new ToolResult(action, "{\"ok\":false,\"summary\":\"本轮动作次数已用完，本动作未执行\"}"));
                    continue;
                }
                Optional<String> rejected = tools.reject(action);
                if (rejected.isPresent()) {
                    results.add(new ToolResult(action, "{\"ok\":false,\"summary\":" + quote(rejected.get()) + "}"));
                    continue;
                }
                ToolOutcome out = tools.run(action);
                toolCalls++;
                results.add(new ToolResult(action, out.content()));
                if (out.end() != null) end = out.end();
                hooks.heartbeat();
            }
            model.appendExchange(messages, reply, results);
            if (interrupted) return outcome(Reason.INTERRUPTED, null, toolCalls);
            if (end != null) return outcome(end, null, toolCalls);
            if (toolLimit) return outcome(Reason.LIMIT, "tools", toolCalls);
            // Steering is only taken (and marked applied) when another model call can actually answer it in this turn;
            // otherwise it stays queued and opens the next turn.
            List<String> steering = canContinue(messages) ? hooks.drainSteering() : List.of();
            if (!steering.isEmpty()) { model.appendUser(messages, steeringText(steering)); lastBatch = null; }
        }
    }

    private boolean canContinue(List<Map<String, Object>> messages) {
        return !hooks.stopRequested() && budget.stepBlockReason(model.estimateInputTokens(messages) + 200, MIN_OUTPUT_TOKENS) == null;
    }

    private Outcome outcome(Reason reason, String limit, int toolCalls) {
        return new Outcome(reason, limit, budget.modelCalls(), budget.steps(), toolCalls);
    }

    /**
     * An action batch in a form that compares equal when it asks for the same work: tool names and arguments in order,
     * object keys sorted, null fields dropped, text trimmed, numbers by value. The action id is left out (a native
     * tool_call id differs on every reply).
     */
    static String batchSignature(List<Action> actions) {
        StringBuilder out = new StringBuilder();
        for (Action a : actions) {
            out.append(a.tool() == null ? "" : a.tool().strip()).append('(');
            if (a.args() == null || a.args().isNull() || a.args().isMissingNode()) out.append("{}"); // no arguments = empty arguments
            else canonical(a.args(), out);
            out.append(");");
        }
        return out.toString();
    }

    private static void canonical(JsonNode node, StringBuilder out) {
        if (node == null || node.isNull() || node.isMissingNode()) { out.append("null"); return; }
        if (node.isObject()) {
            java.util.TreeMap<String, JsonNode> fields = new java.util.TreeMap<>();
            node.fields().forEachRemaining(e -> { if (!e.getValue().isNull() && !e.getValue().isMissingNode()) fields.put(e.getKey().strip(), e.getValue()); });
            out.append('{');
            fields.forEach((k, v) -> { out.append(quote(k)).append(':'); canonical(v, out); out.append(','); });
            out.append('}');
        } else if (node.isArray()) {
            out.append('[');
            for (JsonNode v : node) { canonical(v, out); out.append(','); }
            out.append(']');
        } else if (node.isNumber()) {
            out.append(node.decimalValue().stripTrailingZeros().toPlainString());
        } else if (node.isTextual()) {
            out.append(quote(node.asText().strip()));
        } else out.append(node.asText());
    }

    /** A complete, minimal action the correction shows; the argument names are view_images' real parameters. */
    static final String ACTION_EXAMPLE = "[{\"tool\":\"view_images\",\"args\":{\"nodeIds\":[\"对象 id\"],\"question\":\"想确认什么\"}}]";

    /**
     * The correction after a reply whose actions could not be parsed: the reason, and one complete action in the expected
     * shape. Without the example the model repeated its own spelling (2026-10-21: 「[调用工具 view_images]」). The marker is
     * written once: three tries in a row closed the array with the marker again (2026-10-21 14:10).
     */
    static String correctionText(String parseError) {
        return "上一条回复里的动作格式无法解析（" + parseError + "），工具没有运行。请重新给出动作，正文不必重复，不要在正文里写「[调用工具 …]」这类文字。"
                + "能直接调用工具就直接调用；否则另起一行写 " + DialogueActionProtocol.MARKER + "，下一行写 JSON 数组，例如：\n"
                + DialogueActionProtocol.MARKER + "\n" + ACTION_EXAMPLE + "\n把 view_images 换成你要调用的工具，args 按该工具的参数写。"
                + "分隔行 " + DialogueActionProtocol.MARKER + " 只写一次，数组后面不要再写。";
    }

    static String steeringText(List<String> steering) {
        StringBuilder out = new StringBuilder("用户在你工作时发来新消息（按收到顺序，属于对当前安排的调整）：");
        for (int i = 0; i < steering.size(); i++) out.append("\n").append(i + 1).append(". ").append(steering.get(i));
        out.append("\n先回应已收到，再判断哪些能在当前范围内直接应用、哪些需要用户补充或重新确认。");
        return out.toString();
    }

    static String quote(String text) {
        StringBuilder out = new StringBuilder("\"");
        for (char c : text.toCharArray()) {
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> { if (c < 0x20) out.append(String.format("\\u%04x", (int) c)); else out.append(c); }
            }
        }
        return out.append('"').toString();
    }

    /**
     * Shared per-turn budget: dialogue steps (the loop's own model calls), all model calls (steps plus tool-internal calls
     * and the history summary), wall time and the token ceiling the user approved (the endpoint rate's maxInputTokens /
     * maxOutputTokens, summed over every call of the turn).
     *
     * <p>Every model call goes through exactly one of {@link #beginStep()} (the loop) or {@link #beginSubCall()} (anything
     * else); both count toward {@link #modelCalls()}, tokens and time, only steps toward the step limit.
     */
    public static final class TurnBudget {
        private final int maxSteps, maxModelCalls;
        private final long maxInputTokens, maxOutputTokens;
        private final int desiredOutputTokens;
        private final Instant deadline;
        private final Clock clock;
        private int steps, modelCalls;
        private long inputTokens, outputTokens;

        public TurnBudget(int maxSteps, int maxModelCalls, long maxInputTokens, long maxOutputTokens, int desiredOutputTokens, Duration maxDuration, Clock clock) {
            this.maxSteps = maxSteps; this.maxModelCalls = maxModelCalls; this.maxInputTokens = maxInputTokens; this.maxOutputTokens = maxOutputTokens;
            this.desiredOutputTokens = desiredOutputTokens; this.clock = clock; this.deadline = clock.instant().plus(maxDuration);
        }

        /** The standard limits with the token ceiling of the turn's rate. */
        public static TurnBudget standard(long maxInputTokens, long maxOutputTokens, int desiredOutputTokens, Clock clock) {
            return new TurnBudget(MAX_DIALOGUE_STEPS, MAX_MODEL_CALLS, maxInputTokens, maxOutputTokens, desiredOutputTokens, MAX_DURATION, clock);
        }

        /** Unlimited token budget (fixture mode: no vendor, zero cost); step, call and time limits still apply. */
        public static TurnBudget unmetered(int desiredOutputTokens, Clock clock) {
            return standard(Long.MAX_VALUE / 4, Long.MAX_VALUE / 4, desiredOutputTokens, clock);
        }

        /** Null when another dialogue step (a call of the loop's model) fits; otherwise steps | calls | time | tokens. */
        public synchronized String stepBlockReason(long estimatedInput, int minOutput) {
            if (steps >= maxSteps) return "steps";
            return blockReason(estimatedInput, minOutput);
        }

        /**
         * Null when another model call fits; otherwise calls | time | tokens. A tool's own model call and the history
         * summary check only this: they are part of a step, not steps of their own.
         */
        public synchronized String blockReason(long estimatedInput, int minOutput) {
            if (modelCalls >= maxModelCalls) return "calls";
            if (!clock.instant().isBefore(deadline)) return "time";
            if (inputTokens + Math.max(0, estimatedInput) > maxInputTokens || outputTokens + minOutput > maxOutputTokens) return "tokens";
            return null;
        }
        /** The loop calls its model: one dialogue step, and one model call. */
        public synchronized void beginStep() { steps++; modelCalls++; }
        /** A model call that is not a dialogue step (view_images' look, propose_plan's planner, the history summary). */
        public synchronized void beginSubCall() { modelCalls++; }
        public synchronized int outputAllowance() { return (int) Math.max(0, Math.min(desiredOutputTokens, maxOutputTokens - outputTokens)); }
        public synchronized int outputAllowance(int desired) { return (int) Math.max(0, Math.min(desired, maxOutputTokens - outputTokens)); }
        public synchronized void record(long input, long output) { inputTokens = Math.addExact(inputTokens, input); outputTokens = Math.addExact(outputTokens, output); }
        public synchronized int steps() { return steps; }
        public synchronized int modelCalls() { return modelCalls; }
        public synchronized long inputTokens() { return inputTokens; }
        public synchronized long outputTokens() { return outputTokens; }
        public Duration remainingTime() { var left = Duration.between(clock.instant(), deadline); return left.isNegative() ? Duration.ZERO : left; }
        public Instant deadline() { return deadline; }
    }
}
