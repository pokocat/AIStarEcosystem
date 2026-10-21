package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.service.AiModelInvocationService.ChatToolCall;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The two action paths of the dialogue model, normalized to one {@link DialogueLoop.Action} list:
 * native function calling (endpoint declares {@code chatSupportsTools}) and the JSON action fallback
 * (prose, then a line {@value #MARKER}, then a JSON array of {@code {tool,args}}). The action part is never shown to
 * the user and an action block that did not parse completely is never executed.
 *
 * <p>Besides the marker, models write the same fallback inside a tag. Every spelling below has been seen from a real
 * endpoint and is accepted as the same thing: {@code <tool_call>{..}</tool_call>} (one action per tag) and
 * {@code <studio-actions>[..]</studio-actions>} (the array, 2026-10-20 IPT-2f13c2ed42994624907d seq 10: the plan the user
 * then asked to start was never proposed, because this spelling was shown as prose and nothing ran). A tag body may be one
 * object or an array; prose before, between and after tags stays visible. Anything not complete (unclosed tag, invalid
 * JSON, missing tool) rejects the whole batch: nothing half-executes, and the model is asked to send it again.
 *
 * <p>A tool call written as plain prose instead ({@link ProseCallFilter}: 「[调用工具 view_images]」) is never shown and is
 * a format error too, so the model is asked again instead of the turn ending with nothing done.
 *
 * <p>After the marker, the action value may be followed by a closing line that ends the reply (the marker written a
 * second time, 2026-10-21 14:10; see {@link #stripClosing}). Nothing after the marker is ever shown, so streaming needs
 * no extra rule for it.
 */
public final class DialogueActionProtocol {
    public static final String MARKER = "<<<studio-actions>>>";
    /** Many chat models, when told to "write actions as JSON", emit this tag form instead; it is accepted as the same fallback. */
    public static final String TAG_OPEN = "<tool_call>";
    /** Tag names accepted as an action envelope (lower case, compared case-insensitively). */
    static final List<String> TAGS = List.of("tool_call", "studio-actions", "studio_actions");
    /**
     * A line that imitates the server's own work record ({@link DialogueHistory#line}) instead of calling the tool: the
     * model wrote 「[查看画布：done，已读取 3 个对象] [提问：……]」 as prose (same thread, seq 12) and no tool ran. The user then
     * reads a record of work that never happened. Treated like an unparsable action so the model calls the tool for real.
     */
    private static final Pattern IMITATED_RECORD = Pattern.compile(
            "\\[(?:查看画布|看图|读取制作方法|整理制作方案|请你确认|搭建画布|调整画布对象|提交生成|提问|方案第\\s*\\d+\\s*版|确认卡)[：:][^\\]]{0,400}\\]"
                    + "|\\[[^\\[\\]：:]{1,16}[：:]\\s*(?:done|failed|running|waiting_user)\\b");
    /**
     * Strict: a block with anything after its JSON value ({@code [..] [..}) is not a complete action batch. The one
     * exception is a closing line that ends the reply ({@link #stripClosing}), removed before this parse.
     */
    private static final ObjectMapper OM = new ObjectMapper().enable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    static final int MAX_ACTIONS_PER_REPLY = 8;

    private DialogueActionProtocol() {}

    public record Parsed(String visibleText, List<DialogueLoop.Action> actions, String parseError) {}

    /**
     * Split a complete reply into visible prose and fallback actions. One left-to-right scan, the same one the streaming
     * {@link MarkerFilter} does: prose up to the next envelope opening is visible; a tag envelope must close with its own
     * tag and contain no other opening (otherwise the outer one never closed); the marker takes the rest of the reply.
     * Any defect rejects the whole batch.
     */
    public static Parsed parse(String text) { return parse(text, Set.of()); }

    /** {@link #parse(String)} that also recognizes a tool call written as prose, by these registered tool names. */
    public static Parsed parse(String text, Collection<String> toolNames) {
        String full = text == null ? "" : text;
        StringBuilder visible = new StringBuilder();
        List<DialogueLoop.Action> actions = new ArrayList<>();
        String error = null;
        int pos = 0;
        while (true) {
            int[] open = nextOpening(full, pos);
            if (open == null) { visible.append(full, pos, full.length()); break; }
            visible.append(full, pos, open[0]);
            if (open[1] < 0) { // the marker: everything after it is the action array
                String block = stripFence(stripClosing(full.substring(open[0] + MARKER.length()).strip()));
                if (block.isEmpty()) break;
                JsonNode array;
                try { array = OM.readTree(block); } catch (Exception e) { array = null; }
                // One action written as a bare object after the marker (real agnes-2.5-flash reply 2026-10-20:
                // 「…<<<studio-actions>>>{"tool":"read_canvas","args":{}}」) is that one action, as in the tag form.
                boolean single = array != null && array.isObject() && (array.hasNonNull("tool") || array.hasNonNull("name"));
                if (array == null || !(array.isArray() || single)) { error = error != null ? error : "不是有效的 JSON 数组"; break; }
                String e = collect(array, actions, actions.size());
                if (error == null) error = e;
                break;
            }
            String tag = TAGS.get(open[1]);
            int bodyStart = open[0] + tag.length() + 2;
            int end = indexIgnoreCase(full, "</" + tag + ">", bodyStart);
            if (end < 0) { if (error == null) error = "动作没有写完整"; break; } // never shown, never run
            String body = full.substring(bodyStart, end);
            pos = end + tag.length() + 3;
            if (error != null) continue;
            if (nextOpening(body, 0) != null) { error = "动作没有写完整"; continue; } // an outer envelope that never closed
            JsonNode item;
            try { item = OM.readTree(stripFence(body.strip())); } catch (Exception e) { error = "第 " + (actions.size() + 1) + " 个动作不是有效 JSON"; continue; }
            if (item == null || !(item.isObject() || item.isArray())) { error = "第 " + (actions.size() + 1) + " 个动作必须是对象或数组"; continue; }
            error = collect(item, actions, actions.size());
        }
        String shown = visible.toString().strip();
        if (error == null && actions.isEmpty() && nextOpening(full, 0) == null) {
            Parsed bare = bareActions(shown);
            if (bare != null) return bare;
        }
        // The same second stage the streaming filter runs, over the same prose, so what was shown equals what is kept.
        ProseCallFilter prose = new ProseCallFilter(toolNames);
        String kept = (prose.accept(visible.toString()) + prose.finish()).strip();
        if (error == null && actions.size() > MAX_ACTIONS_PER_REPLY) error = "一次最多 " + MAX_ACTIONS_PER_REPLY + " 个动作";
        if (error != null) return new Parsed(kept, List.of(), error);
        if (actions.isEmpty() && !prose.calls().isEmpty())
            return new Parsed(kept, List.of(), "正文里写了「" + excerpt(prose.calls().get(0), 40) + "」，这只是文字，工具没有运行；要调用工具必须按动作格式发出");
        if (actions.isEmpty() && (prose.records() || IMITATED_RECORD.matcher(shown).find()))
            return new Parsed(kept, List.of(), "正文里写了工具记录的样子，但没有真正调用工具；要做事就按动作格式调用，不要在正文里模仿记录");
        return new Parsed(kept, List.copyOf(actions), null);
    }

    private static String excerpt(String text, int max) { return text.length() <= max ? text : text.substring(0, max) + "…"; }

    /**
     * {start, tagIndex} of the earliest envelope opening at or after {@code from}, tagIndex -1 for the marker; null when
     * none. A tag spelling preceded by 「<<」 is the start of the marker (complete or not) and is skipped, and the search
     * goes on past it: the marker contains the tag spelling.
     */
    static int[] nextOpening(CharSequence text, int from) {
        String lower = text.toString().toLowerCase(java.util.Locale.ROOT);
        int marker = lower.indexOf(MARKER, from);
        int best = marker, which = marker < 0 ? -2 : -1;
        for (int t = 0; t < TAGS.size(); t++) {
            String opening = "<" + TAGS.get(t) + ">";
            for (int at = lower.indexOf(opening, from); at >= 0; at = lower.indexOf(opening, at + 1)) {
                if (at >= 2 && lower.charAt(at - 1) == '<' && lower.charAt(at - 2) == '<') continue;
                if (best < 0 || at < best) { best = at; which = t; }
                break;
            }
        }
        return best < 0 ? null : new int[] {best, which};
    }

    static int indexIgnoreCase(CharSequence text, String needle, int from) {
        return text.toString().toLowerCase(java.util.Locale.ROOT).indexOf(needle.toLowerCase(java.util.Locale.ROOT), from);
    }

    /** One object or an array of them → actions (numbered from {@code offset + 1}); the first bad item rejects the batch. */
    private static String collect(JsonNode node, List<DialogueLoop.Action> out, int offset) {
        List<JsonNode> items = new ArrayList<>();
        if (node.isArray()) node.forEach(items::add); else items.add(node);
        int i = offset;
        for (JsonNode item : items) {
            i++;
            if (!item.isObject()) return "第 " + i + " 个动作必须是对象";
            JsonNode name = item.hasNonNull("tool") ? item.get("tool") : item.get("name");
            if (name == null || !name.isTextual() || name.asText().isBlank()) return "第 " + i + " 个动作缺少 tool";
            JsonNode args = item.hasNonNull("args") ? item.get("args") : item.hasNonNull("arguments") ? item.get("arguments") : siblingArgs(item);
            if (args != null && args.isTextual()) {
                try { args = OM.readTree(args.asText()); } catch (Exception e) { return "第 " + i + " 个动作的 args 必须是对象"; }
            }
            if (args != null && !args.isNull() && !args.isMissingNode() && !args.isObject()) return "第 " + i + " 个动作的 args 必须是对象";
            out.add(new DialogueLoop.Action("act-" + i, name.asText().strip(), args != null && args.isObject() ? args : OM.createObjectNode()));
        }
        return null;
    }

    /**
     * A reply that is nothing but an action — {@code {"tool":..,"args":{..}}} or an array of them, optionally fenced —
     * with no envelope at all (the correction reply after a rejected batch, real model 2026-10-20). Without this the raw
     * JSON was shown to the user as the answer and the turn ended. Only a reply that is entirely such JSON counts; prose
     * that merely contains braces stays prose. Returns null when the reply is not such JSON.
     */
    private static Parsed bareActions(String shown) {
        String text = stripFence(shown);
        if (!(text.startsWith("{") || text.startsWith("["))) return null;
        JsonNode node;
        try { node = OM.readTree(text); } catch (Exception e) { return null; }
        if (node == null || !(node.isObject() || node.isArray()) || node.isEmpty()) return null;
        for (JsonNode item : node.isArray() ? node : OM.createArrayNode().add(node))
            if (!item.isObject() || !(item.path("tool").isTextual() || item.path("name").isTextual())) return null;
        List<DialogueLoop.Action> actions = new ArrayList<>();
        String error = collect(node, actions, 0);
        if (error == null && actions.size() > MAX_ACTIONS_PER_REPLY) error = "一次最多 " + MAX_ACTIONS_PER_REPLY + " 个动作";
        return error != null ? new Parsed("", List.of(), error) : new Parsed("", List.copyOf(actions), null);
    }

    /**
     * Arguments written next to {@code tool} instead of inside {@code args}
     * ({@code {"tool":"ask_question","text":"…","options":[…]}}, real reply 2026-10-20): those sibling fields. The tool
     * still validates every argument; this only stops a correctly named action from running with nothing. Null when none.
     */
    private static JsonNode siblingArgs(JsonNode item) {
        var rest = OM.createObjectNode();
        String nameKey = item.hasNonNull("tool") ? "tool" : "name";
        item.fields().forEachRemaining(f -> { if (!nameKey.equals(f.getKey())) rest.set(f.getKey(), f.getValue()); });
        return rest.isEmpty() ? null : rest;
    }

    /** Native tool calls → actions. Arguments that are not a JSON object reject the whole batch (nothing half-executes). */
    public static Parsed fromNative(String visibleText, List<ChatToolCall> calls) {
        List<DialogueLoop.Action> actions = new ArrayList<>();
        if (calls.size() > MAX_ACTIONS_PER_REPLY) return new Parsed(visibleText, List.of(), "一次最多 " + MAX_ACTIONS_PER_REPLY + " 个动作");
        int i = 0;
        for (ChatToolCall call : calls) {
            i++;
            JsonNode args;
            try { args = call.arguments() == null || call.arguments().isBlank() ? OM.createObjectNode() : OM.readTree(call.arguments()); }
            catch (Exception e) { return new Parsed(visibleText, List.of(), "第 " + i + " 个工具参数不是有效 JSON"); }
            if (!args.isObject()) return new Parsed(visibleText, List.of(), "第 " + i + " 个工具参数必须是对象");
            String id = call.id() == null || call.id().isBlank() ? "call-" + i : call.id();
            actions.add(new DialogueLoop.Action(id, call.name(), args));
        }
        return new Parsed(visibleText, List.copyOf(actions), null);
    }

    /**
     * A closing line the model wrote after the action value, which then ends the reply. Production 2026-10-21 14:10 (聚算
     * Qwen3.8 27B): 「…\n<<<studio-actions>>>\n[{"tool":"view_images",…}]\n<<<studio-actions>>>」 three times in a row, the
     * action itself correct, and the strict parser rejected each try for what came after the array. Accepted closers, case
     * insensitive: the marker again, {@code <<</studio-actions>>>}, {@code <<<end>>>}, {@code <<<end-studio-actions>>>}
     * (also with {@code _}), {@code </studio-actions>}, and a closing code fence.
     */
    private static final Pattern TRAILING_CLOSER = Pattern.compile(
            "(?i)\\s*(?:<<<\\s*/?\\s*(?:studio[-_]actions|end(?:[-_]studio[-_]actions)?)\\s*>>>|</\\s*studio[-_]actions\\s*>|```)\\s*\\z");

    /**
     * The action block without the closer(s) at its very end: at most two (a marker-like line and a fence, in either
     * order). Only the end of the reply is touched, so anything else after the JSON value (prose, a second array, a closer
     * followed by more text) is still there and still rejects the batch.
     */
    static String stripClosing(String block) {
        String b = block;
        for (int i = 0; i < 2; i++) {
            Matcher m = TRAILING_CLOSER.matcher(b);
            if (!m.find()) break;
            b = b.substring(0, m.start()).strip();
        }
        return b;
    }

    private static String stripFence(String block) {
        String b = block;
        if (b.startsWith("```")) {
            int nl = b.indexOf('\n');
            b = nl < 0 ? "" : b.substring(nl + 1);
            int end = b.lastIndexOf("```");
            if (end >= 0) b = b.substring(0, end);
        }
        return b.strip();
    }

    /**
     * Streaming filter: forwards real deltas as they arrive and withholds only what could be the beginning of an action
     * envelope. After the marker everything is action text and is never forwarded; inside a tag envelope text is withheld
     * until its closing tag, and prose after the closing tag streams again (the stored reply then matches {@link #parse}).
     */
    public static final class MarkerFilter {
        private final StringBuilder pending = new StringBuilder();
        private boolean markerSeen, envelopeSeen;
        /** Lower-case closing tag being waited for, or null outside a tag envelope. */
        private String closing;
        /** Second stage over the prose this stage lets through: hides a tool call written as text. */
        private final ProseCallFilter prose;

        public MarkerFilter() { this(Set.of()); }

        public MarkerFilter(Collection<String> toolNames) { this.prose = new ProseCallFilter(toolNames); }

        /** @return the part of {@code delta} that is certainly prose and can be shown now (possibly empty). */
        public String accept(String delta) { return prose.accept(envelopes(delta)); }

        private String envelopes(String delta) {
            if (markerSeen || delta == null || delta.isEmpty()) return "";
            pending.append(delta);
            StringBuilder out = new StringBuilder();
            while (true) {
                if (markerSeen) { pending.setLength(0); break; }
                if (closing != null) {
                    int end = indexIgnoreCase(pending, closing);
                    if (end < 0) {
                        // keep only what could still be the closing tag; the envelope body is never shown
                        int keep = Math.min(pending.length(), closing.length() - 1);
                        pending.delete(0, pending.length() - keep);
                        break;
                    }
                    pending.delete(0, end + closing.length());
                    closing = null;
                    continue;
                }
                int[] open = firstOpening(pending);
                if (open != null) {
                    out.append(pending, 0, open[0]);
                    envelopeSeen = true;
                    if (open[1] < 0) markerSeen = true;
                    else closing = "</" + TAGS.get(open[1]) + ">";
                    pending.delete(0, open[0] + (open[1] < 0 ? MARKER.length() : TAGS.get(open[1]).length() + 2));
                    continue;
                }
                int keep = longestOpeningPrefixSuffix(pending);
                out.append(pending, 0, pending.length() - keep);
                pending.delete(0, pending.length() - keep);
                break;
            }
            return out.toString();
        }

        /** End of stream: a withheld tail that never became an envelope is prose; an unclosed envelope is dropped. */
        public String finish() {
            String rest = markerSeen || closing != null ? "" : pending.toString();
            pending.setLength(0);
            return prose.accept(rest) + prose.finish();
        }

        /** True once any action envelope (the marker or a tag) has started in this reply. */
        public boolean markerSeen() { return envelopeSeen; }

        private static int[] firstOpening(CharSequence text) { return nextOpening(text, 0); }

        private static int longestOpeningPrefixSuffix(CharSequence text) {
            int keep = 0;
            List<String> openings = new ArrayList<>();
            openings.add(MARKER);
            for (String t : TAGS) openings.add("<" + t + ">");
            for (String marker : openings) {
                int max = Math.min(text.length(), marker.length() - 1);
                for (int len = max; len > keep; len--) {
                    boolean match = true;
                    for (int i = 0; i < len; i++)
                        if (Character.toLowerCase(text.charAt(text.length() - len + i)) != Character.toLowerCase(marker.charAt(i))) { match = false; break; }
                    if (match) { keep = len; break; }
                }
            }
            return keep;
        }

        private static int indexIgnoreCase(CharSequence text, String needle) { return DialogueActionProtocol.indexIgnoreCase(text, needle, 0); }
    }

    /**
     * A tool call written as prose instead of being sent as an action. Production 2026-10-21 13:50 (聚算 Qwen3.8 27B, JSON
     * action path): the whole reply was 「[调用工具 view_images]」, 7 tokens; it was shown as the answer, nothing ran, the turn
     * ended and was billed. The prompt had just stopped asking for a sentence before each call and showed no complete
     * action example, so the model made up its own spelling.
     *
     * <p>Recognized only with a registered tool name, so prose that merely talks about tools stays prose:
     * <ul>
     *   <li>anywhere, in brackets with a call word: {@code [调用工具 view_images]} {@code [调用工具：view_images]}
     *       {@code [使用工具 read_canvas]} {@code [工具 view_images]}, also with 【】 and anything after the name;</li>
     *   <li>a whole line with a call word and no brackets: {@code 调用工具 view_images};</li>
     *   <li>a whole reply that is only the name: {@code [view_images]} {@code view_images()}.</li>
     * </ul>
     * A bracketed imitation of the server's work record ({@link #IMITATED_RECORD}) is hidden the same way. Hidden text is
     * never shown, streamed or not. It is a streaming transducer whose output does not depend on how the text was cut
     * into deltas; {@link #parse} runs the same filter over the whole prose, so the stored reply equals what was shown.
     * It withholds only what may still become such a call: an open bracket until it closes (one line, at most
     * {@value #MAX_SPAN} characters), a line start while it can still be a call line, a first line that is only a name
     * until something else follows.
     */
    static final class ProseCallFilter {
        static final int MAX_SPAN = 420;
        private static final String CALL_WORD = "(?:(?:调用|使用|执行|运行)\\s*工具|调用|使用|执行|工具)";
        private final Pattern bracketCall, lineCall, replyCall;
        private final StringBuilder pending = new StringBuilder();
        private final List<String> calls = new ArrayList<>();
        private boolean records, lineStart = true, shownAny;
        /** A first line that is only a tool name: dropped when nothing else follows, shown when something does. */
        private StringBuilder heldReply;

        /** Without tool names only imitated work records are recognized. */
        ProseCallFilter(Collection<String> toolNames) {
            if (toolNames == null || toolNames.isEmpty()) { bracketCall = lineCall = replyCall = null; return; }
            String name = "`?" + toolNames.stream().map(Pattern::quote).collect(java.util.stream.Collectors.joining("|", "(?:", ")")) + "`?";
            String args = "(?:[(（][^\\n]*[)）])?";
            bracketCall = Pattern.compile("[\\[【]\\s*" + CALL_WORD + "\\s*[：:]?\\s*" + name + "(?![A-Za-z0-9_])[^\\n]*[\\]】]");
            lineCall = Pattern.compile("\\s*" + CALL_WORD + "\\s*[：:]?\\s*" + name + "\\s*" + args + "\\s*[。.]?\\s*");
            replyCall = Pattern.compile("\\s*[\\[【]?\\s*" + name + "\\s*" + args + "\\s*[\\]】]?\\s*");
        }

        /** Tool calls that were written as text and hidden, in order. */
        List<String> calls() { return calls; }

        /** True when a bracketed imitation of the work record was hidden. */
        boolean records() { return records; }

        String accept(String delta) {
            if (delta != null) pending.append(delta);
            return drain(false);
        }

        String finish() { return drain(true); }

        private String drain(boolean end) {
            StringBuilder out = new StringBuilder();
            while (pending.length() > 0 || (end && heldReply != null)) {
                if (heldReply != null) {
                    if (pending.toString().isBlank()) {
                        heldReply.append(pending);
                        pending.setLength(0);
                        if (end) { calls.add(heldReply.toString().strip()); heldReply = null; }
                        break;
                    }
                    emit(out, heldReply);
                    heldReply = null;
                    continue;
                }
                if (lineStart && lineCall == null) lineStart = false;
                if (lineStart) {
                    int nl = pending.indexOf("\n");
                    String line = nl < 0 ? pending.toString() : pending.substring(0, nl);
                    int consumed = nl < 0 ? pending.length() : nl + 1;
                    Matcher asLine = lineCall.matcher(line), asReply = shownAny ? null : replyCall.matcher(line);
                    if (nl >= 0 || end) {
                        if (asLine.matches()) { calls.add(line.strip()); pending.delete(0, consumed); continue; }
                        if (asReply != null && asReply.matches()) { heldReply = new StringBuilder(pending.substring(0, consumed)); pending.delete(0, consumed); continue; }
                    } else if (asLine.matches() || asLine.hitEnd() || (asReply != null && (asReply.matches() || asReply.hitEnd()))) {
                        break; // may still become a call line: wait for the rest of it
                    }
                    lineStart = false;
                }
                int at = nextSpecial(pending);
                if (at < 0) { emit(out, pending); pending.setLength(0); break; }
                emit(out, pending.subSequence(0, at));
                pending.delete(0, at);
                char c = pending.charAt(0);
                if (c == '\n') { emit(out, "\n"); pending.deleteCharAt(0); lineStart = true; continue; }
                int close = pending.indexOf(c == '[' ? "]" : "】", 1), nl = pending.indexOf("\n", 1);
                if (close >= 0 && (nl < 0 || close < nl) && close < MAX_SPAN) {
                    String span = pending.substring(0, close + 1);
                    pending.delete(0, close + 1);
                    if (bracketCall != null && bracketCall.matcher(span).matches()) calls.add(span);
                    else if (IMITATED_RECORD.matcher(span).lookingAt()) records = true;
                    else emit(out, span);
                    continue;
                }
                if (close < 0 && nl < 0 && pending.length() < MAX_SPAN && !end) break; // the bracket may still close
                emit(out, String.valueOf(c)); // never closes on this line: an ordinary bracket
                pending.deleteCharAt(0);
            }
            return out.toString();
        }

        private void emit(StringBuilder out, CharSequence text) {
            out.append(text);
            if (!shownAny && !text.toString().isBlank()) shownAny = true;
        }

        private static int nextSpecial(CharSequence text) {
            for (int i = 0; i < text.length(); i++) {
                char c = text.charAt(i);
                if (c == '[' || c == '【' || c == '\n') return i;
            }
            return -1;
        }
    }
}
