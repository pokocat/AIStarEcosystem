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

    /** IPT-2f13c2ed42994624907d seq 10 (2026-10-20 15:11:27Z), the reply as stored: the plan never ran because this spelling was shown as prose. */
    static final String STUDIO_ACTIONS_REPLY = "好，就按单段 4 秒来做。我现在把整体方案和报价整理出来给你确认。\n\n<studio-actions>\n"
            + "[{\"tool\":\"propose_plan\",\"args\":{\"stage\":\"production\",\"brief\":\"用户目标：4 秒、16:9 的视频片段\"}}]\n</studio-actions>";

    @Test void studioActionsTagFormIsParsedIntoTheProposePlanActionAndHidden() {
        var parsed = DialogueActionProtocol.parse(STUDIO_ACTIONS_REPLY);
        assertNull(parsed.parseError());
        assertEquals(List.of("propose_plan"), parsed.actions().stream().map(DialogueLoop.Action::tool).toList());
        assertEquals("production", parsed.actions().get(0).args().path("stage").asText());
        assertEquals("好，就按单段 4 秒来做。我现在把整体方案和报价整理出来给你确认。", parsed.visibleText());
        assertFalse(parsed.visibleText().contains("studio-actions"));
    }

    @Test void studioActionsTagCarriesSeveralActionsInOrderAndAcceptsOneObjectAndUnderscoreAndCase() {
        var many = DialogueActionProtocol.parse("看一下。<studio-actions>[{\"tool\":\"read_canvas\"},{\"tool\":\"view_images\",\"args\":{\"nodeIds\":[\"a\"]}}]</studio-actions>");
        assertNull(many.parseError());
        assertEquals(List.of("read_canvas", "view_images"), many.actions().stream().map(DialogueLoop.Action::tool).toList());
        assertEquals(List.of("act-1", "act-2"), many.actions().stream().map(DialogueLoop.Action::id).toList());
        var one = DialogueActionProtocol.parse("<STUDIO_ACTIONS>{\"tool\":\"stop\"}</STUDIO_ACTIONS>");
        assertNull(one.parseError());
        assertEquals("stop", one.actions().get(0).tool());
    }

    @Test void proseAfterAClosedTagStaysVisible() {
        var parsed = DialogueActionProtocol.parse("先整理。<studio-actions>[{\"tool\":\"read_canvas\"}]</studio-actions>整理好了再说。");
        assertEquals("先整理。整理好了再说。", parsed.visibleText());
        assertEquals(1, parsed.actions().size());
    }

    @Test void brokenOrUnclosedStudioActionsRunNothingAndAskAgain() {
        for (String reply : List.of("好。<studio-actions>[{\"tool\":\"propose_plan\"", "好。<studio-actions>[{tool:propose_plan}]</studio-actions>",
                "好。<studio-actions>[{\"args\":{}}]</studio-actions>", "好。<studio-actions>[{\"tool\":\"stop\",\"args\":[1]}]</studio-actions>",
                "好。<studio-actions>[{\"tool\":\"stop\"}]</studio-actions><studio-actions>{oops}</studio-actions>")) {
            var parsed = DialogueActionProtocol.parse(reply);
            assertNotNull(parsed.parseError(), reply);
            assertTrue(parsed.actions().isEmpty(), "nothing half-executes: " + reply);
            assertEquals("好。", parsed.visibleText(), reply);
        }
    }

    @Test void moreThanTheActionLimitInTagsIsRefused() {
        String item = "{\"tool\":\"read_canvas\"}";
        var parsed = DialogueActionProtocol.parse("<studio-actions>[" + String.join(",", java.util.Collections.nCopies(9, item)) + "]</studio-actions>");
        assertNotNull(parsed.parseError());
        assertTrue(parsed.actions().isEmpty());
    }

    @Test void streamingHidesTheStudioActionsBlockSplitAnywhereAndResumesAfterIt() {
        // The same reply cut at every position into two deltas: the user never sees the envelope, and the stored text
        // (what was streamed) equals what parse() calls visible.
        String reply = "先整理。<studio-actions>[{\"tool\":\"read_canvas\"}]</studio-actions>整理好了。";
        for (int cut = 0; cut <= reply.length(); cut++) {
            var filter = new DialogueActionProtocol.MarkerFilter();
            String shown = filter.accept(reply.substring(0, cut)) + filter.accept(reply.substring(cut)) + filter.finish();
            assertEquals("先整理。整理好了。", shown, "cut at " + cut);
        }
        var unclosed = new DialogueActionProtocol.MarkerFilter();
        String shown = unclosed.accept("好。<studio-actions>[{\"tool\":") + unclosed.accept("\"stop\"}]") + unclosed.finish();
        assertEquals("好。", shown, "an unclosed envelope is never shown");
    }

    @Test void streamingByCharactersMatchesParseForTheProductionReply() {
        var filter = new DialogueActionProtocol.MarkerFilter();
        StringBuilder shown = new StringBuilder();
        for (char c : STUDIO_ACTIONS_REPLY.toCharArray()) shown.append(filter.accept(String.valueOf(c)));
        shown.append(filter.finish());
        assertEquals(DialogueActionProtocol.parse(STUDIO_ACTIONS_REPLY).visibleText(), shown.toString().strip());
        assertTrue(filter.markerSeen());
    }

    /** Same thread, seq 12: the model copied the history's work-record spelling instead of calling the tools; nothing ran. */
    @Test void proseThatImitatesTheWorkRecordIsAProtocolErrorNotAnExecutedTool() {
        var parsed = DialogueActionProtocol.parse("[查看画布：done，已读取 3 个对象] [提问：你这条消息里「开始生成」我理解成确认按刚才那份方案出片。]");
        assertNotNull(parsed.parseError());
        assertTrue(parsed.actions().isEmpty());
        assertNull(DialogueActionProtocol.parse("方案里会用到 [男主三视图] 和客厅图。").parseError(), "ordinary brackets are prose");
    }

    @Test void theMarkerIsNeverMistakenForTheTagItContains() {
        String reply = "方案整理好了。\n<<<studio-actions>>>\n[{\"tool\":\"propose_plan\",\"args\":{}}]";
        var filter = new DialogueActionProtocol.MarkerFilter();
        StringBuilder shown = new StringBuilder();
        for (char c : reply.toCharArray()) shown.append(filter.accept(String.valueOf(c)));
        shown.append(filter.finish());
        assertEquals("方案整理好了。\n", shown.toString(), "no stray 「<<」 before the hidden block");
        var parsed = DialogueActionProtocol.parse(reply);
        assertEquals(List.of("propose_plan"), parsed.actions().stream().map(DialogueLoop.Action::tool).toList());
        assertEquals("方案整理好了。", parsed.visibleText());
    }
}
