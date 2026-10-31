package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 资产的手动编辑：添加资产时选出现在哪几集、之后能改；角色也能直接上传参考图。 */
class DirectorAssetEditTest {
    private static final String USER = "u1";
    private final ObjectMapper om = new ObjectMapper();
    private DirectorWorkRepository works;
    private IpRunRepository runs;
    private StudioWorkflowService textRuns;
    private DirectorService service;
    private final List<IpRun> stored = new ArrayList<>();
    private DirectorWork work;
    private IpProjectService projects;

    @BeforeEach
    void setUp() {
        projects = mock(IpProjectService.class);
        when(projects.requireOwnedAssetKey(eq(USER), any())).thenAnswer(i -> i.getArgument(1));
        works = mock(DirectorWorkRepository.class);
        runs = mock(IpRunRepository.class);
        textRuns = mock(StudioWorkflowService.class);
        when(textRuns.directorPrices(any())).thenReturn(new long[]{21, 8});
        when(textRuns.capabilities()).thenReturn(new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Capabilities(false, List.of(), 8, 21, null, List.of(), "selectable", "selectable"));
        when(works.save(any())).thenAnswer(i -> { work = i.getArgument(0); return work; });
        when(works.lockById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(works.findById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(runs.findByProjectIdOrderByCreatedAtDesc(any())).thenAnswer(i -> new ArrayList<>(stored));
        service = new DirectorService(works, runs, projects, mock(IpRunService.class), textRuns,
                mock(StudioWorkflowWorker.class), mock(StudioVideoService.class), mock(StudioFixtureProvider.class),
                mock(StudioMediaImportService.class), mock(MaterialVideoJobService.class), null, mock(MaterialVideoModelClient.class),
                mock(AiAppSceneModelPolicyService.class), mock(FileStorageService.class), new IpStudioProperties(), mock(IpLibraryService.class), om,
                mock(PlatformTransactionManager.class));
    }

    private static String headed(int notes) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < notes; i++) b.append("设定 ").append(i).append("：主角是个看不见的修士，靠听声辨位。\n");
        return b.append("# 第1集 下山\n师父：去吧。\n# 第2集 进城\n掌柜：客官里边请。\n").toString();
    }

    private JsonNode create(String script) {
        return service.create(USER, new DirectorService.CreateRequest("测试", "", script));
    }

    private JsonNode edit(String op, String target, Long rev, String data) throws Exception {
        return service.edit(USER, work.getId(), new DirectorService.EditRequest(op, target, rev, om.readTree(data)));
    }

    private JsonNode splitTask(String options) throws Exception {
        return service.task(USER, work.getId(), new DirectorService.TaskRequest("split", null, "r1", om.readTree(options), null, 21L));
    }

    /** 两集的作品（按标题免费拆分）。 */
    private JsonNode twoEpisodes() throws Exception {
        create("# 第1集 下山\n师父：去吧。\n# 第2集 进城\n掌柜：客官里边请。\n");
        return edit("split.save", splitTask("{}").path("pendingSplit").path("id").asText(), null, "{}");
    }

    private static JsonNode last(JsonNode v) {
        return v.path("assets").get(v.path("assets").size() - 1);
    }

    @Test
    void addedAssetAppearsInTheChosenEpisodesInEpisodeOrder() throws Exception {
        JsonNode v = twoEpisodes();
        String ep1 = v.path("episodes").get(0).path("id").asText(), ep2 = v.path("episodes").get(1).path("id").asText();
        v = edit("asset.create", null, null, "{\"kind\":\"prop\",\"name\":\"玉佩\",\"episodeIds\":[\"" + ep2 + "\",\"" + ep1 + "\",\"" + ep2 + "\"]}");
        assertEquals("[\"" + ep1 + "\",\"" + ep2 + "\"]", last(v).path("episodeIds").toString());
        JsonNode a = last(v);
        v = edit("asset.update", a.path("id").asText(), a.path("rev").asLong(), "{\"episodeIds\":[\"" + ep1 + "\"]}");
        assertEquals("[\"" + ep1 + "\"]", last(v).path("episodeIds").toString());
    }

    @Test
    void unknownEpisodeIsRejectedAndNothingIsAdded() throws Exception {
        twoEpisodes();
        BusinessException e = assertThrows(BusinessException.class,
                () -> edit("asset.create", null, null, "{\"kind\":\"prop\",\"name\":\"玉佩\",\"episodeIds\":[\"gone\"]}"));
        assertEquals("DIRECTOR_INPUT_INVALID", e.getCode());
        assertEquals(0, service.get(USER, work.getId()).path("assets").size());
    }

    @Test
    void characterUploadIsAdoptedDirectly() throws Exception {
        twoEpisodes();
        JsonNode v = edit("asset.create", null, null, "{\"kind\":\"character\",\"name\":\"林晚\"}");
        String id = last(v).path("id").asText();
        v = edit("asset.upload", id, null, "{\"key\":\"u/face.png\"}");
        JsonNode slot = last(v).path("image");
        assertEquals("upload", slot.path("candidates").get(0).path("source").asText());
        assertEquals(slot.path("candidates").get(0).path("id").asText(), slot.path("adoptedId").asText());
        assertEquals("user", slot.path("adoptedBy").asText());
    }
}
