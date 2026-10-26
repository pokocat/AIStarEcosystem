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

/**
 * 分集的整条流程：按标题免费拆、模型拆分结果先预览、确认 / 放弃 / 撤销、设定资料并入第一集，
 * 以及一键制作全自动时按默认直接采用、拆分失败时作为一集继续。
 */
class DirectorSplitTest {
    private static final String USER = "u1";
    private final ObjectMapper om = new ObjectMapper();
    private DirectorWorkRepository works;
    private IpRunRepository runs;
    private StudioWorkflowService textRuns;
    private DirectorService service;
    private final List<IpRun> stored = new ArrayList<>();
    private DirectorWork work;

    @BeforeEach
    void setUp() {
        works = mock(DirectorWorkRepository.class);
        runs = mock(IpRunRepository.class);
        textRuns = mock(StudioWorkflowService.class);
        when(textRuns.directorPrices()).thenReturn(new long[]{21, 8});
        when(works.save(any())).thenAnswer(i -> { work = i.getArgument(0); return work; });
        when(works.lockById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(works.findById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(runs.findByProjectIdOrderByCreatedAtDesc(any())).thenAnswer(i -> new ArrayList<>(stored));
        service = new DirectorService(works, runs, mock(IpProjectService.class), mock(IpRunService.class), textRuns,
                mock(StudioWorkflowWorker.class), mock(StudioVideoService.class), mock(StudioFixtureProvider.class),
                mock(StudioMediaImportService.class), mock(MaterialVideoJobService.class), mock(MaterialVideoModelClient.class),
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

    @Test
    void scriptGenerationUsesTheHundredThousandTokenBudget() throws Exception {
        service.create(USER, new DirectorService.CreateRequest("测试", "一个发生在深夜便利店的短剧", null));
        when(textRuns.submitDirectorText(any(), any(), any(), any(), any(), anyInt(), any(), any(), any(), any()))
                .thenReturn(new IpRunDto("IPR-script", null, "script", "studio-director", "running", "queued", 0, 0, null, null, null, null, null, null));

        service.task(USER, work.getId(), new DirectorService.TaskRequest("script", null, "script-1", om.createObjectNode(), null, 21L));

        verify(textRuns).submitDirectorText(any(), any(), eq("script"), any(), any(),
                eq(DirectorService.SCRIPT_MAX_TOKENS), any(), argThat(meta -> "script".equals(meta.path("task").asText())), any(), any());
    }

    @Test
    void headingsSplitForFreeAndKeepTheNotesAsReference() throws Exception {
        JsonNode v = create(headed(3));
        assertEquals(2, v.path("draftEpisodeHeadings").asInt());
        v = splitTask("{}");
        verify(textRuns, never()).submitDirectorText(any(), any(), any(), any(), any(), anyInt(), any(), any(), any(), any());
        JsonNode pending = v.path("pendingSplit");
        assertEquals("headings", pending.path("source").asText());
        assertEquals(3, pending.path("preamble").path("paragraphs").asInt());
        assertEquals("下山", pending.path("episodes").get(0).path("title").asText());
        assertEquals(0, v.path("episodes").size(), "nothing is applied before the user confirms");

        v = edit("split.save", pending.path("id").asText(), null, "{}");
        assertEquals(2, v.path("episodes").size());
        assertTrue(v.path("reference").asText().startsWith("设定 0："));
        assertTrue(v.path("episodes").get(0).path("content").asText().startsWith("# 第1集 下山"));
        assertTrue(v.path("canUndoSplit").asBoolean());
        assertFalse(v.has("splitUndo"), "the original draft stays on the server");
    }

    @Test
    void preambleCanGoIntoTheFirstEpisodeInstead() throws Exception {
        create(headed(2));
        JsonNode pending = splitTask("{}").path("pendingSplit");
        JsonNode v = edit("split.save", pending.path("id").asText(), null, "{\"preamble\":\"episode\"}");
        assertEquals("", v.path("reference").asText());
        assertTrue(v.path("episodes").get(0).path("content").asText().startsWith("设定 0："));
    }

    @Test
    void saveAndDiscardRequireTheExactPreviewIdentity() throws Exception {
        create(headed(1));
        String preview = splitTask("{}").path("pendingSplit").path("id").asText();
        for (String op : List.of("split.save", "split.discard")) {
            for (String target : new String[]{null, "stale-preview"}) {
                BusinessException failure = assertThrows(BusinessException.class, () -> edit(op, target, null, "{}"));
                assertEquals("DIRECTOR_SPLIT_EXPIRED", failure.getCode());
                JsonNode current = service.get(USER, work.getId());
                assertEquals(preview, current.path("pendingSplit").path("id").asText());
                assertTrue(current.path("episodes").isEmpty());
            }
        }
    }

    @Test
    void splitPreservesTheStoredDraftCharactersIncludingBlankLinesIndentationAndCrlf() throws Exception {
        String original = "设定资料：保留这段。\r\n\r\n  # 第1集 下山\r\n\t师父：去吧。  \r\n\r\n  # 第2集 进城\r\n    掌柜：客官里边请。";
        create(original);
        String preview = splitTask("{}").path("pendingSplit").path("id").asText();
        JsonNode v = edit("split.save", preview, null, "{}");
        String reconstructed = v.path("reference").asText() + v.path("episodes").get(0).path("content").asText()
                + v.path("episodes").get(1).path("content").asText();
        assertEquals(original, reconstructed);
        assertTrue(v.path("episodes").get(0).path("content").asText().contains("\r\n\t师父：去吧。  \r\n\r\n"));
        v = edit("split.undo", null, null, "{}");
        assertEquals(original, v.path("draft").asText());
    }

    @Test
    void aDifferentRequestedCountGoesToTheModel() throws Exception {
        create(headed(1));
        when(textRuns.submitDirectorText(any(), any(), any(), any(), any(), anyInt(), any(), any(), any(), any()))
                .thenReturn(new IpRunDto("IPR-1", null, "split", "studio-text", "running", "queued", 0, 0, null, null, null, null, null, null));
        JsonNode v = splitTask("{\"episodeCount\":3}");
        verify(textRuns).submitDirectorText(any(), any(), eq("split"), any(), any(), anyInt(), any(), any(), any(), any());
        assertTrue(v.path("pendingSplit").isNull());
    }

    @Test
    void modelResultIsPreviewedWithWhatTheProgramFixed() throws Exception {
        // 《食神》的形状：最后一集少写了最后一段；还按要求的集数比对。
        create("甲：开饭。\n乙：好。\n丙：再来一碗。\n丁：没了。\n一箭穿心 剧终");
        String draftHash = DirectorService.hash(om.readTree(work.getContentJson()).path("draft").asText());
        JsonNode meta = om.readTree("{\"task\":\"split\",\"paragraphCount\":5,\"targetEpisodeCount\":3,\"draftHash\":\"" + draftHash + "\"}");
        JsonNode validated = DirectorPrompts.validate(om, meta, om.readTree(
                "{\"episodes\":[{\"title\":\"开饭\",\"startParagraph\":0,\"endParagraph\":1},{\"title\":\"没了\",\"startParagraph\":2,\"endParagraph\":3}]}"));
        ObjectNode input = om.createObjectNode(); input.set("_director", meta);
        ObjectNode output = om.createObjectNode(); output.set("director", validated);
        stored.add(IpRun.builder().id("IPR-1").projectId(work.getId()).hostType(IpRun.HOST_DIRECTOR).ownerUserId(USER).nodeId("split")
                .kind("studio-text").status(IpRun.STATUS_DONE).stage("done").cost(3).clientRequestId("u-r1")
                .inputJson(om.writeValueAsString(input)).outputJson(om.writeValueAsString(output)).createdAt(Instant.now()).build());

        JsonNode v = service.get(USER, work.getId());
        JsonNode pending = v.path("pendingSplit");
        assertEquals("model", pending.path("source").asText());
        assertEquals(4, pending.path("episodes").get(1).path("endParagraph").asInt());
        assertTrue(pending.path("notes").get(0).asText().contains("第 2 集结尾补入 1 段（从「一箭穿心 剧终」开始）"));
        assertTrue(pending.path("warnings").get(0).asText().contains("你要求分成 3 集，这次分成了 2 集"));

        v = edit("split.save", pending.path("id").asText(), null, "{}");
        assertTrue(v.path("episodes").get(1).path("content").asText().endsWith("一箭穿心 剧终"), "no paragraph is lost");
    }

    @Test
    void editingTheDraftExpiresThePendingSplit() throws Exception {
        create(headed(1));
        JsonNode pending = splitTask("{}").path("pendingSplit");
        long rev = om.readTree(work.getContentJson()).path("draftRev").asLong();
        service.patch(USER, work.getId(), new DirectorService.PatchRequest(null, null, headed(2), rev, null));
        BusinessException e = assertThrows(BusinessException.class, () -> edit("split.save", pending.path("id").asText(), null, "{}"));
        assertEquals("DIRECTOR_SPLIT_EXPIRED", e.getCode());
    }

    @Test
    void undoRestoresTheOriginalDraftUntilThereIsMedia() throws Exception {
        String original = headed(2);
        create(original);
        edit("split.save", splitTask("{}").path("pendingSplit").path("id").asText(), null, "{}");
        JsonNode v = edit("split.undo", null, null, "{}");
        assertEquals(original.strip(), v.path("draft").asText().strip());
        assertEquals("", v.path("reference").asText());
        assertEquals(0, v.path("episodes").size());
        assertFalse(v.path("canUndoSplit").asBoolean());

        edit("split.save", splitTask("{}").path("pendingSplit").path("id").asText(), null, "{}");
        ObjectNode c = (ObjectNode) om.readTree(work.getContentJson());
        ObjectNode clip = c.withArray("clips").addObject().put("id", "cl1").put("episodeId", c.path("episodes").get(0).path("id").asText());
        clip.putObject("board").putArray("candidates").addObject().put("id", "m1");
        clip.putObject("video").putArray("candidates");
        work.setContentJson(om.writeValueAsString(c));
        BusinessException e = assertThrows(BusinessException.class, () -> edit("split.undo", null, null, "{}"));
        assertEquals("DIRECTOR_CLIPS_HAVE_MEDIA", e.getCode());
    }

    @Test
    void referenceMergesIntoTheFirstEpisode() throws Exception {
        create(headed(2));
        JsonNode v = edit("split.save", splitTask("{}").path("pendingSplit").path("id").asText(), null, "{}");
        v = edit("reference.toEpisode", null, v.path("referenceRev").asLong(), "{}");
        assertEquals("", v.path("reference").asText());
        assertTrue(v.path("episodes").get(0).path("content").asText().startsWith("设定 0："));
        BusinessException e = assertThrows(BusinessException.class, () -> edit("reference.update", null, 0L, "{\"text\":\"x\"}"));
        assertEquals("DIRECTOR_EDIT_CONFLICT", e.getCode(), "a stale revision does not overwrite the notes");
    }

    private JsonNode startPipeline(boolean auto) {
        return service.pipeline(USER, work.getId(), new DirectorService.PipelineRequest("start", "work", null, "plan", 500L, null, auto));
    }

    @Test
    void autoPipelineAdoptsTheHeadingSplitAndSaysWhatItDid() {
        create(headed(2));
        startPipeline(true);
        service.tick(work.getId());
        JsonNode c = service.get(USER, work.getId());
        assertEquals(2, c.path("episodes").size());
        assertTrue(c.path("notice").path("message").asText().contains("2 段放进了设定资料"));
    }

    @Test
    void manualPipelineWaitsForTheSplitToBeConfirmed() {
        create(headed(2));
        startPipeline(false);
        service.tick(work.getId());
        JsonNode p = service.get(USER, work.getId()).path("pipeline");
        assertEquals("waiting", p.path("status").asText());
        assertEquals("confirm-split", p.path("stage").asText());
    }

    @Test
    void autoPipelineContinuesAsOneEpisodeWhenTheSplitFails() {
        create("甲：开饭。\n乙：好。");
        when(textRuns.submitDirectorText(any(), any(), any(), any(), any(), anyInt(), any(), any(), any(), any()))
                .thenReturn(new IpRunDto("IPR-9", null, "split", "studio-text", "running", "queued", 0, 0, null, null, null, null, null, null));
        startPipeline(true);
        stored.add(IpRun.builder().id("IPR-9").projectId(work.getId()).hostType(IpRun.HOST_DIRECTOR).ownerUserId(USER).nodeId("split")
                .kind("studio-text").status(IpRun.STATUS_FAILED).stage("failed").cost(0).clientRequestId("x").errorMessage("分集结果没有有效的分集位置")
                .inputJson("{}").outputJson("{}").createdAt(Instant.now()).build());
        service.tick(work.getId());
        JsonNode c = service.get(USER, work.getId());
        assertEquals(1, c.path("episodes").size());
        assertTrue(c.path("canUndoSplit").asBoolean());
        assertTrue(c.path("notice").path("message").asText().contains("已作为一集继续"));
    }
}
