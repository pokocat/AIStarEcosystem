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
 * The agent loop of one dialogue turn: model → typed actions → validate and run tools → feed results back → continue
 * (docs/ip-studio-conversational-video-recreation-plan.md §一轮为有界agent循环; docs/ip-studio-dialogue-no-continue.md).
 *
 * <p>Pure state machine: no Spring, no repositories. The model, tools and side channels are injected so the ordering,
 * stop priority, steering and repeat rules are unit-testable. It ends when the model returns no actions (and no steering
 * is pending), when a tool needs a user decision, when the user stops, when the payer cannot fund the next model call
 * (limit {@code budget}: an added hold was refused, the wallet is empty), when the model repeats one action batch again
 * after a correction ({@code loop}), when action formats stay unparseable ({@code protocol}), or at the hidden safety
 * net of the turn ({@code safeguard}: {@link #MAX_TURN_MODEL_CALLS} calls or {@link #MAX_TURN_DURATION}). Actions from a
 * reply are only executed after that reply finished and parsed completely.
 *
 * <p>2026-10-23: the per-turn step / call / tool / time / token-split stops are gone (users kept having to type 「继续」).
 * One user message is one run and one reply from start to end; the dialogue has no budget of its own, its run only
 * adds holds while it works. Every model call sees a trimmed context ({@link DialogueContextWindow}): the full exchange
 * keeps growing, the window the model sees does not.
 */
public final class DialogueLoop {
    /** Hidden safety net of one turn (every model call, also tool-internal). Normal use never reaches it. */
    public static final int MAX_TURN_MODEL_CALLS = 300;
    public static final Duration MAX_TURN_DURATION = Duration.ofHours(2);
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

    /**
     * Outcome of one tool run: content goes back to the model; {@code end} set when the turn must stop afterwards. A tool
     * whose own model call cannot be paid (the payer is out of credits) or hits the safety net ends with {@link Reason#LIMIT}.
     */
    public record ToolOutcome(String content, Reason end) {
        public static ToolOutcome of(String content) { return new ToolOutcome(content, null); }
    }

    public record ToolResult(Action action, String content) {}

    /**
     * {@code limit} is set for {@link Reason#LIMIT}: budget | safeguard | loop | protocol.
     * {@code modelCalls} counts every model call of this task (steps plus tool-internal calls); {@code steps} the loop's own.
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

    public DialogueLoop(Model model, Tools tools, Hooks hooks, TurnBudget budget) {
        this.model = model; this.tools = tools; this.hooks = hooks; this.budget = budget;
    }

    /** Consecutive replies whose actions could not be parsed before the turn stops instead of paying for another try. */
    static final int MAX_PROTOCOL_RETRIES = 2;
    /** Corrections a turn gets for replies that announce work and stop (see {@link #announcesWork}); never two in a row. */
    static final int MAX_ANNOUNCE_CORRECTIONS = 2;

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

    /** The context the next model call sees: the whole exchange with older tool results reduced to one line each. */
    private List<Map<String, Object>> window(List<Map<String, Object>> messages) {
        return DialogueContextWindow.trim(messages, model::estimateInputTokens);
    }

    private Outcome loop(List<Map<String, Object>> messages) throws Exception {
        int toolCalls = 0, protocolErrors = 0;
        // The previous step's action batch, normalized; cleared when user steering is added (new information).
        String lastBatch = null;
        // The current repeat already got its correction: the next identical batch ends the turn.
        boolean repeatCorrected = false;
        // 「好的，我来调整第二镜。」 with no action: corrected at most MAX_ANNOUNCE_CORRECTIONS times a turn, and a reply
        // right after such a correction that still does nothing ends the turn (no loop of promises).
        int announceCorrections = 0;
        boolean announceCorrected = false;
        while (true) {
            if (hooks.stopRequested()) return outcome(Reason.INTERRUPTED, null, toolCalls);
            List<Map<String, Object>> view = window(messages);
            String limit = budget.stepBlockReason(model.estimateInputTokens(view), MIN_OUTPUT_TOKENS);
            if (limit != null) return outcome(Reason.LIMIT, limit, toolCalls);
            budget.beginStep();
            Reply reply = model.call(view, budget.steps(), budget.outputAllowance());
            hooks.heartbeat();
            // A stop that arrived while the model was answering wins over the reply's actions.
            if (hooks.stopRequested()) return outcome(Reason.INTERRUPTED, null, toolCalls);
            if (reply.parseError() != null) {
                // Nothing in a malformed batch runs. Two corrections are enough; a third paid call that repeats the same
                // wrong spelling only spends the user's money.
                if (++protocolErrors > MAX_PROTOCOL_RETRIES) return outcome(Reason.LIMIT, "protocol", toolCalls);
                model.appendExchange(messages, reply, List.of());
                model.appendUser(messages, correctionText(reply.parseError()));
                continue;
            }
            protocolErrors = 0;
            if (reply.actions().isEmpty()) {
                List<String> steering = canContinue(messages) ? hooks.drainSteering() : List.of();
                if (steering.isEmpty()) {
                    if (!announceCorrected && announceCorrections < MAX_ANNOUNCE_CORRECTIONS
                            && announcesWork(reply.visibleText()) && canContinue(messages)) {
                        announceCorrections++; announceCorrected = true;
                        model.appendExchange(messages, reply, List.of());
                        model.appendUser(messages, ANNOUNCE_CORRECTION);
                        continue;
                    }
                    return outcome(Reason.COMPLETED, null, toolCalls);
                }
                model.appendExchange(messages, reply, List.of());
                model.appendUser(messages, steeringText(steering));
                lastBatch = null; repeatCorrected = false;
                continue;
            }
            // The same batch as the previous step, with no user message in between: the model is going round in circles
            // (also for read-only tools: another identical look at the canvas tells it nothing new). A reply rejected for
            // its format in between does not count as a different step. Nothing of the repeated batch runs. The first
            // repeat gets one correction and the turn goes on; the same batch again after it ends the turn.
            String batch = batchSignature(reply.actions());
            if (batch.equals(lastBatch)) {
                if (repeatCorrected) return outcome(Reason.LIMIT, "loop", toolCalls);
                repeatCorrected = true;
                boolean readsOnly = reply.actions().stream().allMatch(a -> "read_canvas".equals(a.tool()));
                model.appendExchange(messages, reply, reply.actions().stream()
                        .map(a -> new ToolResult(a, readsOnly ? READ_REPEATED : ACTION_REPEATED)).toList());
                model.appendUser(messages, readsOnly ? READ_REPEAT_CORRECTION : REPEAT_CORRECTION);
                continue;
            }
            lastBatch = batch; repeatCorrected = false; announceCorrected = false;
            List<ToolResult> results = new ArrayList<>();
            Reason end = null;
            boolean interrupted = false;
            for (Action action : reply.actions()) {
                if (interrupted || hooks.stopRequested()) {
                    interrupted = true;
                    results.add(new ToolResult(action, "{\"ok\":false,\"summary\":\"用户已停止，本动作未执行\"}"));
                    continue;
                }
                if (end != null) {
                    results.add(new ToolResult(action, end == Reason.LIMIT ? "{\"ok\":false,\"summary\":\"积分不够了，本动作未执行\"}"
                            : "{\"ok\":false,\"summary\":\"需要先等用户回复，本动作未执行\"}"));
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
            // A tool's own model call could not be paid (out of credits) or hit the safety net: the turn stops here and the
            // worker writes the note.
            if (end == Reason.LIMIT) return outcome(Reason.LIMIT, budget.lastBlock() == null ? "budget" : budget.lastBlock(), toolCalls);
            if (end != null) return outcome(end, null, toolCalls);
            // Steering is only taken (and marked applied) when another model call can actually answer it in this task;
            // otherwise it stays queued and opens the next turn.
            List<String> steering = canContinue(messages) ? hooks.drainSteering() : List.of();
            if (!steering.isEmpty()) { model.appendUser(messages, steeringText(steering)); lastBatch = null; repeatCorrected = false; }
        }
    }

    private boolean canContinue(List<Map<String, Object>> messages) {
        return !hooks.stopRequested() && budget.stepBlockReason(model.estimateInputTokens(window(messages)) + 200, MIN_OUTPUT_TOKENS) == null;
    }

    private Outcome outcome(Reason reason, String limit, int toolCalls) {
        return new Outcome(reason, limit, budget.modelCalls(), budget.steps(), toolCalls);
    }

    static final String ACTION_REPEATED = "{\"ok\":false,\"code\":\"REPEATED_ACTION\",\"summary\":\"和上一步完全相同，未重复执行\"}";
    static final String READ_REPEATED = "{\"ok\":false,\"code\":\"READ_ALREADY_RETURNED\",\"summary\":\"这一段已经读过，未重复执行\"}";
    /** The one correction a repeated batch gets before a second repeat ends the turn (docs/ip-studio-dialogue-no-continue.md §2). */
    static final String REPEAT_CORRECTION = "你刚才重复了同一个动作，换个做法，或者直接告诉用户结果。";
    static final String READ_REPEAT_CORRECTION = "你刚才重复读取了同一段内容。长文请用上次返回的 nextOffset 作为 offset 读下一段；"
            + "hasMore=false 表示已经读完，就用已有内容接着做，或者直接告诉用户结果。";

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

    /**
     * The correction after a reply that says it is about to do something and stops there (WIP review 2026-10-23, 2026-10-30):
     * the sentence was only the opening of the work, so the work follows in this turn instead of the user typing 「改啊」.
     */
    static final String ANNOUNCE_CORRECTION = "你刚才说要去做，但没有调用任何工具，这一轮什么都没有改。现在就调用工具把它做完，正文不必重复刚才那句话。"
            + "如果其实是在等制作完成或等用户确认，就直接说清楚在等什么，不要调用工具。";
    private static final java.util.regex.Pattern ANNOUNCE = java.util.regex.Pattern.compile(
            "我来|我这就|这就去|这就为你|马上|立刻|立即|现在就|接下来我|下面我|我先去|我先来|我将|我会为你|稍等|请稍候|正在为你|开始为你");
    /** Waiting is an honest answer: for a job, a confirmation or the user (「第二段生成好了我再告诉你」「你确认后我就开始」). */
    private static final java.util.regex.Pattern WAITING = java.util.regex.Pattern.compile(
            "等.{0,12}(?:好了|完成|出来|确认|生成|结束)|完成后|好了之后|生成好|出来后|确认后|你确认|你点|你选");
    /** How much of the end of a reply is read: an analysis that opened with 「我来帮你分析」 is an answer, not a promise. */
    private static final int ANNOUNCE_TAIL = 40;

    /** True when the end of a reply with no action announces work it did not do (and is neither a question nor a wait). */
    static boolean announcesWork(String text) {
        if (text == null) return false;
        String said = text.strip();
        if (said.isEmpty() || said.endsWith("？") || said.endsWith("?")) return false;
        String tail = said.length() <= ANNOUNCE_TAIL ? said : said.substring(said.length() - ANNOUNCE_TAIL);
        return ANNOUNCE.matcher(tail).find() && !WAITING.matcher(tail).find();
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

    /** Adds credits to a turn's holds; returns how much was added (0 = refused or the turn is stopping). */
    @FunctionalInterface
    public interface HoldTopUp { long extend(long need); }

    /**
     * Shared per-turn budget. A metered turn pays every model call (loop steps, tool-internal calls, the history summary)
     * from the credits frozen for its run. When the next call would not fit what is held, it first asks {@link HoldTopUp}
     * for at least the missing amount (another hold on the same run, docs/ip-studio-dialogue-no-continue.md §3); only
     * when that is refused (the wallet is empty, the payment was revoked) is the call refused with {@code budget}. The
     * rate's input / output token split is not a limit. Every turn also has the hidden safety net
     * ({@link #MAX_TURN_MODEL_CALLS}, {@link #MAX_TURN_DURATION}).
     *
     * <p>Every model call goes through exactly one of {@link #beginStep()} (the loop) or {@link #beginSubCall()} (anything
     * else); both count toward {@link #modelCalls()}, only steps toward {@link #steps()}.
     */
    public static final class TurnBudget {
        private final com.aistareco.aep.service.AiChatTokenPricing.Rate rate;
        private final HoldTopUp topUp;
        private final int desiredOutputTokens;
        private final Clock clock;
        private final Instant deadline;
        private long held;
        private long pendingInput;
        private int steps, modelCalls;
        private long inputTokens, outputTokens;
        private String lastBlock;

        private TurnBudget(com.aistareco.aep.service.AiChatTokenPricing.Rate rate, long held, int desiredOutputTokens, Clock clock, Instant startedAt, HoldTopUp topUp) {
            this.rate = rate; this.held = Math.max(0, held); this.desiredOutputTokens = desiredOutputTokens; this.clock = clock; this.topUp = topUp;
            this.deadline = (startedAt == null ? clock.instant() : startedAt).plus(MAX_TURN_DURATION);
        }

        /** Metered with a fixed hold of {@code rate.maxCost()} and nothing added (tests, and the plain shape). */
        public static TurnBudget metered(com.aistareco.aep.service.AiChatTokenPricing.Rate rate, int perCall, Clock clock) {
            return new TurnBudget(java.util.Objects.requireNonNull(rate), rate.maxCost(), perCall, clock, null, null);
        }

        /** Metered: {@code held} credits frozen so far; {@code topUp} adds holds to the same run when a call needs more. */
        public static TurnBudget metered(com.aistareco.aep.service.AiChatTokenPricing.Rate rate, long held, int perCall, Clock clock, Instant startedAt, HoldTopUp topUp) {
            return new TurnBudget(java.util.Objects.requireNonNull(rate), held, perCall, clock, startedAt, topUp);
        }

        /** No token budget (fixture mode: no vendor, zero cost); the safety net still applies. */
        public static TurnBudget unmetered(int desiredOutputTokens, Clock clock) { return new TurnBudget(null, 0, desiredOutputTokens, clock, null, null); }

        public static TurnBudget unmetered(int desiredOutputTokens, Clock clock, Instant startedAt) {
            return new TurnBudget(null, 0, desiredOutputTokens, clock, startedAt, null);
        }

        public boolean metered() { return rate != null; }

        /** Null when another dialogue step fits; otherwise budget | safeguard (the same rule as {@link #blockReason}). */
        public String stepBlockReason(long estimatedInput, int minOutput) { return blockReason(estimatedInput, minOutput); }

        /**
         * Null when another model call fits, adding a hold first when what is held does not cover it; otherwise
         * {@code safeguard} (the hidden net) or {@code budget} (the added hold was refused).
         */
        public String blockReason(long estimatedInput, int minOutput) {
            long missing;
            synchronized (this) {
                if (modelCalls >= MAX_TURN_MODEL_CALLS || !clock.instant().isBefore(deadline)) return block("safeguard");
                if (rate == null) return null;
                pendingInput = Math.max(0, estimatedInput);
                missing = rate.cost(inputTokens + pendingInput, outputTokens + minOutput) - held;
                if (missing <= 0) return null;
                if (topUp == null) return block("budget");
            }
            long added = Math.max(0, topUp.extend(missing)); // a database transaction: never inside this monitor
            synchronized (this) {
                held += added;
                return rate.cost(inputTokens + pendingInput, outputTokens + minOutput) > held ? block("budget") : null;
            }
        }

        private String block(String reason) { lastBlock = reason; return reason; }
        /** The loop calls its model: one dialogue step, and one model call. */
        public synchronized void beginStep() { steps++; modelCalls++; }
        /** A model call that is not a dialogue step (view_images' look, propose_plan's planner, the history summary). */
        public synchronized void beginSubCall() { modelCalls++; }
        public synchronized int outputAllowance() { return outputAllowance(desiredOutputTokens); }
        /** Output tokens the next call may use within what is held (after {@link #blockReason} topped it up). */
        public synchronized int outputAllowance(int desired) {
            if (rate != null && rate.outputCreditsPerK().signum() > 0) {
                var remaining = java.math.BigDecimal.valueOf(held).multiply(java.math.BigDecimal.valueOf(1000))
                        .subtract(rate.inputCreditsPerK().multiply(java.math.BigDecimal.valueOf(inputTokens + pendingInput)))
                        .subtract(rate.outputCreditsPerK().multiply(java.math.BigDecimal.valueOf(outputTokens)));
                return remaining.signum() <= 0 ? 0 : remaining.divide(rate.outputCreditsPerK(), 0, java.math.RoundingMode.DOWN)
                        .min(java.math.BigDecimal.valueOf(desired)).intValueExact();
            }
            return Math.max(0, desired);
        }
        public synchronized void record(long input, long output) {
            inputTokens = Math.addExact(inputTokens, input); outputTokens = Math.addExact(outputTokens, output); pendingInput = 0;
        }
        public synchronized int steps() { return steps; }
        public synchronized int modelCalls() { return modelCalls; }
        public synchronized long inputTokens() { return inputTokens; }
        public synchronized long outputTokens() { return outputTokens; }
        /** Credits frozen for the turn so far (all its holds). */
        public synchronized long held() { return held; }
        /** The last reason a call was refused (budget | safeguard), or null. */
        public synchronized String lastBlock() { return lastBlock; }
    }
}
