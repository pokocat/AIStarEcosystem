package com.aistareco.aep.ipstudio.dialogue;

import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** docs/ip-studio-dialogue-no-continue.md §4: what one model call of a long task sees. */
class DialogueContextWindowTest {
    private static Map<String, Object> m(String role, Object content) {
        Map<String, Object> out = new LinkedHashMap<>(); out.put("role", role); out.put("content", content); return out;
    }

    /** Native tool calling: an assistant tool_calls entry with its tool message per step. */
    private static List<Map<String, Object>> nativeExchange(int steps) {
        List<Map<String, Object>> out = new ArrayList<>(List.of(m("system", "系统提示"), m("user", "原始要求：写三集剧本并拆镜")));
        for (int i = 0; i < steps; i++) {
            Map<String, Object> assistant = m("assistant", "第 " + i + " 步。" + "说明".repeat(400));
            assistant.put("tool_calls", List.of(Map.of("id", "call-" + i, "type", "function",
                    "function", Map.of("name", "create_nodes", "arguments", "{\"nodes\":[{\"content\":\"" + "剧本".repeat(500) + "\"}]}"))));
            out.add(assistant);
            Map<String, Object> tool = m("tool", "{\"ok\":true,\"summary\":\"建好了第 " + i + " 个对象\",\"nodeIds\":[\"n" + i + "\"],\"text\":\"" + "正文".repeat(2000) + "\"}");
            tool.put("tool_call_id", "call-" + i);
            out.add(tool);
        }
        return out;
    }

    @Test void aShortExchangeIsSentAsIs() {
        var messages = nativeExchange(DialogueContextWindow.RECENT_EXCHANGES);
        assertSame(messages, DialogueContextWindow.trim(messages, l -> 0));
    }

    @Test void olderExchangesAreReducedButTheShapeAndThePreambleStay() {
        var messages = nativeExchange(20);
        var copy = new ArrayList<>(messages);
        var view = DialogueContextWindow.trim(messages, l -> 0);
        assertEquals(messages.size(), view.size(), "every tool_call keeps exactly one tool message");
        assertEquals(copy, messages, "the exchange itself is never changed");
        assertSame(messages.get(0), view.get(0)); assertSame(messages.get(1), view.get(1));
        // The oldest step: reduced to one line with its summary and objects; its long arguments are replaced by valid JSON.
        var oldTool = String.valueOf(view.get(3).get("content"));
        assertTrue(oldTool.startsWith("（较早的结果，已压缩）"), oldTool);
        assertTrue(oldTool.contains("建好了第 0 个对象") && oldTool.contains("n0"));
        assertFalse(oldTool.contains("正文正文"));
        assertEquals("call-0", view.get(3).get("tool_call_id"));
        @SuppressWarnings("unchecked") var call = (Map<String, Object>) ((List<?>) view.get(2).get("tool_calls")).get(0);
        @SuppressWarnings("unchecked") var function = (Map<String, Object>) call.get("function");
        assertDoesNotThrow(() -> new com.fasterxml.jackson.databind.ObjectMapper().readTree(String.valueOf(function.get("arguments"))));
        assertEquals("create_nodes", function.get("name"));
        // The most recent exchanges are untouched.
        for (int i = view.size() - 2 * DialogueContextWindow.RECENT_EXCHANGES; i < view.size(); i++) assertSame(messages.get(i), view.get(i));
    }

    @Test void aWindowStillTooLargeKeepsFewerRecentExchanges() {
        var messages = nativeExchange(20);
        var view = DialogueContextWindow.trim(messages, l -> l.stream().filter(x -> !String.valueOf(x.get("content")).startsWith("（较早")).count() * 10_000L);
        long full = view.stream().filter(x -> "tool".equals(x.get("role")) && !String.valueOf(x.get("content")).startsWith("（较早")).count();
        assertEquals(1, full, "only the newest exchange stays whole when the window is still above the target");
    }

    @Test void jsonActionResultsBecomeOneLinePerTool() {
        List<Map<String, Object>> messages = new ArrayList<>(List.of(m("system", "s"), m("user", "u")));
        for (int i = 0; i < 10; i++) {
            messages.add(m("assistant", "读一段\n<<<studio-actions>>>\n[{\"tool\":\"read_canvas\",\"args\":{\"offset\":" + (i * 4000) + "}}]"));
            messages.add(m("user", DialogueContextWindow.TOOL_RESULTS_PREFIX + "\n[{\"tool\":\"read_canvas\",\"result\":{\"ok\":true,\"summary\":\"已读取 1 个对象\",\"nextOffset\":"
                    + ((i + 1) * 4000) + ",\"text\":\"" + "字".repeat(3000) + "\"}}]"));
        }
        var view = DialogueContextWindow.trim(messages, l -> 0);
        String oldest = String.valueOf(view.get(3).get("content"));
        assertTrue(oldest.startsWith("较早的工具结果（已压缩）："), oldest);
        assertTrue(oldest.contains("read_canvas：成功：已读取 1 个对象") && oldest.contains("nextOffset=4000"), oldest);
        assertFalse(oldest.contains("字字字"));
        assertEquals(messages.get(messages.size() - 1), view.get(view.size() - 1));
    }
}
