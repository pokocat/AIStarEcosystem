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
 */
public final class DialogueActionProtocol {
    public static final String MARKER = "<<<studio-actions>>>";
    /** Many chat models, when told to "write actions as JSON", emit this tag form instead; it is accepted as the same fallback. */
    public static final String TAG_OPEN = "<tool_call>";
    private static final String TAG_CLOSE = "</tool_call>";
    private static final Pattern TAG_BLOCK = Pattern.compile("(?s)<tool_call>(.*?)</tool_call>");
    private static final ObjectMapper OM = new ObjectMapper();
    static final int MAX_ACTIONS_PER_REPLY = 8;

    private DialogueActionProtocol() {}

    public record Parsed(String visibleText, List<DialogueLoop.Action> actions, String parseError) {}

    /** Split a complete reply into visible prose and fallback actions. */
    public static Parsed parse(String text) {
        String full = text == null ? "" : text;
        int at = full.indexOf(MARKER);
        if (at < 0) return parseTagForm(full);
        String visible = full.substring(0, at).strip();
        String block = stripFence(full.substring(at + MARKER.length()).strip());
        if (block.isEmpty()) return new Parsed(visible, List.of(), null);
        JsonNode array;
        try { array = OM.readTree(block); }
        catch (Exception e) { return new Parsed(visible, List.of(), "不是有效的 JSON 数组"); }
        // One action written as a bare object after the marker (real agnes-2.5-flash reply 2026-10-20:
        // 「…<<<studio-actions>>>{"tool":"read_canvas","args":{}}」) is that one action, as in the tag form.
        if (array != null && array.isObject() && array.path("tool").isTextual()) array = OM.createArrayNode().add(array);
        if (array == null || !array.isArray()) return new Parsed(visible, List.of(), "动作必须是 JSON 数组");
        if (array.size() > MAX_ACTIONS_PER_REPLY) return new Parsed(visible, List.of(), "一次最多 " + MAX_ACTIONS_PER_REPLY + " 个动作");
        List<DialogueLoop.Action> actions = new ArrayList<>();
        int i = 0;
        for (JsonNode item : array) {
            i++;
            if (!item.isObject() || !item.path("tool").isTextual() || item.path("tool").asText().isBlank())
                return new Parsed(visible, List.of(), "第 " + i + " 个动作缺少 tool");
            JsonNode args = flatArgs(item);
            if (!args.isMissingNode() && !args.isNull() && !args.isObject()) return new Parsed(visible, List.of(), "第 " + i + " 个动作的 args 必须是对象");
            actions.add(new DialogueLoop.Action("act-" + i, item.path("tool").asText().strip(), args.isObject() ? args : OM.createObjectNode()));
        }
        return new Parsed(visible, List.copyOf(actions), null);
    }

    /**
     * The {@code <tool_call>{"tool":..,"args":{..}}</tool_call>} spelling of the same fallback. Prose outside the tags
     * stays visible; the tags themselves never do. A block that is unterminated or does not parse rejects the whole
     * batch (nothing half-executes), exactly like the marker form.
     */
    private static Parsed parseTagForm(String full) {
        int first = full.indexOf(TAG_OPEN);
        if (first < 0) return bareActions(full);
        Matcher m = TAG_BLOCK.matcher(full);
        StringBuilder visible = new StringBuilder();
        List<DialogueLoop.Action> actions = new ArrayList<>();
        int last = 0, i = 0;
        String error = null;
        while (m.find()) {
            visible.append(full, last, m.start());
            last = m.end();
            i++;
            if (error != null) continue;
            JsonNode item;
            try { item = OM.readTree(stripFence(m.group(1).strip())); }
            catch (Exception e) { error = "第 " + i + " 个动作不是有效 JSON"; continue; }
            if (item == null || !item.isObject()) { error = "第 " + i + " 个动作必须是对象"; continue; }
            JsonNode name = item.hasNonNull("tool") ? item.get("tool") : item.get("name");
            if (name == null || !name.isTextual() || name.asText().isBlank()) { error = "第 " + i + " 个动作缺少 tool"; continue; }
            JsonNode args = item.hasNonNull("args") ? item.get("args") : item.get("arguments");
            if (args != null && args.isTextual()) {
                try { args = OM.readTree(args.asText()); } catch (Exception e) { error = "第 " + i + " 个动作的 args 必须是对象"; continue; }
            }
            if (args != null && !args.isNull() && !args.isObject()) { error = "第 " + i + " 个动作的 args 必须是对象"; continue; }
            actions.add(new DialogueLoop.Action("act-" + i, name.asText().strip(), args != null && args.isObject() ? args : OM.createObjectNode()));
        }
        String rest = full.substring(last);
        int dangling = rest.indexOf(TAG_OPEN);
        if (dangling >= 0) {
            // an opened block that never closed: the text before it is prose, the block itself is never shown or run
            visible.append(rest, 0, dangling);
            if (error == null) error = "动作没有写完整";
        } else {
            visible.append(rest);
        }
        if (i > MAX_ACTIONS_PER_REPLY) return new Parsed(visible.toString().strip(), List.of(), "一次最多 " + MAX_ACTIONS_PER_REPLY + " 个动作");
        if (error != null) return new Parsed(visible.toString().strip(), List.of(), error);
        return new Parsed(visible.toString().strip(), List.copyOf(actions), null);
    }

    /**
     * A reply that is nothing but an action — {@code {"tool":..,"args":{..}}} or an array of them, optionally fenced —
     * with no marker (the same model's correction reply after a rejected batch, 2026-10-20). Without this the raw JSON
     * was shown to the user as the answer and the turn ended. Only a reply that is entirely such JSON counts; prose that
     * merely contains braces stays prose.
     */
    private static Parsed bareActions(String full) {
        String text = stripFence(full.strip());
        if (!(text.startsWith("{") || text.startsWith("["))) return new Parsed(full.strip(), List.of(), null);
        JsonNode node;
        try { node = OM.readTree(text); } catch (Exception e) { return new Parsed(full.strip(), List.of(), null); }
        if (node == null) return new Parsed(full.strip(), List.of(), null);
        var items = node.isArray() ? node : OM.createArrayNode().add(node);
        if (items.isEmpty() || items.size() > MAX_ACTIONS_PER_REPLY) return new Parsed(full.strip(), List.of(), null);
        List<DialogueLoop.Action> actions = new ArrayList<>();
        int i = 0;
        for (JsonNode item : items) {
            i++;
            if (!item.isObject() || !item.path("tool").isTextual() || item.path("tool").asText().isBlank()) return new Parsed(full.strip(), List.of(), null);
            JsonNode args = flatArgs(item);
            if (!args.isMissingNode() && !args.isNull() && !args.isObject()) return new Parsed("", List.of(), "第 " + i + " 个动作的 args 必须是对象");
            actions.add(new DialogueLoop.Action("act-" + i, item.path("tool").asText().strip(), args.isObject() ? args : OM.createObjectNode()));
        }
        return new Parsed("", List.copyOf(actions), null);
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
     * {@code args}, or — when the model wrote the arguments next to {@code tool} instead of inside {@code args}
     * ({@code {"tool":"ask_question","text":"…","options":[…]}}, real reply 2026-10-20) — those sibling fields. The tool
     * still validates every argument; this only stops a correctly named action from running with nothing.
     */
    private static JsonNode flatArgs(JsonNode item) {
        if (item.has("args")) return item.path("args");
        var rest = OM.createObjectNode();
        item.fields().forEachRemaining(f -> { if (!"tool".equals(f.getKey())) rest.set(f.getKey(), f.getValue()); });
        return rest.isEmpty() ? item.path("args") : rest;
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
     * Streaming filter: forwards real deltas as they arrive and withholds only what could be the beginning of the
     * marker. Once the marker is seen, everything after it is action text and is never forwarded.
     */
    public static final class MarkerFilter {
        private final StringBuilder pending = new StringBuilder();
        private boolean markerSeen;

        /** @return the part of {@code delta} that is certainly prose and can be shown now (possibly empty). */
        public String accept(String delta) {
            if (markerSeen || delta == null || delta.isEmpty()) return "";
            pending.append(delta);
            int at = firstMarker(pending);
            if (at >= 0) {
                markerSeen = true;
                String visible = pending.substring(0, at);
                pending.setLength(0);
                return visible;
            }
            int keep = longestMarkerPrefixSuffix(pending);
            String visible = pending.substring(0, pending.length() - keep);
            pending.delete(0, pending.length() - keep);
            return visible;
        }

        /** End of stream: a withheld tail that never became the marker is prose. */
        public String finish() {
            if (markerSeen) return "";
            String rest = pending.toString();
            pending.setLength(0);
            return rest;
        }

        public boolean markerSeen() { return markerSeen; }

        private static int firstMarker(CharSequence text) {
            String t = text.toString();
            int a = t.indexOf(MARKER), b = t.indexOf(TAG_OPEN);
            return a < 0 ? b : b < 0 ? a : Math.min(a, b);
        }

        private static int longestMarkerPrefixSuffix(CharSequence text) {
            int keep = 0;
            for (String marker : new String[] {MARKER, TAG_OPEN}) {
                int max = Math.min(text.length(), marker.length() - 1);
                for (int len = max; len > keep; len--) {
                    boolean match = true;
                    for (int i = 0; i < len; i++) if (text.charAt(text.length() - len + i) != marker.charAt(i)) { match = false; break; }
                    if (match) { keep = len; break; }
                }
            }
            return keep;
        }
    }
}
