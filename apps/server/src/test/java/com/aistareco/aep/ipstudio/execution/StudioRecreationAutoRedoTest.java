package com.aistareco.aep.ipstudio.execution;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 视频页的爆款复刻少让人参与（2026-11-10 用户要求）：一段成片没通过检查，自动重出这一段一次，连检查一起再来；
 * 重出过还不合格就用最后一版接着做。别的视频页任务的检查只作参考。
 */
class StudioRecreationAutoRedoTest {
    final ObjectMapper om = new ObjectMapper();

    private ObjectNode state(String kind, String checkStatus) {
        ObjectNode state = om.createObjectNode();
        state.putObject("videoTask").put("kind", kind);
        var steps = state.putArray("steps");
        steps.addObject().put("id", "v1").put("stage", "production").put("operation", "video").put("status", "done").put("attempt", 1).putArray("runIds").add("r1");
        ObjectNode check = steps.addObject().put("id", "c1").put("stage", "production").put("operation", "check").put("status", "done").put("checkStatus", checkStatus).put("attempt", 1);
        check.putArray("runIds").add("r2");
        check.putObject("definition").putObject("settings").put("targetStepId", "v1");
        return state;
    }

    private StudioSegmentedRun run() {
        var outputs = mock(StudioPlanOutputs.class);
        when(outputs.chosenRun(anyString(), anyString(), any())).thenReturn(Optional.empty());
        return new StudioSegmentedRun(outputs, om);
    }

    private IpPlanExecution execution() {
        return IpPlanExecution.builder().id("PEX-1").ownerUserId("u").projectId("p").stage("production").build();
    }

    @Test
    void aFailedRecreationCheckRedoesThatSegmentOnce() {
        var state = state("recreation", "fail");
        run().prepare(execution(), state);
        var v1 = PlanState.step(state, "production", "v1");
        var c1 = PlanState.step(state, "production", "c1");
        assertEquals("pending", v1.path("status").asText(), "这一段重出");
        assertEquals(2, v1.path("attempt").asInt(), "新的请求编号，不重复交同一个请求");
        assertTrue(v1.path("autoFixed").asBoolean());
        assertEquals("r1", v1.path("previousRunIds").get(0).asText(), "第一版留着，费用照算");
        assertEquals("pending", c1.path("status").asText(), "检查也再来一次");

        // 重出后还是不合格：不再重出，用最后一版接着做
        v1.put("status", "done"); c1.put("status", "done").put("checkStatus", "fail");
        run().prepare(execution(), state);
        assertEquals("done", v1.path("status").asText());
        assertTrue(c1.path("acknowledged").asBoolean());
    }

    @Test
    void otherVideoPageTasksKeepTheDeliveredVideo() {
        var state = state("segmented", "fail");
        run().prepare(execution(), state);
        assertEquals("done", PlanState.step(state, "production", "v1").path("status").asText());
        assertTrue(PlanState.step(state, "production", "c1").path("acknowledged").asBoolean());
    }

    @Test
    void aCheckThatCouldNotRunDoesNotBlockTheVideo() {
        var state = state("recreation", "fail");
        var c1 = PlanState.step(state, "production", "c1");
        c1.put("status", "failed").put("attempt", 3).put("errorCode", "STUDIO_VISION_UNAVAILABLE");
        run().prepare(execution(), state);
        assertTrue(c1.path("softSkipped").asBoolean(), "检查做不了就跳过，不让成片停下来等人");
    }
}
