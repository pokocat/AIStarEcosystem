package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 角色形态与场景四视图（2026-11-04）：片段选了形态，分镜图和视频交的是形态的图，提示词里仍写角色本名；
 * 四视图一张 2×2 切三格；没用这些的旧片段提示词一个字不变，不会被标「需更新」。
 */
class DirectorFormsAndViewsTest {
    private static final String USER = "u1";
    private final ObjectMapper om = new ObjectMapper();
    private final DirectorWorkRepository works = mock(DirectorWorkRepository.class);
    private final IpRunRepository runs = mock(IpRunRepository.class);
    private final IpRunService images = mock(IpRunService.class);
    private final StudioWorkflowService text = mock(StudioWorkflowService.class);
    private final IpProjectService projects = mock(IpProjectService.class);
    private final FileStorageService storage = mock(FileStorageService.class);
    private DirectorService service;
    private DirectorWork work;

    @BeforeEach void setUp() {
        when(projects.requireOwnedAssetKey(eq(USER), any())).thenAnswer(i -> i.getArgument(1));
        when(text.directorPrices(any())).thenReturn(new long[]{21, 16});
        when(text.capabilities()).thenReturn(new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Capabilities(false, List.of(), 16, 21, null, List.of(), "selectable", "selectable"));
        AiAppSceneModelPolicyService policy = mock(AiAppSceneModelPolicyService.class);
        var endpoint = AiModelEndpoint.builder().id("img").name("img").modelAlias("标准模型").model("img").enabled(true).baseUrl("https://example.com/v1")
                .imageRequestSpecJson("{\"promptMaxChars\":16000,\"minReferenceImages\":0,\"maxReferenceImages\":14,\"referenceField\":\"multiple\",\"outputs\":["
                        + "{\"canvasSize\":\"1024x1024\",\"aspectRatio\":\"1:1\",\"providerFields\":{}},{\"canvasSize\":\"1360x768\",\"aspectRatio\":\"16:9\",\"providerFields\":{}},"
                        + "{\"canvasSize\":\"768x1360\",\"aspectRatio\":\"9:16\",\"providerFields\":{}}]}").build();
        var selection = new AiAppSceneModelPolicyService.Selection(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true), 16, "per_image");
        when(policy.available(eq("studio"), eq("image"), anyLong())).thenReturn(List.of(selection));
        when(policy.resolve(eq("studio"), eq("image"), nullable(String.class), anyLong())).thenReturn(selection);
        when(works.save(any())).thenAnswer(i -> { work = i.getArgument(0); return work; });
        when(works.lockById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(works.findById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(images.generateForDirector(eq(USER), any(), any())).thenAnswer(i -> {
            IpRunService.IpGenerateRequest req = i.getArgument(2);
            return new IpRunDto("run-" + req.nodeId(), work.getId(), req.nodeId(), "generate", "running", "queued", 0, req.maxCost(),
                    null, null, om.createObjectNode(), om.createObjectNode(), null, null, null);
        });
        when(storage.store(any(byte[].class), any(), any(), any(), any())).thenAnswer(i -> {
            String key = "gen/" + System.nanoTime() + ".png";
            return new FileStorageService.StoredFile(key, key, key, null, 1, "image/png");
        });
        service = new DirectorService(works, runs, projects, images, text, mock(StudioWorkflowWorker.class), mock(StudioVideoService.class),
                mock(StudioFixtureProvider.class), mock(StudioMediaImportService.class), mock(MaterialVideoJobService.class), null, mock(MaterialVideoModelClient.class),
                policy, storage, new IpStudioProperties(), mock(IpLibraryService.class), om, mock(PlatformTransactionManager.class));
        service.create(USER, new DirectorService.CreateRequest("形态", "", null));
    }

    private JsonNode edit(String op, String target, String data) throws Exception {
        return service.edit(USER, work.getId(), new DirectorService.EditRequest(op, target, null, om.readTree(data)));
    }

    private ObjectNode content() throws Exception { return (ObjectNode) om.readTree(work.getContentJson()); }

    /** 建好角色（带主图）、场景（带主图）和一个用它们的片段。 */
    private void seed() throws Exception {
        ObjectNode c = content();
        c.withArray("episodes").addObject().put("id", "e1").put("no", 1).put("title", "一").put("summary", "").put("content", "正文").put("rev", 1);
        work.setContentJson(c.toString());
        edit("asset.create", null, "{\"kind\":\"character\",\"name\":\"白素贞\",\"description\":\"白衣女子\",\"image\":{\"key\":\"u/bai.png\",\"use\":\"asset\"}}");
        edit("asset.create", null, "{\"kind\":\"scene\",\"name\":\"金山寺\",\"description\":\"江边寺庙\",\"image\":{\"key\":\"u/si.png\",\"use\":\"asset\"}}");
        c = content();
        ObjectNode clip = c.withArray("clips").addObject().put("id", "k1").put("episodeId", "e1").put("order", 1).put("title", "对峙").put("summary", "").put("durationSec", 6)
                .put("boardPrompt", "").put("boardPromptCustom", false).put("videoPrompt", "").put("videoPromptCustom", false).put("rev", 1);
        clip.putArray("assetIds").add(assetId("白素贞")).add(assetId("金山寺"));
        clip.putArray("issues");
        ObjectNode s1 = clip.putArray("shots").addObject().put("id", "s1").put("durationSec", 3).put("size", "中景").put("camera", "平视").put("action", "转身").put("still", "她站在江边");
        s1.putArray("dialogue");
        ObjectNode s2 = clip.withArray("shots").addObject().put("id", "s2").put("durationSec", 3).put("size", "近景").put("camera", "反打").put("action", "抬头").put("still", "身后是寺门");
        s2.putArray("dialogue");
        clip.putObject("board").putArray("candidates"); clip.putObject("video").putArray("candidates");
        work.setContentJson(c.toString());
    }

    private String assetId(String name) throws Exception {
        for (JsonNode a : content().path("assets")) if (name.equals(a.path("name").asText())) return a.path("id").asText();
        throw new AssertionError(name);
    }

    private JsonNode asset(JsonNode w, String name) {
        for (JsonNode a : w.path("assets")) if (name.equals(a.path("name").asText())) return a;
        throw new AssertionError(name);
    }

    private void setSceneView(String view) throws Exception {
        ObjectNode c = content();
        ((ObjectNode) c.path("clips").get(0).path("shots").get(1)).put("sceneView", view);
        work.setContentJson(c.toString());
    }

    private void adoptReverseView() throws Exception {
        edit("view.upload", assetId("金山寺"), "{\"view\":\"reverse\",\"key\":\"u/si-reverse.png\"}");
    }

    private IpRunService.IpGenerateRequest submitted() {
        ArgumentCaptor<IpRunService.IpGenerateRequest> req = ArgumentCaptor.forClass(IpRunService.IpGenerateRequest.class);
        verify(images, atLeastOnce()).generateForDirector(eq(USER), any(), req.capture());
        return req.getValue();
    }

    @Test void displayedReferenceNumbersMatchThePromptAndSubmittedImagesEvenWhenSceneWasLinkedFirst() throws Exception {
        seed();
        setSceneView("reverse");
        adoptReverseView();
        ObjectNode c = content();
        ObjectNode clip = (ObjectNode) c.path("clips").get(0);
        clip.putArray("assetIds").add(assetId("金山寺")).add(assetId("白素贞"));
        work.setContentJson(c.toString());

        JsonNode wire = service.get(USER, work.getId()).path("clips").get(0);
        JsonNode refs = wire.path("boardRefs");
        assertEquals(List.of("图1", "图2", "图3"), values(refs, "label"));
        assertEquals(List.of("白素贞", "金山寺", "金山寺·反打"), values(refs, "name"));
        assertTrue(wire.path("boardPrompt").asText().contains("图1 提供角色「白素贞」"));
        assertTrue(wire.path("boardPrompt").asText().contains("图2 提供场景「金山寺」"));
        service.task(USER, work.getId(), new DirectorService.TaskRequest("board", "k1", "refs-order", null, null, 16L));
        assertEquals(submitted().refKeys(), values(refs, "key"));
        assertFalse(content().path("clips").get(0).has("boardRefs"), "wire 投影不写回作品");
        assertEquals(List.of(assetId("金山寺"), assetId("白素贞")), values(content().path("clips").get(0).path("assetIds"), null));
    }

    @Test void missingAnImageDoesNotMoveTheOtherReferenceNumbers() throws Exception {
        seed();
        ObjectNode c = content();
        ((ObjectNode) c.path("assets").get(0).path("image")).putNull("adoptedId");
        work.setContentJson(c.toString());
        JsonNode refs = service.get(USER, work.getId()).path("clips").get(0).path("boardRefs");
        assertEquals("图1", refs.get(0).path("label").asText());
        assertTrue(refs.get(0).path("key").isNull());
        assertEquals("图2", refs.get(1).path("label").asText());
        assertEquals("u/si.png", refs.get(1).path("key").asText());
    }

    /** 片段当前的分镜图提示词（形态不进提示词，切换前后一样）。 */
    private String boardPrompt() throws Exception {
        return service.get(USER, work.getId()).path("clips").get(0).path("boardPrompt").asText();
    }

    /** 放一张已采用的分镜图：指纹按给定的 key 算（只传主图就是 2026-11-06 之前的算法），refs 记实际提交的图。 */
    private void adoptBoard(String prompt, List<String> fingerprintKeys, List<String> refKeys) throws Exception {
        ObjectNode c = content();
        ObjectNode board = (ObjectNode) c.path("clips").get(0).path("board");
        ObjectNode m = board.withArray("candidates").addObject().put("id", "b1").put("key", "u/board.png").put("source", "generated").put("prompt", prompt)
                .put("fingerprint", DirectorService.hash(prompt + "|" + String.join("|", fingerprintKeys)));
        var refs = m.putArray("refs");
        for (int i = 0; i < refKeys.size(); i++) refs.addObject().put("label", "图" + (i + 1)).put("key", refKeys.get(i));
        board.put("adoptedId", "b1").put("adoptedBy", "user");
        work.setContentJson(c.toString());
    }

    private JsonNode wireBoard() throws Exception { return service.get(USER, work.getId()).path("clips").get(0).path("board"); }

    /** 建一个有图的形态并返回 id；片段还没选用它。 */
    private String formWithImage(String key) throws Exception {
        JsonNode w = edit("form.create", assetId("白素贞"), "{\"name\":\"半妖态\",\"description\":\"下半身化作蛇尾\"}");
        String formId = asset(w, "白素贞").path("forms").get(0).path("id").asText();
        edit("form.upload", formId, "{\"key\":\"" + key + "\"}");
        return formId;
    }

    private void chooseForm(String formId) throws Exception {
        edit("clip.setForm", "k1", "{\"assetId\":\"" + assetId("白素贞") + "\",\"formId\":\"" + formId + "\"}");
    }

    @Test void switchingTheFormMarksABoardMadeWithTheMainImageOutdatedAndSwitchingBackRestoresIt() throws Exception {
        seed();
        adoptBoard(boardPrompt(), List.of("u/bai.png", "u/si.png"), List.of("u/bai.png", "u/si.png"));
        assertEquals("current", wireBoard().path("adoptedCheck").asText());
        String formId = formWithImage("u/bai-yao.png");
        assertEquals("current", wireBoard().path("adoptedCheck").asText(), "建了形态但这一段没选，图没变");
        chooseForm(formId);
        JsonNode board = wireBoard();
        assertEquals("outdated", board.path("adoptedCheck").asText());
        assertEquals("参考图已更换", board.path("staleReasons").get(0).asText());
        chooseForm("");
        assertEquals("current", wireBoard().path("adoptedCheck").asText());
    }

    @Test void replacingTheChosenFormsImageMarksTheBoardOutdated() throws Exception {
        seed();
        String formId = formWithImage("u/bai-yao.png");
        chooseForm(formId);
        adoptBoard(boardPrompt(), List.of("u/bai-yao.png", "u/si.png"), List.of("u/bai-yao.png", "u/si.png"));
        assertEquals("current", wireBoard().path("adoptedCheck").asText());
        edit("form.upload", formId, "{\"key\":\"u/bai-yao-2.png\"}");
        assertEquals("outdated", wireBoard().path("adoptedCheck").asText());
    }

    /** 这几张是旧算法下生成的、实际用的图也没变，不能因为算法换了就标「需更新」。 */
    @Test void boardsMadeBeforeTheFingerprintChangeStayCurrentWhenTheirImagesAreUnchanged() throws Exception {
        seed();
        chooseForm(formWithImage("u/bai-yao.png"));
        adoptBoard(boardPrompt(), List.of("u/bai.png", "u/si.png"), List.of("u/bai-yao.png", "u/si.png"));
        assertEquals("current", wireBoard().path("adoptedCheck").asText(), "用形态生成的");
    }

    @Test void legacyBoardsWithAFormAndProductKeepTheProductInTheirFingerprint() throws Exception {
        seed();
        ObjectNode c = content();
        ((ObjectNode) c.path("settings")).put("commerce", true);
        ObjectNode product = ((ObjectNode) c.path("assets").get(0)).deepCopy();
        product.put("id", "p1").put("kind", "product").put("name", "保温杯").put("description", "不锈钢保温杯");
        ((ObjectNode) product.path("image").path("candidates").get(0)).put("key", "u/product.png");
        c.withArray("assets").add(product);
        ((ObjectNode) c.path("clips").get(0)).withArray("assetIds").add("p1");
        work.setContentJson(c.toString());
        chooseForm(formWithImage("u/bai-yao.png"));
        adoptBoard(boardPrompt(), List.of("u/bai.png", "u/si.png", "u/product.png"), List.of("u/bai-yao.png", "u/si.png", "u/product.png"));
        assertEquals("current", wireBoard().path("adoptedCheck").asText(), "旧指纹也包含商品，不能因合并形态修复而误标过期");
        c = content();
        ((ObjectNode) c.path("assets").get(2).path("image").path("candidates").get(0)).put("key", "u/product-new.png");
        work.setContentJson(c.toString());
        assertEquals("outdated", wireBoard().path("adoptedCheck").asText(), "商品图更换仍须提示更新");
    }

    @Test void boardsMadeBeforeTheFingerprintChangeWithASceneViewStayCurrent() throws Exception {
        seed();
        setSceneView("reverse");
        adoptReverseView();
        adoptBoard(boardPrompt(), List.of("u/bai.png", "u/si.png"), List.of("u/bai.png", "u/si.png", "u/si-reverse.png"));
        assertEquals("current", wireBoard().path("adoptedCheck").asText(), "用视角图生成的");
    }

    @Test void aBoardRevisedFromItsCurrentImageIgnoresTheExtraReference() throws Exception {
        seed();
        adoptBoard(boardPrompt(), List.of("u/bai.png", "u/si.png"), List.of("u/bai.png", "u/si.png", "u/board-old.png"));
        ObjectNode c = content();
        ((ObjectNode) c.path("clips").get(0).path("board").path("candidates").get(0)).put("baseOn", "b0");
        work.setContentJson(c.toString());
        assertEquals("current", wireBoard().path("adoptedCheck").asText());
    }

    @Test void aBoardMadeWithAFormIsOutdatedOnceTheClipGoesBackToTheMainImage() throws Exception {
        seed();
        adoptBoard(boardPrompt(), List.of("u/bai.png", "u/si.png"), List.of("u/bai-yao.png", "u/si.png"));
        assertEquals("outdated", wireBoard().path("adoptedCheck").asText());
    }

    private List<String> values(JsonNode refs, String field) {
        List<String> values = new ArrayList<>();
        for (JsonNode ref : refs) values.add(field == null ? ref.asText() : ref.path(field).asText());
        return values;
    }

    @Test void aClipWithAFormSendsTheFormImageButTheCharacterKeepsItsName() throws Exception {
        seed();
        JsonNode w = edit("form.create", assetId("白素贞"), "{\"name\":\"半妖态\",\"description\":\"下半身化作蛇尾\"}");
        String formId = asset(w, "白素贞").path("forms").get(0).path("id").asText();
        edit("clip.setForm", "k1", "{\"assetId\":\"" + assetId("白素贞") + "\",\"formId\":\"" + formId + "\"}");

        var missing = assertThrows(BusinessException.class, () -> service.task(USER, work.getId(), new DirectorService.TaskRequest("board", "k1", "b0", null, null, 16L)));
        assertEquals("DIRECTOR_REFERENCE_MISSING", missing.getCode());
        assertEquals(List.of("白素贞·半妖态"), ((java.util.Map<?, ?>) missing.getDetails()).get("names"), "缺的是这个形态的图，要说清楚");

        edit("form.upload", formId, "{\"key\":\"u/bai-yao.png\"}");
        service.task(USER, work.getId(), new DirectorService.TaskRequest("board", "k1", "b1", null, null, 16L));
        assertEquals(List.of("u/bai-yao.png", "u/si.png"), submitted().refKeys(), "主形象不再交给模型");
        JsonNode refs = service.get(USER, work.getId()).path("clips").get(0).path("boardRefs");
        assertEquals(submitted().refKeys(), values(refs, "key"));
        assertEquals("白素贞·半妖态", refs.get(0).path("name").asText());
        String prompt = submitted().prompt();
        assertTrue(prompt.contains("「白素贞」"), prompt);
        assertFalse(prompt.contains("半妖态"), "说话人和画内画外都按角色名认，提示词不改名");
    }

    @Test void deletingAFormPutsClipsBackOnTheMainImage() throws Exception {
        seed();
        JsonNode w = edit("form.create", assetId("白素贞"), "{\"name\":\"半妖态\",\"description\":\"\"}");
        String formId = asset(w, "白素贞").path("forms").get(0).path("id").asText();
        edit("clip.setForm", "k1", "{\"assetId\":\"" + assetId("白素贞") + "\",\"formId\":\"" + formId + "\"}");
        JsonNode after = edit("form.delete", formId, "{}");
        assertEquals(0, asset(after, "白素贞").path("forms").size());
        service.task(USER, work.getId(), new DirectorService.TaskRequest("board", "k1", "b2", null, null, 16L));
        assertEquals(List.of("u/bai.png", "u/si.png"), submitted().refKeys());
    }

    @Test void aFormNeedsTheMainImageFirstAndOnlyCharactersHaveForms() throws Exception {
        seed();
        var scene = assertThrows(BusinessException.class, () -> edit("form.create", assetId("金山寺"), "{\"name\":\"雪景\"}"));
        assertEquals("DIRECTOR_INPUT_INVALID", scene.getCode());
        JsonNode w = edit("asset.create", null, "{\"kind\":\"character\",\"name\":\"小青\",\"description\":\"青衣\"}");
        JsonNode x = edit("form.create", asset(w, "小青").path("id").asText(), "{\"name\":\"剑客装\",\"description\":\"短打\"}");
        String formId = asset(x, "小青").path("forms").get(0).path("id").asText();
        var e = assertThrows(BusinessException.class, () -> service.task(USER, work.getId(), new DirectorService.TaskRequest("form-image", formId, "f0", null, null, 16L)));
        assertEquals("DIRECTOR_MAIN_IMAGE_REQUIRED", e.getCode());
    }

    @Test void formImageIsDrawnFromTheMainImage() throws Exception {
        seed();
        JsonNode w = edit("form.create", assetId("白素贞"), "{\"name\":\"半妖态\",\"description\":\"下半身化作蛇尾\"}");
        String formId = asset(w, "白素贞").path("forms").get(0).path("id").asText();
        service.task(USER, work.getId(), new DirectorService.TaskRequest("form-image", formId, "f1", null, null, 16L));
        IpRunService.IpGenerateRequest req = submitted();
        assertEquals(List.of("u/bai.png"), req.refKeys());
        assertEquals("form:" + formId, req.nodeId());
        assertTrue(req.prompt().contains("下半身化作蛇尾"), req.prompt());
        assertTrue(req.prompt().contains("「半妖态」"), req.prompt());
    }

    @Test void aShotOnTheReverseViewUsesThatImageOnlyWhenItExists() throws Exception {
        seed();
        setSceneView("reverse");
        JsonNode before = service.get(USER, work.getId());
        assertTrue(before.path("clips").get(0).path("warnings").toString().contains("反打"), "没图只提醒，不拦");
        service.task(USER, work.getId(), new DirectorService.TaskRequest("board", "k1", "b3", null, null, 16L));
        assertEquals(List.of("u/bai.png", "u/si.png"), submitted().refKeys());

        adoptReverseView();
        JsonNode after = service.get(USER, work.getId());
        assertFalse(after.path("clips").get(0).path("warnings").toString().contains("反打"));
        String prompt = after.path("clips").get(0).path("boardPrompt").asText();
        assertTrue(prompt.contains("金山寺·反打"), prompt);
        assertTrue(prompt.contains("身后是寺门（背景照图3）"), prompt);
        assertEquals("needs-update", after.path("clips").get(0).path("board").path("adoptedCheck").asText("needs-update"));
        service.task(USER, work.getId(), new DirectorService.TaskRequest("board", "k1", "b4", null, null, 16L));
        assertEquals(List.of("u/bai.png", "u/si.png", "u/si-reverse.png"), submitted().refKeys());
    }

    @Test void aClipWithoutFormsOrViewsKeepsItsPromptByteForByte() throws Exception {
        seed();
        String plain = service.get(USER, work.getId()).path("clips").get(0).path("boardPrompt").asText();
        edit("form.create", assetId("白素贞"), "{\"name\":\"半妖态\",\"description\":\"\"}");
        adoptReverseView();
        assertEquals(plain, service.get(USER, work.getId()).path("clips").get(0).path("boardPrompt").asText(), "有形态、有视角图但这一段没用，提示词不变");
    }

    @Test void sceneViewsSplitOneGridIntoThreeAdoptedViews() throws Exception {
        seed();
        String sceneId = assetId("金山寺");
        service.task(USER, work.getId(), new DirectorService.TaskRequest("scene-views", sceneId, "v1", null, null, 16L));
        IpRunService.IpGenerateRequest req = submitted();
        assertEquals("views:" + sceneId, req.nodeId());
        assertEquals(List.of("u/si.png"), req.refKeys());
        assertTrue(req.prompt().contains("反打"), req.prompt());

        Path grid = Files.createTempFile("grid", ".png");
        Files.write(grid, png(200, 100));
        when(storage.openForRead("gen/grid.png")).thenReturn(grid);
        IpRun run = new IpRun();
        run.setId("run-views:" + sceneId); run.setProjectId(work.getId()); run.setNodeId("views:" + sceneId); run.setOwnerUserId(USER);
        run.setKind("generate"); run.setStatus(IpRun.STATUS_DONE); run.setStage("done");
        run.setOutputJson("{\"candidates\":[{\"key\":\"gen/grid.png\"}]}");
        when(runs.findByProjectIdOrderByCreatedAtDesc(any())).thenReturn(new ArrayList<>(List.of(run)));
        when(runs.findById(any())).thenReturn(Optional.of(run));

        JsonNode after = service.get(USER, work.getId());
        JsonNode views = asset(after, "金山寺").path("views");
        for (String v : List.of("reverse", "left", "right")) {
            assertEquals(1, views.path(v).path("candidates").size(), v);
            assertEquals("user", views.path(v).path("adoptedBy").asText(), v);
        }
        assertEquals("u/si.png", asset(after, "金山寺").path("image").path("candidates").get(0).path("key").asText(), "主视不动");
        verify(storage, times(3)).store(any(byte[].class), any(), eq(USER), eq("png"), eq("image/png"));
    }

    @Test void formsFoundByExtractionReachTheReviewAndAreSavedOnTheCharacter() throws Exception {
        seed();
        IpRun run = new IpRun();
        run.setId("run-extract"); run.setProjectId(work.getId()); run.setNodeId("extract"); run.setOwnerUserId(USER); run.setKind("studio-director");
        run.setStatus(IpRun.STATUS_DONE); run.setStage("done");
        run.setInputJson("{\"_director\":{\"task\":\"extract\",\"episodes\":[]}}");
        run.setOutputJson("{\"director\":{\"assets\":[{\"existingId\":null,\"kind\":\"character\",\"name\":\"白素贞\",\"aliases\":[],\"description\":\"白衣\",\"episodeNos\":[1],"
                + "\"forms\":[{\"name\":\"半妖态\",\"description\":\"蛇尾\"},{\"name\":\"不要的\",\"description\":\"\"}]}]}}");
        when(runs.findByProjectIdOrderByCreatedAtDesc(any())).thenReturn(new ArrayList<>(List.of(run)));
        JsonNode review = service.get(USER, work.getId()).path("pendingExtract");
        assertEquals("半妖态", review.path("items").get(0).path("forms").get(0).path("name").asText(), "模型写了就要进确认清单（真模型验收时这里曾被漏掉）");
        JsonNode saved = edit("extract.save", "run-extract", "{\"items\":[{\"itemId\":\"" + review.path("items").get(0).path("itemId").asText() + "\",\"include\":true,\"name\":\"白素贞\",\"droppedForms\":[\"不要的\"]}]}");
        JsonNode forms = asset(saved, "白素贞").path("forms");
        assertEquals(1, forms.size(), "用户在弹窗里去掉的不建");
        assertEquals("半妖态", forms.get(0).path("name").asText());
        assertEquals("蛇尾", forms.get(0).path("description").asText());
    }

    @Test void splitReturnsTheRightThreeCells() throws Exception {
        List<byte[]> cells = DirectorSceneViews.split(png(200, 100));
        assertEquals(3, cells.size());
        assertEquals(Color.RED.getRGB(), corner(cells.get(0)));
        assertEquals(Color.GREEN.getRGB(), corner(cells.get(1)));
        assertEquals(Color.BLUE.getRGB(), corner(cells.get(2)));
        assertThrows(BusinessException.class, () -> DirectorSceneViews.split(new byte[]{1, 2, 3}));
    }

    /** 右上红、左下绿、右下蓝，左上灰。 */
    private static byte[] png(int w, int h) throws Exception {
        BufferedImage image = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.GRAY); g.fillRect(0, 0, w / 2, h / 2);
        g.setColor(Color.RED); g.fillRect(w / 2, 0, w / 2, h / 2);
        g.setColor(Color.GREEN); g.fillRect(0, h / 2, w / 2, h / 2);
        g.setColor(Color.BLUE); g.fillRect(w / 2, h / 2, w / 2, h / 2);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private static int corner(byte[] png) throws Exception {
        return ImageIO.read(new ByteArrayInputStream(png)).getRGB(1, 1);
    }
}
