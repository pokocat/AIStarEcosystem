package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.AiModelInvocationService.ChatStreamListener;
import com.aistareco.aep.service.AiModelInvocationService.ChatTurnResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * What the user reads when the model's actions had to be asked for again. Production 2026-10-21 14:10 (聚算 Qwen3.8 27B,
 * non-streaming): 「我先把两张图都看一下…」 was shown three times, once per try, then the failure note. The real model side
 * ({@link DialogueModels.Real}) runs inside the real loop against a scripted vendor; streaming and non-streaming alike, the
 * prose appears once.
 */
class DialogueRetryDisplayTest {
    private static final ObjectMapper OM = new ObjectMapper();
    static final String PROSE = "我先把两张图都看一下，确认用哪张、画面里有什么。";
    static final String ACTION = "[{\"tool\":\"view_images\",\"args\":{\"nodeIds\":[\"a\",\"b\"],\"question\":\"哪张是正面单图？\"}}]";
    /** Still rejected after the fix: something that is not a closing line follows the array. */
    static final String REJECTED = PROSE + "\n\n<<<studio-actions>>>\n" + ACTION + "\n看完我再告诉你。";
    static final String ACCEPTED = PROSE + "\n\n<<<studio-actions>>>\n" + ACTION;

    /** Records what reached the user, in order, with the part separator the real sink adds. */
    static final class Shown implements DialogueModels.TextSink {
        final StringBuilder text = new StringBuilder();
        private String lastPart;
        @Override public void delta(String partId, String delta) {
            // Same separator as StudioDialogueTurnWorker.Turn.Sink: a new model call starts a new paragraph.
            String existing = text.toString();
            String separator = existing.isEmpty() || partId.equals(lastPart) ? "" : existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
            lastPart = partId;
            text.append(separator).append(delta);
        }
        @Override public void flush() { }
        int count(String needle) { int n = 0; for (int at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) n++; return n; }
    }

    private final Shown shown = new Shown();
    private final DialogueLoopTest.RecordingTools tools = new DialogueLoopTest.RecordingTools();

    private DialogueLoop.Outcome run(boolean streaming, String... replies) throws Exception {
        Deque<String> script = new ArrayDeque<>(List.of(replies));
        AiModelInvocationService models = mock(AiModelInvocationService.class);
        when(models.invokeChatTurnOnEndpoint(any(), any(), any(), any(), any(), any())).thenAnswer(inv -> {
            String content = script.isEmpty() ? "好了。" : script.poll();
            ChatStreamListener listener = inv.getArgument(5);
            if (streaming) for (char c : content.toCharArray()) listener.onTextDelta(String.valueOf(c));
            return new ChatTurnResult(content, "stop", 100L, 20L, List.of(), streaming, false, "qwen38-27b");
        });
        AiModelEndpoint endpoint = AiModelEndpoint.builder().id("ep").name("chat").providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .model("qwen38-27b").chatSupportsTools(false).chatSupportsStreaming(streaming).enabled(true).build();
        var budget = DialogueLoop.TurnBudget.unmetered(1024, Clock.systemUTC());
        var model = new DialogueModels.Real(models, endpoint, List.of(), Set.of("view_images", "read_canvas"), budget, shown,
                () -> false, () -> { }, 0.7, OM);
        return new DialogueLoop(model, tools, new DialogueLoopTest.Hooks(), budget).run(new ArrayList<>());
    }

    @Test void oneCorrectionThatSucceedsShowsTheProseOnce() throws Exception {
        for (boolean streaming : List.of(false, true)) {
            shown.text.setLength(0); tools.ran.clear();
            var outcome = run(streaming, REJECTED, ACCEPTED, "第一张是正面单图，用它来做。");
            assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
            assertEquals(List.of("view_images"), tools.ran);
            assertEquals(1, shown.count(PROSE), (streaming ? "streaming: " : "non-streaming: ") + shown.text);
            assertEquals(PROSE + "\n\n第一张是正面单图，用它来做。", shown.text.toString().strip(), streaming ? "streaming" : "non-streaming");
            assertFalse(shown.text.toString().contains("<<"), shown.text.toString());
        }
    }

    @Test void aCorrectionWithoutProseShowsTheHeldProseOnce() throws Exception {
        for (boolean streaming : List.of(false, true)) {
            shown.text.setLength(0); tools.ran.clear();
            run(streaming, REJECTED, "<<<studio-actions>>>\n" + ACTION, "看完了。");
            assertEquals(List.of("view_images"), tools.ran);
            assertEquals(PROSE + "\n\n看完了。", shown.text.toString().strip(), "the correction was told not to repeat it; it is still shown once");
        }
    }

    @Test void everyTryRejectedShowsTheLastProseOnce() throws Exception {
        for (boolean streaming : List.of(false, true)) {
            shown.text.setLength(0); tools.ran.clear();
            var outcome = run(streaming, REJECTED, REJECTED, REJECTED);
            assertEquals(DialogueLoop.Reason.LIMIT, outcome.reason());
            assertEquals("protocol", outcome.limit());
            assertTrue(tools.ran.isEmpty());
            assertEquals(PROSE, shown.text.toString().strip(), streaming ? "streaming" : "non-streaming");
        }
        // Non-streaming tries that worded it differently: only the last one is shown.
        shown.text.setLength(0);
        run(false, REJECTED, "先看图。\n<<<studio-actions>>>\n" + ACTION + "\n还有", "我看一下两张图。\n<<<studio-actions>>>\n" + ACTION + "\n还有");
        assertEquals("我看一下两张图。", shown.text.toString().strip());
    }

    @Test void aStreamedRetryShowsOnlyWhatItAddsToWhatWasAlreadyShown() throws Exception {
        run(true, REJECTED, PROSE + "我先看第一张。\n<<<studio-actions>>>\n" + ACTION, "好了。");
        assertEquals(1, shown.count(PROSE), shown.text.toString());
        assertTrue(shown.text.toString().contains("我先看第一张。"), shown.text.toString());
    }

    @Test void repliesWithoutFormatErrorsAreShownExactlyAsBefore() throws Exception {
        for (boolean streaming : List.of(false, true)) {
            shown.text.setLength(0); tools.ran.clear();
            run(streaming, ACCEPTED, "第一张是正面单图。");
            assertEquals(PROSE + "\n\n第一张是正面单图。", shown.text.toString().strip());
        }
    }

    @Test void theProductionReplyWithTheMarkerTwiceRunsOnTheFirstTry() throws Exception {
        for (String reply : DialogueActionProtocolTest.MARKER_TWICE) {
            shown.text.setLength(0); tools.ran.clear();
            var outcome = run(false, reply, "看完了。");
            assertEquals(DialogueLoop.Reason.COMPLETED, outcome.reason());
            assertEquals(List.of("view_images"), tools.ran, "no correction needed");
            assertEquals(PROSE + "\n\n看完了。", shown.text.toString().strip());
        }
    }
}
