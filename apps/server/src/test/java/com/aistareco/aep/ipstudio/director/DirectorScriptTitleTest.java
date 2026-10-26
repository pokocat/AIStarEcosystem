package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DirectorScriptTitleTest {
    final ObjectMapper om = new ObjectMapper();
    final IpRunRepository runs = mock(IpRunRepository.class);
    final DirectorService service = new DirectorService(null, runs, null, null, null, null, mock(StudioVideoService.class),
            mock(StudioFixtureProvider.class), null, null, null, mock(AiAppSceneModelPolicyService.class), null, null, null,
            om, mock(PlatformTransactionManager.class));

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void adoptedScriptUpdatesTitleAndRejectedOrFailedResultsKeepIt(boolean regenerate) throws Exception {
        for (String outcome : List.of("accepted", "stale", "failed", "blank-title")) {
            var work = new DirectorWork(); work.setId("w"); work.setTitle("原作品名");
            ObjectNode c = om.createObjectNode().put("draft", regenerate ? "原剧本正文" : "").put("draftRev", 0);
            for (String field : List.of("episodes", "assets", "clips", "applied")) c.putArray(field);
            c.putObject("taskMeta"); c.putObject("settings");
            ObjectNode meta = om.createObjectNode().put("task", "script").put("draftRev", 0);
            if (regenerate) meta.put("regenerate", true).put("baseHash", (String) ReflectionTestUtils.invokeMethod(service, "scriptBaseHash", c));
            if (outcome.equals("stale")) c.put("draft", "用户在生成期间修改了正文").put("draftRev", 1);
            ObjectNode input = om.createObjectNode(); input.set("_director", meta);
            ObjectNode output = om.createObjectNode();
            output.putObject("director").put("title", outcome.equals("blank-title") ? "" : "AI 新剧名")
                    .put("content", "AI 生成的全新剧本正文").put("logline", "新故事");
            var run = IpRun.builder().id("r").nodeId("script").status(outcome.equals("failed") ? "failed" : "done")
                    .inputJson(input.toString()).outputJson(output.toString()).build();
            when(runs.findByProjectIdOrderByCreatedAtDesc("w")).thenReturn(List.of(run));
            assertTrue(service.reconcile(work, c));
            assertEquals(outcome.equals("accepted") ? "AI 新剧名" : "原作品名", work.getTitle(), outcome);
            if (regenerate && outcome.equals("accepted")) assertEquals("原作品名", c.path("scriptHistory").get(0).path("title").asText());
            service.reconcile(work, c);
            if (regenerate && outcome.equals("accepted")) assertEquals(1, c.path("scriptHistory").size());
        }
    }
}
