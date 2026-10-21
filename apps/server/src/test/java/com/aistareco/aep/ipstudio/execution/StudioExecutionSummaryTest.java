package com.aistareco.aep.ipstudio.execution;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The closing message of an execution (docs/ip-studio-new-canvas-and-threads.md §4): one sentence with how it ended and
 * the real total, no list of what finished, and follow-ups that fit what was made. The executor-level cases (checks,
 * a canceled run) are in StudioPlanExecutorTest.
 */
class StudioExecutionSummaryTest {
    private final ObjectMapper om = new ObjectMapper();

    private IpPlanExecution execution(String status) { return IpPlanExecution.builder().id("PEX-1").status(status).build(); }

    private ObjectNode state(String... opsAndStatuses) {
        var state = om.createObjectNode();
        var steps = state.putArray("steps");
        for (int i = 0; i < opsAndStatuses.length; i += 2)
            steps.addObject().put("id", "s" + i).put("stage", "production").put("title", "第 " + (i / 2 + 1) + " 步")
                    .put("operation", opsAndStatuses[i]).put("status", opsAndStatuses[i + 1]).putArray("runIds");
        return state;
    }

    private ObjectNode budget(long analysis, long production, long inFlight) {
        var budget = om.createObjectNode();
        if (analysis >= 0) budget.putObject("analysis").put("spent", analysis).put("inFlight", 0);
        budget.putObject("production").put("spent", production).put("inFlight", inFlight).put("dialogueSpent", 3);
        return budget;
    }

    @Test void theFirstLineSaysHowItEndedAndTheRealTotalAcrossStages() {
        var text = StudioExecutionSummary.build(execution("done"), state("image", "done"), budget(12, 30, 0), id -> null).text();
        assertEquals("做好了，花了 42 积分。", text, "one sentence; the stages are not listed one by one and nothing finished is repeated");
        assertEquals("没有做完，花了 30 积分。\n没做完：「第 1 步」。",
                StudioExecutionSummary.build(execution("failed"), state("image", "failed"), budget(-1, 30, 0), id -> null).text());
        assertTrue(StudioExecutionSummary.build(execution("partial"), state("video", "running"), budget(-1, 8, 40), id -> null).text()
                .startsWith("做了 90 分钟还没做完，先停在这里，花了 8 积分。还有部分积分在结算。"));
        assertTrue(StudioExecutionSummary.build(execution("canceled"), state("video", "pending"), budget(-1, 0, 0), id -> null).text().startsWith("已停止，花了 0 积分。"));
    }

    @Test void aPictureLeadsToAClipOrAnotherLook() {
        assertEquals(List.of("用这张图做一段视频", "换个风格再出一张"), StudioExecutionSummary.suggestions(execution("done"), state("image", "done")));
        assertEquals(List.of("用这些图做一段视频", "换个风格再出一组"), StudioExecutionSummary.suggestions(execution("done"), state("image", "done", "image", "done")));
        // A run that already made a clip from its pictures does not offer to make one again.
        var both = StudioExecutionSummary.suggestions(execution("done"), state("image", "done", "video", "done"));
        assertFalse(both.contains("用这张图做一段视频"), both.toString());
        assertTrue(both.contains("换个风格再出一张"), both.toString());
        // A picture that did not come out offers nothing about pictures.
        assertFalse(StudioExecutionSummary.suggestions(execution("failed"), state("image", "failed")).contains("换个风格再出一张"));
    }

    @Test void theFallbackFitsWhetherAnythingWasMade() {
        var made = StudioExecutionSummary.suggestions(execution("done"), state("video", "done"));
        assertTrue(made.contains("把这张画布存为模板"), made.toString());
        var nothing = StudioExecutionSummary.suggestions(execution("failed"), state("video", "failed"));
        assertTrue(nothing.contains("再试一次"), nothing.toString());
        assertFalse(nothing.contains("把这张画布存为模板"), nothing.toString());
        for (var list : List.of(made, nothing)) {
            assertFalse(list.contains("重新开始这次制作"), list.toString());
            assertTrue(list.size() <= 3, list.toString());
        }
    }
}
