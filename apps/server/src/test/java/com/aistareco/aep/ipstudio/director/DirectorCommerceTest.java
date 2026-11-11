package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.LibraryObject;
import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.LibraryVersion;
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
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 带货短剧（docs/ai-director-commerce-plan.md）：开关决定商品出不出现；商品来自商品库；写进剧本、分镜的提示词；
 * 商品图和角色、场景图一起交给分镜图和视频。开关关着时提示词和普通作品逐字一样。
 */
class DirectorCommerceTest {
    private static final String USER = "u1";
    private final ObjectMapper om = new ObjectMapper();
    private final DirectorWorkRepository works = mock(DirectorWorkRepository.class);
    private final IpRunRepository runs = mock(IpRunRepository.class);
    private final IpRunService images = mock(IpRunService.class);
    private final StudioWorkflowService text = mock(StudioWorkflowService.class);
    private final IpProjectService projects = mock(IpProjectService.class);
    private final IpLibraryService library = mock(IpLibraryService.class);
    private final StudioVideoService videoModels = mock(StudioVideoService.class);
    private final List<IpRun> stored = new ArrayList<>();
    private DirectorService service;
    private DirectorWork work;
    private int seq;

    @BeforeEach void setUp() {
        when(projects.requireOwnedAssetKey(eq(USER), any())).thenAnswer(i -> i.getArgument(1));
        when(text.directorPrices(any())).thenReturn(new long[]{21, 16});
        when(text.capabilities()).thenReturn(new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Capabilities(false, List.of(), 16, 21, null, List.of(), "selectable", "selectable"));
        when(text.submitDirectorText(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenAnswer(i -> new IpRunDto("IPR-" + (++seq), "DW", i.getArgument(2), "studio-director", "running", "queued", 0, 21, null, null, null, null, null, null, null));
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
        when(runs.findByProjectIdOrderByCreatedAtDesc(any())).thenAnswer(i -> new ArrayList<>(stored));
        when(images.generateForDirector(eq(USER), any(), any())).thenAnswer(i -> {
            IpRunService.IpGenerateRequest req = i.getArgument(2);
            return new IpRunDto("run-" + req.nodeId(), work.getId(), req.nodeId(), "generate", "running", "queued", 0, req.maxCost(),
                    null, null, om.createObjectNode(), om.createObjectNode(), null, null, null);
        });
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("universal_reference_video", false, false, null, null)),
                List.of(new VideoStudioTier("768p", List.of(new VideoStudioCanvas("9:16", 768, 1344)))), 4, 15, 7000, 0L);
        when(videoModels.models()).thenReturn(List.of(new VideoStudioModel("ep-h3", "MiniMax H3", true, true, false, contract, null)));
        service = new DirectorService(works, runs, projects, images, text, mock(StudioWorkflowWorker.class), videoModels,
                mock(StudioFixtureProvider.class), mock(StudioMediaImportService.class), mock(MaterialVideoJobService.class), null, mock(MaterialVideoModelClient.class),
                policy, mock(FileStorageService.class), new IpStudioProperties(), library, om, mock(PlatformTransactionManager.class));
    }

    private JsonNode create(boolean commerce, String idea) {
        return service.create(USER, new DirectorService.CreateRequest("带货", idea, null, null, commerce));
    }

    private JsonNode edit(String op, String target, String data) throws Exception {
        return service.edit(USER, work.getId(), new DirectorService.EditRequest(op, target, null, om.readTree(data)));
    }

    private ObjectNode content() throws Exception { return (ObjectNode) om.readTree(work.getContentJson()); }

    private static LibraryVersion version(String id, String key) { return new LibraryVersion(id, key, "https://x/" + key, "", "", null, false); }

    private void libraryHas(String id, String kind, String name, String mainId, LibraryVersion... versions) {
        when(library.object(USER, id)).thenReturn(new LibraryObject(id, kind, name, name + "的说明", "", null, null, null, mainId, List.of(versions), List.of(), null, "", ""));
    }

    private JsonNode asset(JsonNode w, String name) {
        for (JsonNode a : w.path("assets")) if (name.equals(a.path("name").asText())) return a;
        throw new AssertionError(name);
    }

    /** 一个带货作品：一集正文、角色、场景，商品库里一件保温杯已加进来。 */
    private void seed(boolean addProduct) throws Exception {
        create(true, "");
        ObjectNode c = content();
        c.withArray("episodes").addObject().put("id", "e1").put("no", 1).put("title", "一").put("summary", "").put("content", "周小满拿起保温杯喝了一口。").put("extracted", true).put("rev", 1);
        work.setContentJson(c.toString());
        edit("asset.create", null, "{\"kind\":\"character\",\"name\":\"周小满\",\"description\":\"程序员\",\"image\":{\"key\":\"u/zhou.png\",\"use\":\"asset\"}}");
        edit("asset.create", null, "{\"kind\":\"scene\",\"name\":\"工位\",\"description\":\"开放办公区\",\"image\":{\"key\":\"u/desk.png\",\"use\":\"asset\"}}");
        if (addProduct) {
            libraryHas("o1", "product", "恒温保温杯", "v2", version("v1", "p/side.png"), version("v2", "p/front.png"));
            edit("product.add", null, "{\"objectId\":\"o1\",\"placement\":\"加班时喝水\"}");
        }
    }

    private void addClip(String... names) throws Exception {
        ObjectNode c = content();
        int no = c.path("clips").size() + 1;
        ObjectNode clip = c.withArray("clips").addObject().put("id", "k" + no).put("episodeId", "e1").put("order", no).put("title", "加班").put("summary", "").put("durationSec", 6)
                .put("boardPrompt", "").put("boardPromptCustom", false).put("videoPrompt", "").put("videoPromptCustom", false).put("rev", 1);
        var ids = clip.putArray("assetIds");
        for (String n : names) ids.add(asset(c, n).path("id").asText());
        clip.putArray("issues");
        for (int i = 0; i < 2; i++) clip.withArray("shots").addObject().put("id", "s" + i).put("durationSec", 3).put("size", "近景").put("camera", "平视，固定机位").put("action", "拿起杯子").put("still", "周小满手里的杯子").putArray("dialogue");
        clip.putObject("board").putArray("candidates"); clip.putObject("video").putArray("candidates");
        work.setContentJson(c.toString());
    }

    private IpRunService.IpGenerateRequest submittedImage() {
        ArgumentCaptor<IpRunService.IpGenerateRequest> req = ArgumentCaptor.forClass(IpRunService.IpGenerateRequest.class);
        verify(images, atLeastOnce()).generateForDirector(eq(USER), any(), req.capture());
        return req.getValue();
    }

    private record Sent(String system, String user, ObjectNode meta) {}

    private Sent submittedText() {
        ArgumentCaptor<String> system = ArgumentCaptor.forClass(String.class), user = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<ObjectNode> meta = ArgumentCaptor.forClass(ObjectNode.class);
        verify(text, atLeastOnce()).submitDirectorText(any(), any(), any(), system.capture(), user.capture(), any(), meta.capture(), any(), any(), any());
        return new Sent(system.getValue(), user.getValue(), meta.getValue());
    }

    private JsonNode runTask(String type, String target, String options) throws Exception {
        return service.task(USER, work.getId(), new DirectorService.TaskRequest(type, target, "r" + (++seq), om.readTree(options), null, 500L));
    }

    // ── 开关 ──

    @Test void offByDefaultAndCreateOrSettingsTurnItOn() {
        JsonNode plain = service.create(USER, new DirectorService.CreateRequest("普通", "", null));
        assertFalse(plain.path("settings").path("commerce").asBoolean(false));
        JsonNode on = service.patch(USER, work.getId(), new DirectorService.PatchRequest(null, null, null, null, om.createObjectNode().put("commerce", true)));
        assertTrue(on.path("settings").path("commerce").asBoolean());
        assertTrue(create(true, "").path("settings").path("commerce").asBoolean());
    }

    @Test void productsCanOnlyBeAddedWhenTheSwitchIsOn() throws Exception {
        service.create(USER, new DirectorService.CreateRequest("普通", "", null));
        libraryHas("o1", "product", "恒温保温杯", "v1", version("v1", "p/a.png"));
        var e = assertThrows(BusinessException.class, () -> edit("product.add", null, "{\"objectId\":\"o1\"}"));
        assertEquals("DIRECTOR_INPUT_INVALID", e.getCode());
        // 只差开关：打开后同样的请求能加上，上面拦住的就是开关。
        service.patch(USER, work.getId(), new DirectorService.PatchRequest(null, null, null, null, om.createObjectNode().put("commerce", true)));
        edit("product.add", null, "{\"objectId\":\"o1\"}");
        assertEquals(1, content().path("assets").size());
    }

    @Test void turningOffKeepsProductsAndClipsAndStopsFeedingPrompts() throws Exception {
        seed(true);
        addClip("周小满", "工位", "恒温保温杯");
        JsonNode off = service.patch(USER, work.getId(), new DirectorService.PatchRequest(null, null, null, null, om.createObjectNode().put("commerce", false)));
        assertEquals("恒温保温杯", asset(off, "恒温保温杯").path("name").asText(), "商品数据保留");
        assertEquals(3, off.path("clips").get(0).path("assetIds").size(), "已关联的片段不动");
        runTask("plan", "e1", "{}");
        Sent sent = submittedText();
        assertFalse(sent.system().contains("带货短剧"), "关掉之后不再拼商品规则");
        assertFalse(sent.user().contains("恒温保温杯"), "写分镜不再带商品");
        assertFalse(om.convertValue(sent.meta().path("assetIds"), List.class).contains(asset(content(), "恒温保温杯").path("id").asText()));
    }

    @Test void theWorkListCountsAssetsWithoutProducts() throws Exception {
        seed(true);
        when(works.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(USER)).thenReturn(List.of(work));
        JsonNode summary = service.list(USER).get(0);
        assertEquals(2, summary.path("assetCount").asInt(), "角色和场景，不算商品");
        assertTrue(summary.path("commerce").asBoolean());
    }

    // ── 商品库 ──

    @Test void addingTakesEveryImageFromTheLibraryAndUsesTheMainOne() throws Exception {
        seed(true);
        JsonNode p = asset(content(), "恒温保温杯");
        assertEquals("product", p.path("kind").asText());
        assertEquals("o1", p.path("libraryObjectId").asText());
        assertEquals("恒温保温杯的说明", p.path("description").asText());
        assertEquals("加班时喝水", p.path("placement").asText());
        JsonNode slot = p.path("image");
        assertEquals(2, slot.path("candidates").size());
        assertEquals("library", slot.path("candidates").get(0).path("source").asText());
        String adopted = slot.path("adoptedId").asText();
        assertEquals("p/front.png", slot.path("candidates").get(1).path("key").asText());
        assertEquals(slot.path("candidates").get(1).path("id").asText(), adopted, "默认用商品库的主图");
        assertEquals("user", slot.path("adoptedBy").asText(), "商品图不用再确认");
    }

    @Test void addingAgainSyncsTheLibraryButKeepsThisWorksChoices() throws Exception {
        seed(true);
        JsonNode before = asset(content(), "恒温保温杯");
        String side = before.path("image").path("candidates").get(0).path("id").asText();
        edit("asset.adopt", before.path("id").asText(), "{\"candidateId\":\"" + side + "\"}");
        libraryHas("o1", "product", "恒温保温杯 Pro", "v3", version("v1", "p/side.png"), version("v2", "p/front.png"), version("v3", "p/box.png"));
        edit("product.add", null, "{\"objectId\":\"o1\"}");
        ObjectNode c = content();
        long products = 0;
        for (JsonNode a : c.path("assets")) if ("product".equals(a.path("kind").asText())) products++;
        assertEquals(1, products, "同一件商品不重复");
        JsonNode p = asset(c, "恒温保温杯 Pro");
        assertEquals(3, p.path("image").path("candidates").size());
        assertEquals(side, p.path("image").path("adoptedId").asText(), "本剧选的图不变");
        assertEquals("加班时喝水", p.path("placement").asText(), "植入想法只属于这部剧");
    }

    @Test void onlyProductsWithImagesCanBeAdded() throws Exception {
        create(true, "");
        libraryHas("o1", "prop", "玉佩", "v1", version("v1", "p/a.png"));
        assertEquals("DIRECTOR_INPUT_INVALID", assertThrows(BusinessException.class, () -> edit("product.add", null, "{\"objectId\":\"o1\"}")).getCode());
        libraryHas("o2", "product", "空商品", null);
        assertEquals("DIRECTOR_INPUT_INVALID", assertThrows(BusinessException.class, () -> edit("product.add", null, "{\"objectId\":\"o2\"}")).getCode());
        assertEquals(0, content().path("assets").size());
        // 只差类型和图片：有图的商品能加上。
        libraryHas("o3", "product", "恒温保温杯", "v1", version("v1", "p/a.png"));
        edit("product.add", null, "{\"objectId\":\"o3\"}");
        assertEquals(1, content().path("assets").size());
    }

    @Test void placementIsOnlyForProductsAndProductsAreNeverGenerated() throws Exception {
        seed(true);
        String character = asset(content(), "周小满").path("id").asText(), product = asset(content(), "恒温保温杯").path("id").asText();
        long characterRev = asset(content(), "周小满").path("rev").asLong(), productRev = asset(content(), "恒温保温杯").path("rev").asLong();
        assertThrows(BusinessException.class, () -> service.edit(USER, work.getId(), new DirectorService.EditRequest("asset.update", character, characterRev, om.readTree("{\"placement\":\"x\"}"))));
        service.edit(USER, work.getId(), new DirectorService.EditRequest("asset.update", product, productRev, om.readTree("{\"placement\":\"下班路上喝\"}")));
        assertEquals("下班路上喝", asset(content(), "恒温保温杯").path("placement").asText());
        assertEquals("DIRECTOR_INPUT_INVALID", assertThrows(BusinessException.class, () -> runTask("asset-image", product, "{}")).getCode());
        assertThrows(BusinessException.class, () -> edit("asset.create", null, "{\"kind\":\"product\",\"name\":\"手写商品\"}"));
        assertEquals("", asset(content(), "恒温保温杯").path("prompt").asText(), "商品没有出图提示词");
    }

    // ── 参考图 ──

    @Test void theBoardGetsTheChosenProductImageAfterCharactersAndScenes() throws Exception {
        seed(true);
        addClip("恒温保温杯", "周小满", "工位");
        runTask("board", "k1", "{}");
        IpRunService.IpGenerateRequest req = submittedImage();
        assertEquals(List.of("u/zhou.png", "u/desk.png", "p/front.png"), req.refKeys());
        assertTrue(req.prompt().contains("图3 提供商品「恒温保温杯」的外形、颜色、包装和标签"), req.prompt());
        assertTrue(req.prompt().contains("商品和参考图保持一致"), req.prompt());
    }

    @Test void changingTheProductImageChangesTheReferenceAndMarksTheBoardOutdated() throws Exception {
        seed(true);
        addClip("周小满", "工位", "恒温保温杯");
        JsonNode p = asset(content(), "恒温保温杯");
        runTask("board", "k1", "{}");
        edit("asset.adopt", p.path("id").asText(), "{\"candidateId\":\"" + p.path("image").path("candidates").get(0).path("id").asText() + "\"}");
        runTask("board", "k1", "{}");
        assertEquals(List.of("u/zhou.png", "u/desk.png", "p/side.png"), submittedImage().refKeys());
    }

    @Test void theVideoPromptNamesTheProductReferenceAndOtherClipsStayTheSame() throws Exception {
        seed(true);
        addClip("周小满", "工位", "恒温保温杯");
        addClip("周小满", "工位");
        JsonNode w = service.get(USER, work.getId());
        String with = w.path("clips").get(0).path("videoPrompt").asText(), without = w.path("clips").get(1).path("videoPrompt").asText();
        assertTrue(with.contains("商品「恒温保温杯」：外观、包装和标签照参考图4。"), with);
        assertFalse(without.contains("商品"), "没关联商品的片段不多一个字");
        assertFalse(w.path("clips").get(1).path("boardPrompt").asText().contains("商品"));
    }

    @Test void theVideoRequestCarriesTheProductImageWithTheStoryboardFirst() throws Exception {
        seed(true);
        addClip("周小满", "工位", "恒温保温杯");
        ObjectNode c = content();
        ObjectNode clip = (ObjectNode) c.path("clips").get(0);
        ObjectNode board = clip.putObject("board");
        board.putArray("candidates").addObject().put("id", "b1").put("key", "u/board.png").put("source", "generated");
        board.put("adoptedId", "b1").put("adoptedBy", "user");
        work.setContentJson(c.toString());
        when(images.generateVideoForDirector(anyString(), anyString(), anyString(), any()))
                .thenReturn(om.createObjectNode().put("id", "mvj_1").put("stage", "queued").put("progress_pct", 0));
        ArgumentCaptor<IpRunService.IpVideoRequest> req = ArgumentCaptor.forClass(IpRunService.IpVideoRequest.class);
        runTask("video", "k1", "{}");
        verify(images).generateVideoForDirector(anyString(), anyString(), anyString(), req.capture());
        List<String> keys = new ArrayList<>();
        req.getValue().video().references().forEach(r -> keys.add(r.key()));
        assertEquals(List.of("u/board.png", "u/zhou.png", "u/desk.png", "p/front.png"), keys, "图1 分镜图，然后是角色、场景、商品");
    }

    @Test void theEnglishRewriteListsTheProductImageButNotItsSellingPoints() throws Exception {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("universal_reference_video", false, false, null, null)),
                List.of(new VideoStudioTier("768p", List.of(new VideoStudioCanvas("9:16", 768, 1344)))), 4, 15, 7000, 0L);
        when(videoModels.models()).thenReturn(List.of(new VideoStudioModel("ep-h3", "MiniMax H3", true, true, true, contract, null)));
        seed(true);
        addClip("周小满", "工位", "恒温保温杯");
        ObjectNode c = content();
        ObjectNode board = ((ObjectNode) c.path("clips").get(0)).putObject("board");
        board.putArray("candidates").addObject().put("id", "b1").put("key", "u/board.png").put("source", "generated");
        board.put("adoptedId", "b1").put("adoptedBy", "user");
        work.setContentJson(c.toString());
        runTask("video", "k1", "{}");
        String user = submittedText().user();
        assertTrue(user.contains("<Picture 4>: reference image of the product 「恒温保温杯」; keep its shape, colors, packaging and label exactly as shown."), user);
        assertFalse(user.contains("恒温保温杯的说明"), "卖点不交给视频模型，可能被画成字幕");
    }

    // ── 提示词 ──

    @Test void theScriptPromptWeavesProductsInOnlyWhenThereAreSome() throws Exception {
        create(true, "加班的程序员");
        runTask("script", null, "{\"skip\":true}");
        Sent none = submittedText();
        assertFalse(none.system().contains("带货短剧"), "开关开着但没有商品：和普通作品一样");
        assertFalse(none.user().contains("products"));

        clearInvocations(text);
        create(true, "加班的程序员");
        libraryHas("o1", "product", "恒温保温杯", "v1", version("v1", "p/a.png"));
        edit("product.add", null, "{\"objectId\":\"o1\",\"placement\":\"加班时喝水\"}");
        runTask("script", null, "{\"skip\":true}");
        Sent sent = submittedText();
        assertTrue(sent.system().contains("【带货短剧：把商品写进剧情】"), sent.system());
        assertFalse(sent.system().contains("掉漆"), "Agnes 实测：示例和规则里出现这个词，模型就把商品写成掉漆的");
        assertTrue(sent.user().contains("恒温保温杯") && sent.user().contains("加班时喝水") && sent.user().contains("恒温保温杯的说明"), sent.user());
        assertEquals("恒温保温杯", sent.meta().path("products").get(0).asText());
    }

    @Test void theStoryboardPromptAndInputCarryProducts() throws Exception {
        seed(true);
        runTask("plan", "e1", "{}");
        Sent sent = submittedText();
        assertTrue(sent.system().contains("kind 为 product 的是要植入的商品"), sent.system());
        assertTrue(sent.user().contains("\"kind\":\"product\"") && sent.user().contains("加班时喝水"), sent.user());
    }

    @Test void onlyHavingProductsDoesNotCountAsHavingAssets() throws Exception {
        create(true, "");
        ObjectNode c = content();
        c.withArray("episodes").addObject().put("id", "e1").put("no", 1).put("title", "一").put("summary", "").put("content", "正文").put("rev", 1);
        work.setContentJson(c.toString());
        libraryHas("o1", "product", "恒温保温杯", "v1", version("v1", "p/a.png"));
        edit("product.add", null, "{\"objectId\":\"o1\"}");
        BusinessException e = assertThrows(BusinessException.class, () -> runTask("plan", "e1", "{}"));
        assertEquals("DIRECTOR_ASSETS_MISSING", e.getCode());
    }

    private ObjectNode plannedShot(String action, String line) {
        ObjectNode shot = om.createObjectNode().put("durationSec", 4).put("size", "近景").put("camera", "固定").put("action", action).put("still", "画面");
        var d = shot.putArray("dialogue");
        if (line != null) d.addObject().putNull("speakerId").put("text", line);
        return shot;
    }

    private JsonNode finishPlan(ObjectNode... shots) throws Exception {
        runTask("plan", "e1", "{}");
        ObjectNode meta = submittedText().meta();
        ObjectNode output = om.createObjectNode();
        ObjectNode clip = output.putArray("clips").addObject().put("title", "加班").put("summary", "周小满加班");
        clip.putArray("assetIds").add(asset(content(), "周小满").path("id").asText());
        var list = clip.putArray("shots");
        for (ObjectNode s : shots) list.add(s);
        ObjectNode input = om.createObjectNode();
        input.set("_director", meta);
        ObjectNode out = om.createObjectNode();
        out.set("director", DirectorPrompts.validate(om, meta, output));
        stored.add(IpRun.builder().id("IPR-" + seq).projectId(work.getId()).hostType(IpRun.HOST_DIRECTOR).ownerUserId(USER).nodeId("plan:e1")
                .kind("studio-director").status(IpRun.STATUS_DONE).stage("done").cost(3).inputJson(om.writeValueAsString(input))
                .outputJson(om.writeValueAsString(out)).createdAt(Instant.now()).build());
        return service.get(USER, work.getId());
    }

    @Test void aClipThatMentionsAProductGetsLinkedEvenIfTheModelForgot() throws Exception {
        seed(true);
        JsonNode w = finishPlan(plannedShot("周小满拧开保温杯喝了一口", null), plannedShot("他放下杯子", null), plannedShot("他看向窗外", null));
        assertTrue(om.convertValue(w.path("clips").get(0).path("assetIds"), List.class).contains(asset(w, "恒温保温杯").path("id").asText()), "写到简称也关联");
    }

    @Test void aClipThatDoesNotMentionTheProductStaysUnlinked() throws Exception {
        seed(true);
        JsonNode w = finishPlan(plannedShot("周小满揉了揉太阳穴", "还有个 bug 要修"), plannedShot("他看向窗外", null), plannedShot("他叹了口气", null));
        assertEquals(1, w.path("clips").get(0).path("assetIds").size());
    }

    @Test void mentionsDoNotLinkWhenTheSwitchIsOff() throws Exception {
        seed(true);
        service.patch(USER, work.getId(), new DirectorService.PatchRequest(null, null, null, null, om.createObjectNode().put("commerce", false)));
        JsonNode w = finishPlan(plannedShot("周小满拧开保温杯喝了一口", null), plannedShot("他放下杯子", null), plannedShot("他看向窗外", null));
        assertEquals(1, w.path("clips").get(0).path("assetIds").size());
    }

    // ── 提取资产 ──

    private JsonNode finishExtract(ObjectNode modelOutput) throws Exception {
        runTask("extract", null, "{}");
        ObjectNode meta = submittedText().meta();
        ObjectNode input = om.createObjectNode();
        input.set("_director", meta);
        ObjectNode out = om.createObjectNode();
        out.set("director", DirectorPrompts.validate(om, meta, modelOutput));
        stored.add(IpRun.builder().id("IPR-" + seq).projectId(work.getId()).hostType(IpRun.HOST_DIRECTOR).ownerUserId(USER).nodeId("extract")
                .kind("studio-director").status(IpRun.STATUS_DONE).stage("done").cost(3).inputJson(om.writeValueAsString(input))
                .outputJson(om.writeValueAsString(out)).createdAt(Instant.now()).build());
        return service.get(USER, work.getId());
    }

    private ObjectNode item(String existingId, String kind, String name) {
        ObjectNode a = om.createObjectNode().put("kind", kind).put("name", name).put("description", "模型写的外观");
        if (existingId == null) a.putNull("existingId"); else a.put("existingId", existingId);
        a.putArray("aliases"); a.putArray("episodeNos").add(1);
        return a;
    }

    @Test void theExtractPromptKnowsAboutProducts() throws Exception {
        seed(true);
        runTask("extract", null, "{}");
        Sent sent = submittedText();
        assertTrue(sent.system().contains("不要把它提取成道具"), sent.system());
        assertTrue(sent.user().contains("\"kind\":\"product\""), sent.user());
    }

    @Test void aProductTheModelCalledAPropMergesIntoTheProductWithoutChangingIt() throws Exception {
        seed(true);
        ObjectNode output = om.createObjectNode();
        var list = output.putArray("assets");
        list.add(item(null, "prop", "保温杯"));
        list.add(item(null, "prop", "工牌"));
        JsonNode w = finishExtract(output);
        JsonNode pending = w.path("pendingExtract").path("items");
        assertEquals("product", pending.get(0).path("kind").asText(), "按名称对上商品，算商品");
        assertEquals(asset(w, "恒温保温杯").path("id").asText(), pending.get(0).path("matchId").asText());
        assertEquals("prop", pending.get(1).path("kind").asText(), "其他道具照常");

        ObjectNode picks = om.createObjectNode();
        var arr = picks.putArray("items");
        pending.forEach(i -> arr.addObject().put("itemId", i.path("itemId").asText()).put("include", true).put("name", i.path("name").asText()));
        JsonNode saved = service.edit(USER, work.getId(), new DirectorService.EditRequest("extract.save", w.path("pendingExtract").path("runId").asText(), null, picks));
        JsonNode product = asset(saved, "恒温保温杯");
        assertEquals("恒温保温杯的说明", product.path("description").asText(), "商品说明不被模型写的外观覆盖");
        assertTrue(om.convertValue(product.path("aliases"), List.class).contains("保温杯"), "模型的叫法记成别名");
        assertEquals("e1", product.path("episodeIds").get(0).asText());
        long props = 0;
        for (JsonNode a : saved.path("assets")) if ("prop".equals(a.path("kind").asText())) props++;
        assertEquals(1, props, "没有多出一个叫保温杯的道具");
    }

    @Test void theModelCannotInventAProduct() throws Exception {
        seed(true);
        String id = asset(content(), "恒温保温杯").path("id").asText();
        ObjectNode meta = om.createObjectNode().put("task", "extract");
        meta.putArray("existingIds").add(id);
        meta.putArray("episodeNos").add(1);
        ObjectNode output = om.createObjectNode();
        var list = output.putArray("assets");
        list.add(item(id, "product", "恒温保温杯"));
        list.add(item(null, "product", "凭空的商品"));
        JsonNode result = DirectorPrompts.validate(om, meta, output);
        assertEquals(1, result.path("assets").size());
        assertEquals(id, result.path("assets").get(0).path("existingId").asText());
    }
}
