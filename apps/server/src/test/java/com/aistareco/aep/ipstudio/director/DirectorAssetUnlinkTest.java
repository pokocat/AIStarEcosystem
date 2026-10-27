package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
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

/**
 * 删除被片段用着的资产：说清是哪些片段（关联资产或台词说话人）；片段里可以只解除这一项关联，
 * 不删片段、不删资产、不动别的片段和其余资产的顺序；全部解除后才能删（2026-10-27 用户反馈「系统上没有可以删掉关联的地方」）。
 */
class DirectorAssetUnlinkTest {
    private static final String USER = "u1";
    private final ObjectMapper om = new ObjectMapper();
    private DirectorWork work;
    private DirectorService service;
    private final List<IpRun> stored = new ArrayList<>();

    @BeforeEach
    void setUp() {
        DirectorWorkRepository works = mock(DirectorWorkRepository.class);
        IpRunRepository runs = mock(IpRunRepository.class);
        StudioWorkflowService textRuns = mock(StudioWorkflowService.class);
        when(textRuns.directorPrices(any())).thenReturn(new long[]{21, 8});
        when(textRuns.capabilities()).thenReturn(new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Capabilities(false, List.of(), 8, 21, null, List.of(), "selectable", "selectable"));
        when(works.save(any())).thenAnswer(i -> { work = i.getArgument(0); return work; });
        when(works.lockById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(works.findById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(runs.findByProjectIdOrderByCreatedAtDesc(any())).thenAnswer(i -> new ArrayList<>(stored));
        service = new DirectorService(works, runs, mock(IpProjectService.class), mock(IpRunService.class), textRuns,
                mock(StudioWorkflowWorker.class), mock(StudioVideoService.class), mock(StudioFixtureProvider.class),
                mock(StudioMediaImportService.class), mock(MaterialVideoJobService.class), mock(MaterialVideoModelClient.class),
                mock(AiAppSceneModelPolicyService.class), mock(FileStorageService.class), new IpStudioProperties(), mock(IpLibraryService.class), om,
                mock(PlatformTransactionManager.class));
        work = new DirectorWork();
        work.setId("DW-1");
        work.setOwnerUserId(USER);
        work.setTitle("掉漆");
        work.setCreatedAt(Instant.now());
        work.setUpdatedAt(Instant.now());
        // 林夏(as1)：片段 1、2 的关联资产，片段 2 还有她一句台词；片段 3（第 2 集）只有她一句台词，没关联。
        work.setContentJson("""
                {"settings":{"style":"真人写实","aspectRatio":"9:16"},"applied":[],"taskMeta":{},"seq":20,
                 "episodes":[{"id":"ep1","no":1,"title":"掉漆","summary":"","content":"正文","rev":1},{"id":"ep2","no":2,"title":"风铃","summary":"","content":"正文","rev":1}],
                 "assets":[
                  {"id":"as1","kind":"character","name":"林夏","aliases":[],"description":"","episodeIds":[],"image":{"candidates":[],"adoptedId":null},"rev":1},
                  {"id":"as2","kind":"scene","name":"旧书店","aliases":[],"description":"","episodeIds":[],"image":{"candidates":[],"adoptedId":null},"rev":1},
                  {"id":"as3","kind":"prop","name":"红信封","aliases":[],"description":"","episodeIds":[],"image":{"candidates":[],"adoptedId":null},"rev":1}],
                 "clips":[
                  {"id":"cl1","episodeId":"ep1","order":1,"title":"发现","assetIds":["as1","as2","as3"],"shots":[{"id":"s1","durationSec":4,"dialogue":[]}],
                   "board":{"candidates":[{"id":"b1","key":"k/b1.png"}],"adoptedId":"b1","adoptedBy":"user"},"video":{"candidates":[],"pending":[]},"rev":1},
                  {"id":"cl2","episodeId":"ep1","order":2,"title":"离开","assetIds":["as2","as1"],"shots":[{"id":"s2","durationSec":4,"dialogue":[{"speakerId":"as1","text":"走吧。"}]}],
                   "board":{"candidates":[]},"video":{"candidates":[],"pending":[]},"rev":1},
                  {"id":"cl3","episodeId":"ep2","order":1,"title":"守夜","assetIds":["as2"],"shots":[{"id":"s3","durationSec":4,"dialogue":[{"speakerId":"as1","text":"今晚我守着你。"}]}],
                   "board":{"candidates":[]},"video":{"candidates":[],"pending":[]},"rev":1}]}""");
    }

    private JsonNode edit(String op, String target, Long rev, String data) throws Exception {
        return service.edit(USER, "DW-1", new DirectorService.EditRequest(op, target, rev, om.readTree(data)));
    }

    private static JsonNode clip(JsonNode v, String id) {
        for (JsonNode c : v.path("clips")) if (id.equals(c.path("id").asText())) return c;
        return null;
    }

    @Test
    void deletingAnAssetInUseSaysWhichClipsAndHow() {
        BusinessException e = assertThrows(BusinessException.class, () -> edit("asset.delete", "as1", null, "{}"));
        assertEquals("DIRECTOR_ASSET_IN_USE", e.getCode());
        assertTrue(e.getMessage().contains("「林夏」还用在 3 个片段里"));
        JsonNode clips = om.valueToTree(e.getDetails()).path("clips");
        assertEquals(3, clips.size());
        assertEquals("cl1", clips.get(0).path("clipId").asText());
        assertTrue(clips.get(0).path("linked").asBoolean());
        assertEquals(1, clips.get(1).path("lines").asInt(), "片段 2 关联了也有台词");
        assertFalse(clips.get(2).path("linked").asBoolean(), "片段 3 只在台词里用到");
        assertEquals(2, clips.get(2).path("episodeNo").asInt());
    }

    @Test
    void unlinkingRemovesOnlyThatAssetFromThatClip() throws Exception {
        JsonNode before = service.get(USER, "DW-1");
        JsonNode v = edit("clip.unlinkAsset", "cl1", null, "{\"assetId\":\"as1\"}");
        assertEquals(List.of("as2", "as3"), om.convertValue(clip(v, "cl1").path("assetIds"), List.class), "the other assets keep their order");
        assertEquals(1, clip(v, "cl1").path("board").path("candidates").size(), "the board stays");
        assertEquals(clip(before, "cl2"), clip(v, "cl2"), "other clips are untouched");
        assertEquals(3, v.path("assets").size(), "the asset itself stays");
        assertEquals(3, v.path("clips").size(), "no clip is deleted");

        BusinessException still = assertThrows(BusinessException.class, () -> edit("asset.delete", "as1", null, "{}"));
        assertEquals(2, om.valueToTree(still.getDetails()).path("clips").size(), "still used by clip 2 (linked) and clip 3 (lines)");
    }

    @Test
    void afterEveryReferenceIsGoneTheAssetCanBeDeleted() throws Exception {
        edit("clip.unlinkAsset", "cl1", null, "{\"assetId\":\"as1\"}");
        edit("clip.unlinkAsset", "cl2", null, "{\"assetId\":\"as1\"}");
        BusinessException lines = assertThrows(BusinessException.class, () -> edit("asset.delete", "as1", null, "{}"));
        assertEquals(2, om.valueToTree(lines.getDetails()).path("clips").size(), "lines still name her as the speaker in clips 2 and 3");
        // 台词换成旁白（编辑镜头里改说话人）后才能删。
        for (String id : List.of("cl2", "cl3")) {
            JsonNode c = clip(service.get(USER, "DW-1"), id);
            String text = c.path("shots").get(0).path("dialogue").get(0).path("text").asText();
            edit("clip.update", id, c.path("rev").asLong(), "{\"shots\":[{\"durationSec\":4,\"size\":\"中景\",\"dialogue\":[{\"speakerId\":null,\"text\":\"" + text + "\"}]}]}");
        }
        JsonNode v = edit("asset.delete", "as1", null, "{}");
        assertEquals(2, v.path("assets").size());
        assertEquals(List.of("as2", "as3"), om.convertValue(clip(v, "cl1").path("assetIds"), List.class));
    }

    @Test
    void unlinkingSomethingNotLinkedOrWhileTheBoardIsGeneratingIsRefused() {
        BusinessException gone = assertThrows(BusinessException.class, () -> edit("clip.unlinkAsset", "cl3", null, "{\"assetId\":\"as1\"}"));
        assertEquals("DIRECTOR_EDIT_CONFLICT", gone.getCode());
        stored.add(IpRun.builder().id("IPR-b").projectId("DW-1").hostType(IpRun.HOST_DIRECTOR).ownerUserId(USER).nodeId("board:cl1")
                .kind("studio-image").status(IpRun.STATUS_RUNNING).stage("running").cost(0).inputJson("{}").createdAt(Instant.now()).build());
        BusinessException busy = assertThrows(BusinessException.class, () -> edit("clip.unlinkAsset", "cl1", null, "{\"assetId\":\"as1\"}"));
        assertEquals("DIRECTOR_TASK_RUNNING", busy.getCode());
        assertTrue(busy.getMessage().contains("分镜图正在生成"));
    }
}
