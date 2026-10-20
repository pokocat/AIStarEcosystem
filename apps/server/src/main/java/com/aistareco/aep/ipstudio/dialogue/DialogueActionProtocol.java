package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.service.AiModelInvocationService.ChatToolCall;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
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
 */
public final class DialogueActionProtocol {
    public static final String MARKER = "<<<studio-actions>>>";
    /** Many chat models, when told to "write actions as JSON", emit this tag form instead; it is accepted as the same fallback. */
    public static final String TAG_OPEN = "<tool_call>";
    /** Tag names accepted as an action envelope (lower case, compared case-insensitively). */
    static final List<String> TAGS = List.of("tool_call", "studio-actions", "studio_actions");
    /** {@code (?<!<<)}: the marker {@value #MARKER} contains the tag spelling and is never a tag. */
    private static final Pattern TAG_BLOCK = Pattern.compile("(?is)(?<!<<)<(tool_call|studio-actions|studio_actions)>(.*?)</\\1>");
    private static final Pattern TAG_START = Pattern.compile("(?i)(?<!<<)<(tool_call|studio-actions|studio_actions)>");
    /**
     * A line that imitates the server's own work record ({@link DialogueHistory#line}) instead of calling the tool: the
     * model wrote 「[查看画布：done，已读取 3 个对象] [提问：……]」 as prose (same thread, seq 12) and no tool ran. The user then
     * reads a record of work that never happened. Treated like an unparsable action so the model calls the tool for real.
     */
    private static final Pattern IMITATED_RECORD = Pattern.compile(
            "\\[(?:查看画布|看图|读取制作方法|整理制作方案|请你确认|搭建画布|调整画布对象|提交生成|提问|方案第\\s*\\d+\\s*版|确认卡)[：:][^\\]]{0,400}\\]"
                    + "|\\[[^\\[\\]：:]{1,16}[：:]\\s*(?:done|failed|running|waiting_user)\\b");
    private static final ObjectMapper OM = new ObjectMapper();
    static final int MAX_ACTIONS_PER_REPLY = 8;

    private DialogueActionProtocol() {}

    public record Parsed(String visibleText, List<DialogueLoop.Action> actions, String parseError) {}

    /** Split a complete reply into visible prose and fallback actions. */
    public static Parsed parse(String text) {
        String full = text == null ? "" : text;
        int at = full.indexOf(MARKER);
        Parsed parsed = at < 0 ? parseTagForm(full) : parseMarker(full, at);
        if (parsed.parseError() == null && parsed.actions().isEmpty() && IMITATED_RECORD.matcher(parsed.visibleText()).find())
            return new Parsed(parsed.visibleText(), List.of(), "正文里写了工具记录的样子，但没有真正调用工具；要做事就按动作格式调用，不要在正文里模仿记录");
        return parsed;
    }

    private static Parsed parseMarker(String full, int at) {
        String visible = full.substring(0, at).strip();
        String block = stripFence(full.substring(at + MARKER.length()).strip());
        if (block.isEmpty()) return new Parsed(visible, List.of(), null);
        JsonNode array;
        try { array = OM.readTree(block); }
        catch (Exception e) { return new Parsed(visible, List.of(), "不是有效的 JSON 数组"); }
        if (array == null || !array.isArray()) return new Parsed(visible, List.of(), "动作必须是 JSON 数组");
        if (array.size() > MAX_ACTIONS_PER_REPLY) return new Parsed(visible, List.of(), "一次最多 " + MAX_ACTIONS_PER_REPLY + " 个动作");
        List<DialogueLoop.Action> actions = new ArrayList<>();
        String error = collect(array, actions, 0);
        return error != null ? new Parsed(visible, List.of(), error) : new Parsed(visible, List.copyOf(actions), null);
    }

    /**
     * The tag spellings. Prose outside the tags stays visible; the tags themselves never do. A block that is unterminated
     * or does not parse rejects the whole batch (nothing half-executes), exactly like the marker form.
     */
    private static Parsed parseTagForm(String full) {
        if (!TAG_START.matcher(full).find()) return new Parsed(full.strip(), List.of(), null);
        Matcher m = TAG_BLOCK.matcher(full);
        StringBuilder visible = new StringBuilder();
        List<DialogueLoop.Action> actions = new ArrayList<>();
        int last = 0, blocks = 0;
        String error = null;
        while (m.find()) {
            visible.append(full, last, m.start());
            last = m.end();
            blocks++;
            if (error != null) continue;
            JsonNode item;
            try { item = OM.readTree(stripFence(m.group(2).strip())); }
            catch (Exception e) { error = "第 " + blocks + " 段动作不是有效 JSON"; continue; }
            if (item == null || !(item.isObject() || item.isArray())) { error = "第 " + blocks + " 段动作必须是对象或数组"; continue; }
            error = collect(item, actions, actions.size());
        }
        String rest = full.substring(last);
        Matcher dangling = TAG_START.matcher(rest);
        if (dangling.find()) {
            // an opened block that never closed: the text before it is prose, the block itself is never shown or run
            visible.append(rest, 0, dangling.start());
            if (error == null) error = "动作没有写完整";
        } else {
            visible.append(rest);
        }
        String shown = visible.toString().strip();
        if (actions.size() > MAX_ACTIONS_PER_REPLY) return new Parsed(shown, List.of(), "一次最多 " + MAX_ACTIONS_PER_REPLY + " 个动作");
        if (error != null) return new Parsed(shown, List.of(), error);
        return new Parsed(shown, List.copyOf(actions), null);
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
            JsonNode args = item.hasNonNull("args") ? item.get("args") : item.get("arguments");
            if (args != null && args.isTextual()) {
                try { args = OM.readTree(args.asText()); } catch (Exception e) { return "第 " + i + " 个动作的 args 必须是对象"; }
            }
            if (args != null && !args.isNull() && !args.isMissingNode() && !args.isObject()) return "第 " + i + " 个动作的 args 必须是对象";
            out.add(new DialogueLoop.Action("act-" + i, name.asText().strip(), args != null && args.isObject() ? args : OM.createObjectNode()));
        }
        return null;
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

        /** @return the part of {@code delta} that is certainly prose and can be shown now (possibly empty). */
        public String accept(String delta) {
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
            if (markerSeen || closing != null) { pending.setLength(0); return ""; }
            String rest = pending.toString();
            pending.setLength(0);
            return rest;
        }

        /** True once any action envelope (the marker or a tag) has started in this reply. */
        public boolean markerSeen() { return envelopeSeen; }

        /** {start, tagIndex} of the earliest envelope opening, tagIndex -1 for the marker; null when none. */
        private static int[] firstOpening(CharSequence text) {
            int best = text.toString().indexOf(MARKER), which = best < 0 ? -2 : -1;
            for (int t = 0; t < TAGS.size(); t++) {
                int at = indexIgnoreCase(text, "<" + TAGS.get(t) + ">");
                // inside an unfinished marker (「<<<studio-actions>」 so far): not a tag; the marker prefix stays withheld
                if (at >= 2 && text.charAt(at - 1) == '<' && text.charAt(at - 2) == '<') continue;
                if (at >= 0 && (best < 0 || at < best)) { best = at; which = t; }
            }
            return best < 0 ? null : new int[] {best, which};
        }

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

        private static int indexIgnoreCase(CharSequence text, String needle) {
            return text.toString().toLowerCase(java.util.Locale.ROOT).indexOf(needle.toLowerCase(java.util.Locale.ROOT));
        }
    }
}
