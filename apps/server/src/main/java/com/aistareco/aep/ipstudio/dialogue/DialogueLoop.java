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
 * is pending), when a tool needs a user decision, when a limit is hit (model calls, tool calls, wall time, token budget),
 * or when a stop arrived. Actions from a reply are only executed after that reply finished and parsed completely.
 */
public final class DialogueLoop {
    public static final int MAX_MODEL_CALLS = 8;
    public static final int MAX_TOOL_CALLS = 12;
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

    public record Outcome(Reason reason, String limit, int modelCalls, int toolCalls) {}

    /** Model side. Implementations stream text to the user, record real usage in the shared {@link TurnBudget}. */
    public interface Model {
        long estimateInputTokens(List<Map<String, Object>> messages);
        Reply call(List<Map<String, Object>> messages, int callIndex, int maxOutputTokens) throws Exception;
        /** Append the assistant reply and its tool results in this protocol's message shape (native tools or JSON actions). */
        void appendExchange(List<Map<String, Object>> messages, Reply reply, List<ToolResult> results);
        void appendUser(List<Map<String, Object>> messages, String text);
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
        int toolCalls = 0, protocolErrors = 0;
        while (true) {
            if (hooks.stopRequested()) return outcome(Reason.INTERRUPTED, null, toolCalls);
            String limit = budget.blockReason(model.estimateInputTokens(messages), MIN_OUTPUT_TOKENS);
            if (limit != null) return outcome(Reason.LIMIT, limit, toolCalls);
            budget.beginCall();
            Reply reply = model.call(messages, budget.modelCalls(), budget.outputAllowance());
            hooks.heartbeat();
            // A stop that arrived while the model was answering wins over the reply's actions.
            if (hooks.stopRequested()) return outcome(Reason.INTERRUPTED, null, toolCalls);
            if (reply.parseError() != null) {
                // Nothing in a malformed batch runs. Two corrections are enough; a third paid call that repeats the same
                // wrong spelling only spends the user's turn budget.
                if (++protocolErrors > MAX_PROTOCOL_RETRIES) return outcome(Reason.LIMIT, "protocol", toolCalls);
                model.appendExchange(messages, reply, List.of());
                model.appendUser(messages, "上一条回复里的动作格式无法解析（" + reply.parseError() + "）。请按约定格式重新给出动作，正文不必重复。");
                continue;
            }
            protocolErrors = 0;
            if (reply.actions().isEmpty()) {
                List<String> steering = canContinue(messages) ? hooks.drainSteering() : List.of();
                if (steering.isEmpty()) return outcome(Reason.COMPLETED, null, toolCalls);
                model.appendExchange(messages, reply, List.of());
                model.appendUser(messages, steeringText(steering));
                continue;
            }
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
            if (!steering.isEmpty()) model.appendUser(messages, steeringText(steering));
        }
    }

    private boolean canContinue(List<Map<String, Object>> messages) {
        return !hooks.stopRequested() && budget.blockReason(model.estimateInputTokens(messages) + 200, MIN_OUTPUT_TOKENS) == null;
    }

    private Outcome outcome(Reason reason, String limit, int toolCalls) { return new Outcome(reason, limit, budget.modelCalls(), toolCalls); }

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
     * Shared per-turn budget: model calls (loop calls plus any tool-internal model call), wall time and the token ceiling
     * the user approved (the endpoint rate's maxInputTokens / maxOutputTokens, summed over every call of the turn).
     */
    public static final class TurnBudget {
        private final int maxModelCalls;
        private final long maxInputTokens, maxOutputTokens;
        private final int desiredOutputTokens;
        private final Instant deadline;
        private final Clock clock;
        private int modelCalls;
        private long inputTokens, outputTokens;

        public TurnBudget(int maxModelCalls, long maxInputTokens, long maxOutputTokens, int desiredOutputTokens, Duration maxDuration, Clock clock) {
            this.maxModelCalls = maxModelCalls; this.maxInputTokens = maxInputTokens; this.maxOutputTokens = maxOutputTokens;
            this.desiredOutputTokens = desiredOutputTokens; this.clock = clock; this.deadline = clock.instant().plus(maxDuration);
        }

        /** Unlimited token budget (fixture mode: no vendor, zero cost); call and time limits still apply. */
        public static TurnBudget unmetered(int desiredOutputTokens, Clock clock) {
            return new TurnBudget(MAX_MODEL_CALLS, Long.MAX_VALUE / 4, Long.MAX_VALUE / 4, desiredOutputTokens, MAX_DURATION, clock);
        }

        /** Null when another model call fits; otherwise calls | time | tokens. */
        public synchronized String blockReason(long estimatedInput, int minOutput) {
            if (modelCalls >= maxModelCalls) return "calls";
            if (!clock.instant().isBefore(deadline)) return "time";
            if (inputTokens + Math.max(0, estimatedInput) > maxInputTokens || outputTokens + minOutput > maxOutputTokens) return "tokens";
            return null;
        }
        public synchronized void beginCall() { modelCalls++; }
        public synchronized int outputAllowance() { return (int) Math.max(0, Math.min(desiredOutputTokens, maxOutputTokens - outputTokens)); }
        public synchronized int outputAllowance(int desired) { return (int) Math.max(0, Math.min(desired, maxOutputTokens - outputTokens)); }
        public synchronized void record(long input, long output) { inputTokens = Math.addExact(inputTokens, input); outputTokens = Math.addExact(outputTokens, output); }
        public synchronized int modelCalls() { return modelCalls; }
        public synchronized long inputTokens() { return inputTokens; }
        public synchronized long outputTokens() { return outputTokens; }
        public Duration remainingTime() { var left = Duration.between(clock.instant(), deadline); return left.isNegative() ? Duration.ZERO : left; }
        public Instant deadline() { return deadline; }
    }
}
