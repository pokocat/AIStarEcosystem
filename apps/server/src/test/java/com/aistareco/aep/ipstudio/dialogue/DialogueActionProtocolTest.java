package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.service.AiModelInvocationService.ChatToolCall;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Set;
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

    // ── Codex review of 39ca9218: the four probes, verbatim ─────────────────────────────────────────────────────────

    static String streamed(String reply) {
        var f = new DialogueActionProtocol.MarkerFilter();
        StringBuilder out = new StringBuilder();
        for (char c : reply.toCharArray()) out.append(f.accept(String.valueOf(c)));
        return out.append(f.finish()).toString();
    }

    @Test void anOuterEnvelopeThatNeverClosesRunsNothingEvenWithACompleteInnerBlock() {
        var parsed = DialogueActionProtocol.parse("<studio-actions>broken<tool_call>{\"tool\":\"read_canvas\"}</tool_call>");
        assertNotNull(parsed.parseError());
        assertTrue(parsed.actions().isEmpty());
        assertEquals("", parsed.visibleText());
        var closedButNested = DialogueActionProtocol.parse("好<studio-actions>x<tool_call>{\"tool\":\"stop\"}</tool_call></studio-actions>");
        assertNotNull(closedButNested.parseError());
        assertTrue(closedButNested.actions().isEmpty());
    }

    @Test void trailingJsonAfterTheBatchIsNotAcceptedAsComplete() {
        var parsed = DialogueActionProtocol.parse("<studio-actions>[{\"tool\":\"read_canvas\"}] [{\"tool\":</studio-actions>");
        assertNotNull(parsed.parseError());
        assertTrue(parsed.actions().isEmpty());
        var marker = DialogueActionProtocol.parse("好\n<<<studio-actions>>>\n[{\"tool\":\"stop\"}] 还有");
        assertNotNull(marker.parseError());
        assertTrue(marker.actions().isEmpty());
    }

    @Test void aTagThenTheMarkerRunsBothAndStreamsExactlyWhatParseShows() {
        String reply = "before<studio-actions>[{\"tool\":\"read_canvas\"}]</studio-actions>middle\n<<<studio-actions>>>\n[{\"tool\":\"stop\"}]";
        var parsed = DialogueActionProtocol.parse(reply);
        assertNull(parsed.parseError());
        assertEquals(List.of("read_canvas", "stop"), parsed.actions().stream().map(DialogueLoop.Action::tool).toList());
        assertEquals("beforemiddle", parsed.visibleText());
        assertEquals("beforemiddle", streamed(reply).strip());
    }

    @Test void anUnfinishedMarkerFollowedByATagNeverLeaksTheTagWhileStreaming() {
        String reply = "<<<studio-actions>bad<studio-actions>[{\"tool\":\"read_canvas\"}]</studio-actions>after";
        var parsed = DialogueActionProtocol.parse(reply);
        String shown = streamed(reply);
        assertFalse(shown.contains("read_canvas"), shown);
        assertEquals(parsed.visibleText(), shown.strip());
        for (int cut = 0; cut <= reply.length(); cut++) {
            var f = new DialogueActionProtocol.MarkerFilter();
            String two = f.accept(reply.substring(0, cut)) + f.accept(reply.substring(cut)) + f.finish();
            assertFalse(two.contains("read_canvas"), "cut at " + cut + ": " + two);
        }
    }

    /** Real agnes-2.5-flash replies 2026-10-20 (意图直达 evaluation): one object after the marker, then a bare correction. */
    @Test void aSingleObjectAfterTheMarkerAndABareActionReplyAreActionsNotProse() {
        var single = DialogueActionProtocol.parse("让我先看看画布上有什么素材。<<<studio-actions>>>{\"tool\":\"read_canvas\",\"args\":{}}");
        assertNull(single.parseError());
        assertEquals("让我先看看画布上有什么素材。", single.visibleText());
        assertEquals("read_canvas", single.actions().get(0).tool());
        var bare = DialogueActionProtocol.parse("{\"tool\":\"read_canvas\",\"args\":{}}");
        assertNull(bare.parseError());
        assertEquals("", bare.visibleText(), "the raw JSON is never shown as the answer");
        assertEquals(1, bare.actions().size());
        var fencedArray = DialogueActionProtocol.parse("```json\n[{\"tool\":\"read_canvas\"},{\"tool\":\"read_skill\",\"args\":{\"key\":\"image-generation\"}}]\n```");
        assertEquals(2, fencedArray.actions().size());
        var flat = DialogueActionProtocol.parse("先问一件事：\n<<<studio-actions>>>\n[{\"tool\":\"ask_question\",\"text\":\"保留原片哪部分？\",\"options\":[\"动作\",\"节奏\"]}]");
        assertEquals("保留原片哪部分？", flat.actions().get(0).args().path("text").asText(), "arguments written beside tool are its args");
        assertEquals(2, flat.actions().get(0).args().path("options").size());
        assertFalse(flat.actions().get(0).args().has("tool"));
        for (String prose : List.of("{这不是 JSON}", "[1, 2]", "{\"title\":\"不是动作\"}", "按 {\"tool\":\"x\"} 这样写"))
            assertTrue(DialogueActionProtocol.parse(prose).actions().isEmpty(), prose);
    }
    // ── Production 2026-10-21 13:50 (聚算 Qwen3.8 27B, JSON action path): the whole reply was 「[调用工具 view_images]」 ──

    /** The registered tool names, read from the tool classes the same way the prompt wiring test does. */
    static Set<String> registered() throws Exception { return StudioDialoguePromptWiringTest.toolNames(); }

    static String streamedWith(String reply, Set<String> names) {
        var f = new DialogueActionProtocol.MarkerFilter(names);
        StringBuilder out = new StringBuilder();
        for (char c : reply.toCharArray()) out.append(f.accept(String.valueOf(c)));
        return out.append(f.finish()).toString();
    }

    /** Every cut into two deltas and the per-character stream show exactly what parse() keeps. */
    static void assertStreamsAsParsed(String reply, Set<String> names) {
        String kept = DialogueActionProtocol.parse(reply, names).visibleText();
        assertEquals(kept, streamedWith(reply, names).strip(), "per character: " + reply);
        for (int cut = 0; cut <= reply.length(); cut++) {
            var f = new DialogueActionProtocol.MarkerFilter(names);
            String two = f.accept(reply.substring(0, cut)) + f.accept(reply.substring(cut)) + f.finish();
            assertEquals(kept, two.strip(), "cut at " + cut + ": " + reply);
        }
    }

    @Test void theProductionReplyIsAFormatErrorAndIsNeverShown() throws Exception {
        var parsed = DialogueActionProtocol.parse("[调用工具 view_images]", registered());
        assertNotNull(parsed.parseError(), "a tool call written as text is not an answer");
        assertTrue(parsed.parseError().contains("[调用工具 view_images]"), parsed.parseError());
        assertTrue(parsed.actions().isEmpty());
        assertEquals("", parsed.visibleText(), "the text that looks like a call is never shown");
        assertEquals("", streamedWith("[调用工具 view_images]", registered()));
    }

    @Test void everySpellingOfACallWrittenAsTextIsAFormatErrorAndHidden() throws Exception {
        Set<String> names = registered();
        for (String reply : List.of("[调用工具 view_images]", "[调用工具：view_images]", "[调用工具:view_images]", "[使用工具 read_canvas]",
                "[工具 view_images]", "【调用工具 view_images】", "[调用工具 `view_images`]", "[调用工具 view_images({\"nodeIds\":\"a\"})]",
                "调用工具 view_images", "调用工具：view_images。", "  使用工具 read_canvas  ", "[view_images]", "view_images()",
                "view_images", "`read_canvas`", "\n[view_images]\n")) {
            var parsed = DialogueActionProtocol.parse(reply, names);
            assertNotNull(parsed.parseError(), reply);
            assertTrue(parsed.actions().isEmpty(), reply);
            assertEquals("", parsed.visibleText(), reply);
            assertStreamsAsParsed(reply, names);
        }
    }

    @Test void proseAroundACallWrittenAsTextStaysAndOnlyTheCallIsHidden() throws Exception {
        Set<String> names = registered();
        var after = DialogueActionProtocol.parse("先看一下画布上的设定图。\n[调用工具 view_images]", names);
        assertNotNull(after.parseError());
        assertEquals("先看一下画布上的设定图。", after.visibleText());
        var line = DialogueActionProtocol.parse("先看一下画布上的设定图。\n调用工具 view_images\n", names);
        assertNotNull(line.parseError());
        assertEquals("先看一下画布上的设定图。", line.visibleText());
        var inline = DialogueActionProtocol.parse("先看一下设定图[调用工具：view_images]，再整理方案。", names);
        assertNotNull(inline.parseError());
        assertEquals("先看一下设定图，再整理方案。", inline.visibleText());
        for (String reply : List.of("先看一下画布上的设定图。\n[调用工具 view_images]", "先看一下画布上的设定图。\n调用工具 view_images\n",
                "先看一下设定图[调用工具：view_images]，再整理方案。"))
            assertStreamsAsParsed(reply, names);
    }

    @Test void aCallWrittenAsTextNextToARealActionIsHiddenAndTheActionRuns() throws Exception {
        String reply = "[调用工具 view_images]\n<<<studio-actions>>>\n[{\"tool\":\"view_images\",\"args\":{\"nodeIds\":[\"a\"]}}]";
        var parsed = DialogueActionProtocol.parse(reply, registered());
        assertNull(parsed.parseError());
        assertEquals(List.of("view_images"), parsed.actions().stream().map(DialogueLoop.Action::tool).toList());
        assertEquals("", parsed.visibleText());
        assertStreamsAsParsed(reply, registered());
    }

    @Test void proseThatTalksAboutToolsIsNotMistakenForACall() throws Exception {
        Set<String> names = registered();
        for (String reply : List.of("我先用看图工具看一下画布上的设定图。", "调用工具前我会先说一声在做什么。", "这一步会调用工具查看画布，不收费。",
                "工具栏里有裁剪和局部重绘。", "使用这张图做第一顺位参考。", "方案里会用到 [男主三视图] 和客厅图。", "【重点】三视图要正面、侧面、背面一致。",
                "[调用工具 make_coffee]", "调用工具 view_images 之后我再整理方案。", "先看 [view_images] 再说", "view_images()\n然后我会出方案。",
                "参考 [1] 和 [2]。\n- [ ] 待办", "一张图 [未闭合的括号\n下一行")) {
            var parsed = DialogueActionProtocol.parse(reply, names);
            assertNull(parsed.parseError(), reply);
            assertEquals(reply.strip(), parsed.visibleText(), reply);
            assertStreamsAsParsed(reply, names);
        }
    }

    @Test void withoutToolNamesOnlyTheImitatedRecordIsRecognized() {
        var plain = DialogueActionProtocol.parse("[调用工具 view_images]");
        assertNull(plain.parseError(), "names come from the registry; none given, none recognized");
        assertEquals("[调用工具 view_images]", plain.visibleText());
        var record = DialogueActionProtocol.parse("[查看画布：done，已读取 3 个对象] 先这样。");
        assertNotNull(record.parseError());
        assertEquals("先这样。", record.visibleText(), "an imitated work record is hidden like a call written as text");
        assertStreamsAsParsed("[查看画布：done，已读取 3 个对象] 先这样。", Set.of());
    }

    @Test void aLongBracketIsReleasedAndNeverHeldBackPastItsLimit() throws Exception {
        String longBracket = "[" + "很长的说明".repeat(100) + "]";
        var parsed = DialogueActionProtocol.parse(longBracket, registered());
        assertNull(parsed.parseError());
        assertEquals(longBracket, parsed.visibleText());
        var f = new DialogueActionProtocol.MarkerFilter(registered());
        String shown = f.accept("[" + "很长的说明".repeat(100));
        assertFalse(shown.isEmpty(), "an open bracket past the limit is shown without waiting for it to close");
    }
}
