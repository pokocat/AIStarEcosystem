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

    /** 检查判人或商品没换对（subject-replaced fail）：这时才重出。 */
    private StudioSegmentedRun run() {return run("subject-replaced");}

    /** failedItem：检查里判 fail 的那一项。 */
    private StudioSegmentedRun run(String failedItem) {
        var outputs = mock(StudioPlanOutputs.class);
        when(outputs.chosenRun(anyString(), anyString(), any())).thenReturn(Optional.of("r2"));
        var output = om.createObjectNode();
        output.putObject("check").putArray("items").addObject().put("id", failedItem).put("status", "fail").put("suggestion", "第1镜：她手里拿的是图2 的绿瓶");
        var dto = new com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto("r2", "p", "n", "studio-check", "done", "done", 100, 4, null, null, om.createObjectNode(), output, null, null, null);
        when(outputs.run(anyString(), anyString(), anyString())).thenReturn(Optional.of(dto));
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

    /** 重出时把检查写下的问题带上：图片整段带；视频只把「第N镜：画面」接到那一镜后面，写给系统的话和台词不带（会被视频模型念出来）。 */
    @Test
    void aRedoCarriesWhatTheCheckFound() {
        var state = state("recreation", "fail");
        var v1 = PlanState.step(state, "production", "v1");
        v1.put("fixHint", "第3镜：推近后女生手里端的是图3 的炒饭；建议重新生成第 2 镜；第2镜：女生说「好吃」；第9镜：远处的白墙");
        ObjectNode definition = om.createObjectNode().put("operation", "video")
                .put("prompt", "拍一段美食视频。\n第2镜（1.8–3.7秒）：从图2开始拍。\n第3镜（3.7–5.7秒）：从图3开始拍，结束在近景");
        definition.putObject("settings");
        String prompt = run().materialize(execution(), state, v1, definition).path("prompt").asText();
        assertEquals("拍一段美食视频。\n第2镜（1.8–3.7秒）：从图2开始拍。\n第3镜（3.7–5.7秒）：从图3开始拍，结束在近景。推近后女生手里端的是图3 的炒饭。", prompt,
                "只接画面描述：带「建议」的、带台词的、提示词里没有的镜头都不接");

        ObjectNode image = om.createObjectNode().put("operation", "image").put("prompt", "以图1为构图基准");
        image.putObject("settings");
        ObjectNode k1 = om.createObjectNode().put("fixHint", "人物还戴着原片的贝雷帽");
        assertTrue(run().materialize(execution(), state, k1, image).path("prompt").asText().endsWith("这一版改掉：人物还戴着原片的贝雷帽"));

        // 没有修改意见、或不是复刻任务：提示词原样
        assertEquals("以图1为构图基准", run().materialize(execution(), state, om.createObjectNode(), image).path("prompt").asText());
        assertEquals("以图1为构图基准", run().materialize(execution(), state("segmented", "fail"), k1, image).path("prompt").asText());
    }

    /** 2026-11-11 真跑：深度复刻两段检查不合格却没重出（规则只认分镜复刻）。三种复刻方式一样：重出一次，并带上检查的意见。 */
    @Test
    void everyCloneMethodRedoesAFailedSegmentWithTheCheckNotes() {
        for (String kind : java.util.List.of("recreation", "depth", "replacement")) {
            var state = state(kind, "fail");
            run().prepare(execution(), state);
            var v1 = PlanState.step(state, "production", "v1");
            assertEquals("pending", v1.path("status").asText(), kind + "：这一段重出");
            assertTrue(v1.path("autoFixed").asBoolean(), kind);

            v1.put("fixHint", "第1镜：她手里拿的是图2 的绿瓶");
            ObjectNode definition = om.createObjectNode().put("operation", "video").put("prompt", "第1镜（0–3秒）：她举起瓶子");
            definition.putObject("settings");
            assertTrue(run().materialize(execution(), state, v1, definition).path("prompt").asText().endsWith("她手里拿的是图2 的绿瓶。"), kind + "：重出带上检查意见");
        }
    }

    /** 2026-11-11 用户定：只有人或商品没换对才重出；背景有字、景别、手势这类不合格只记下来（真跑里重出一次照样不合格，费用翻倍）。 */
    @Test
    void onlyAWrongPersonOrProductIsRedone() {
        for (String other : java.util.List.of("scene-and-action", "old-subject-residue", "character-consistency")) {
            var state = state("depth", "fail");
            run(other).prepare(execution(), state);
            assertEquals("done", PlanState.step(state, "production", "v1").path("status").asText(), other + "：不重出");
            assertTrue(PlanState.step(state, "production", "c1").path("acknowledged").asBoolean());
        }
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
