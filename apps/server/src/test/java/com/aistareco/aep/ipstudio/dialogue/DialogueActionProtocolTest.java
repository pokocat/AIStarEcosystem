package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.service.AiModelInvocationService.ChatToolCall;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** Both action paths normalize to the same actions; the JSON block never reaches the user. */
class DialogueActionProtocolTest {
    @Test void splitsProseFromTheFallbackActionBlock() {
        var parsed = DialogueActionProtocol.parse("我先看一下画布。\n<<<studio-actions>>>\n[{\"tool\":\"read_canvas\",\"args\":{}}]");
        assertEquals("我先看一下画布。", parsed.visibleText());
        assertNull(parsed.parseError());
        assertEquals(1, parsed.actions().size());
        assertEquals("read_canvas", parsed.actions().get(0).tool());
    }

    @Test void acceptsAFencedBlockAndRejectsBrokenJsonWithoutActions() {
        var fenced = DialogueActionProtocol.parse("好\n<<<studio-actions>>>\n```json\n[{\"tool\":\"stop\"}]\n```");
        assertEquals(1, fenced.actions().size());
        var broken = DialogueActionProtocol.parse("好\n<<<studio-actions>>>\n[{\"tool\":\"read_canvas\"");
        assertNotNull(broken.parseError());
        assertTrue(broken.actions().isEmpty(), "an incomplete block is never executed");
        assertEquals("好", broken.visibleText());
    }

    @Test void plainProseHasNoActions() {
        var parsed = DialogueActionProtocol.parse("就这样。");
        assertTrue(parsed.actions().isEmpty());
        assertNull(parsed.parseError());
    }

    @Test void streamingFilterNeverLeaksTheMarkerEvenWhenItIsSplitAcrossDeltas() {
        var filter = new DialogueActionProtocol.MarkerFilter();
        StringBuilder shown = new StringBuilder();
        for (String delta : List.of("先看", "画布。\n<<<studio", "-act", "ions>>>\n[{\"tool\":", "\"read_canvas\"}]")) shown.append(filter.accept(delta));
        shown.append(filter.finish());
        assertEquals("先看画布。\n", shown.toString());
        assertTrue(filter.markerSeen());
    }

    @Test void streamingFilterReleasesAWithheldPrefixThatWasNotTheMarker() {
        var filter = new DialogueActionProtocol.MarkerFilter();
        String first = filter.accept("比较 <<");
        assertEquals("比较 ", first, "only a possible marker prefix is withheld");
        String second = filter.accept("好看>>");
        assertEquals("<<好看>>", second);
        assertEquals("", filter.finish());
    }

    @Test void nativeCallsBecomeTheSameActionsAndBadArgumentsRejectTheBatch() {
        var ok = DialogueActionProtocol.fromNative("正文", List.of(new ChatToolCall("call_1", "read_canvas", "{}"), new ChatToolCall(null, "read_skill", "{\"key\":\"x\"}")));
        assertEquals(List.of("call_1", "call-2"), ok.actions().stream().map(DialogueLoop.Action::id).toList());
        assertEquals("x", ok.actions().get(1).args().path("key").asText());
        var bad = DialogueActionProtocol.fromNative("正文", List.of(new ChatToolCall("c", "read_canvas", "{oops")));
        assertNotNull(bad.parseError());
        assertTrue(bad.actions().isEmpty());
    }

    /** Shape taken from the first production reply of 2026-10-18: the model wrote the tag form instead of the marker. */
    @Test void toolCallTagFormIsTheSameFallbackAndNeverShownToTheUser() {
        var parsed = DialogueActionProtocol.parse("我先看一下画布上这两个素材的完整内容。\n\n<tool_call>\n{\"tool\": \"read_canvas\", \"args\": {\"nodeIds\": [\"a\", \"b\"]}}\n</tool_call>");
        assertEquals("我先看一下画布上这两个素材的完整内容。", parsed.visibleText());
        assertNull(parsed.parseError());
        assertEquals(1, parsed.actions().size());
        assertEquals("read_canvas", parsed.actions().get(0).tool());
        assertEquals(2, parsed.actions().get(0).args().path("nodeIds").size());
    }

    @Test void toolCallTagFormAcceptsNameAndArgumentsSpellingsAndSeveralBlocks() {
        var parsed = DialogueActionProtocol.parse("先看。<tool_call>{\"name\":\"read_canvas\",\"arguments\":\"{\\\"nodeIds\\\":[\\\"a\\\"]}\"}</tool_call><tool_call>{\"tool\":\"read_skill\"}</tool_call>");
        assertNull(parsed.parseError());
        assertEquals(List.of("read_canvas", "read_skill"), parsed.actions().stream().map(DialogueLoop.Action::tool).toList());
        assertEquals("a", parsed.actions().get(0).args().path("nodeIds").get(0).asText());
        assertEquals("先看。", parsed.visibleText());
    }

    @Test void anUnterminatedOrBrokenToolCallBlockRunsNothingAndShowsNoJson() {
        var open = DialogueActionProtocol.parse("好。<tool_call>{\"tool\":\"read_canvas\"");
        assertNotNull(open.parseError());
        assertTrue(open.actions().isEmpty());
        assertEquals("好。", open.visibleText());
        var broken = DialogueActionProtocol.parse("好。<tool_call>{oops}</tool_call>");
        assertNotNull(broken.parseError());
        assertTrue(broken.actions().isEmpty());
        assertEquals("好。", broken.visibleText());
        var mixed = DialogueActionProtocol.parse("<tool_call>{\"tool\":\"stop\"}</tool_call><tool_call>{oops}</tool_call>");
        assertTrue(mixed.actions().isEmpty(), "one bad block rejects the whole batch");
    }

    @Test void streamingFilterStopsAtToolCallTagEvenWhenSplitAcrossDeltas() {
        var filter = new DialogueActionProtocol.MarkerFilter();
        StringBuilder shown = new StringBuilder();
        for (String delta : List.of("先看画布。\n<tool", "_call>{\"tool\":", "\"read_canvas\"}</tool_call>")) shown.append(filter.accept(delta));
        shown.append(filter.finish());
        assertEquals("先看画布。\n", shown.toString());
        assertTrue(filter.markerSeen());
        var plain = new DialogueActionProtocol.MarkerFilter();
        assertEquals("a ", plain.accept("a <to"));
        assertEquals("<tool>", plain.accept("ol>"), "a withheld prefix that was not the tag is released");
    }
}
