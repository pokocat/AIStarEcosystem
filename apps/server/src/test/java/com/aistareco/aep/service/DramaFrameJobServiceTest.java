package com.aistareco.aep.service;

import com.aistareco.aep.config.DramaFrameProperties;
import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.repository.DramaFrameJobRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * v0.198：画布的片段视频（kind=drama-canvas）和老短剧同一个分区（APP_DRAMA），但老工作台的任务中心不显示它们 ——
 * 画布是独立的流水（docs/drama-canvas-plan.md §7）。
 */
class DramaFrameJobServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();

    @Test
    void listTasks_excludesCanvasVideos() {
        DramaFrameJobRepository frameRepo = mock(DramaFrameJobRepository.class);
        MaterialVideoJobService videoJobs = mock(MaterialVideoJobService.class);
        List<JsonNode> cards = new ArrayList<>();
        cards.add(OM.createObjectNode().put("id", "mvj_shot").put("kind", "drama-shot").put("status", "rendering")
                .put("created_at", "2026-09-30T01:00:00Z"));
        cards.add(OM.createObjectNode().put("id", "mvj_canvas").put("kind", DramaCanvasRunService.VIDEO_JOB_KIND)
                .put("status", "rendering").put("created_at", "2026-09-30T02:00:00Z"));
        when(videoJobs.listJobs(eq("u1"), isNull(), isNull(), eq(MaterialVideoJobService.APP_DRAMA))).thenReturn(cards);
        DramaFrameJobService svc = new DramaFrameJobService(frameRepo, mock(MaterialVideoJobRepository.class), videoJobs,
                mock(DramaFrameJobWorker.class), new DramaFrameProperties(), new MaterialVideoProperties(), OM);

        JsonNode tasks = svc.listTasks("u1", null).path("tasks");
        assertEquals(1, tasks.size(), tasks.toString());
        assertEquals("mvj_shot", tasks.get(0).path("id").asText());
    }
}
