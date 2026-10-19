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
}
