package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.service.AiModelInvocationService.ChatToolCall;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;

/**
 * The two action paths of the dialogue model, normalized to one {@link DialogueLoop.Action} list:
 * native function calling (endpoint declares {@code chatSupportsTools}) and the JSON action fallback
 * (prose, then a line {@value #MARKER}, then a JSON array of {@code {tool,args}}). The action part is never shown to
 * the user and an action block that did not parse completely is never executed.
 */
public final class DialogueActionProtocol {
    public static final String MARKER = "<<<studio-actions>>>";
    private static final ObjectMapper OM = new ObjectMapper();
    static final int MAX_ACTIONS_PER_REPLY = 8;

    private DialogueActionProtocol() {}

    public record Parsed(String visibleText, List<DialogueLoop.Action> actions, String parseError) {}

    /** Split a complete reply into visible prose and fallback actions. */
    public static Parsed parse(String text) {
        String full = text == null ? "" : text;
        int at = full.indexOf(MARKER);
        if (at < 0) return new Parsed(full.strip(), List.of(), null);
        String visible = full.substring(0, at).strip();
        String block = stripFence(full.substring(at + MARKER.length()).strip());
        if (block.isEmpty()) return new Parsed(visible, List.of(), null);
        JsonNode array;
        try { array = OM.readTree(block); }
        catch (Exception e) { return new Parsed(visible, List.of(), "不是有效的 JSON 数组"); }
        if (array == null || !array.isArray()) return new Parsed(visible, List.of(), "动作必须是 JSON 数组");
        if (array.size() > MAX_ACTIONS_PER_REPLY) return new Parsed(visible, List.of(), "一次最多 " + MAX_ACTIONS_PER_REPLY + " 个动作");
        List<DialogueLoop.Action> actions = new ArrayList<>();
        int i = 0;
        for (JsonNode item : array) {
            i++;
            if (!item.isObject() || !item.path("tool").isTextual() || item.path("tool").asText().isBlank())
                return new Parsed(visible, List.of(), "第 " + i + " 个动作缺少 tool");
            JsonNode args = item.path("args");
            if (!args.isMissingNode() && !args.isNull() && !args.isObject()) return new Parsed(visible, List.of(), "第 " + i + " 个动作的 args 必须是对象");
            actions.add(new DialogueLoop.Action("act-" + i, item.path("tool").asText().strip(), args.isObject() ? args : OM.createObjectNode()));
        }
        return new Parsed(visible, List.copyOf(actions), null);
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
            int at = pending.indexOf(MARKER);
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

        private static int longestMarkerPrefixSuffix(CharSequence text) {
            int max = Math.min(text.length(), MARKER.length() - 1);
            for (int len = max; len > 0; len--) {
                boolean match = true;
                for (int i = 0; i < len; i++) if (text.charAt(text.length() - len + i) != MARKER.charAt(i)) { match = false; break; }
                if (match) return len;
            }
            return 0;
        }
    }
}
