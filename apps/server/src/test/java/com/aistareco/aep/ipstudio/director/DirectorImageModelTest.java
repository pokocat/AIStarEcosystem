package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.materialvideo.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 导演台的图片模型选择。2026-10-26 线上：作品选了只有 16:9 / 9:16 两种尺寸的 4K 接入点，
 * 「生成全部参考图」里三个道具（固定 1:1）全部失败，报错还让用户去改道具根本不读的作品画幅。
 */
class DirectorImageModelTest {
    private final ObjectMapper om = new ObjectMapper();
    private final DirectorWorkRepository works = mock(DirectorWorkRepository.class);
    private final IpRunRepository runs = mock(IpRunRepository.class);
    private final IpRunService images = mock(IpRunService.class);
    private final StudioWorkflowService text = mock(StudioWorkflowService.class);
    private final AiAppSceneModelPolicyService policy = mock(AiAppSceneModelPolicyService.class);
    private DirectorService service;
    private DirectorWork work;
    private final AtomicInteger runSeq = new AtomicInteger();

    /** 标准接入点：方图、横图、竖图都有，同一比例有大小两档。 */
    private static final String[][] STANDARD = {{"1024x1024","1:1"},{"2048x2048","1:1"},{"1360x768","16:9"},{"2048x1152","16:9"},{"1152x2048","9:16"}};
    /** 4K 接入点的真实规格：只有横竖两种，没有方图。 */
    private static final String[][] FOUR_K = {{"3840x2160","16:9"},{"2160x3840","9:16"}};

    private AiAppSceneModelPolicyService.Selection selection(String id, String name, long cost, boolean isDefault, String[][] outputs) {
        StringBuilder spec = new StringBuilder("{\"promptMaxChars\":16000,\"minReferenceImages\":0,\"maxReferenceImages\":14,\"referenceField\":\"multiple\",\"outputs\":[");
        for (int i = 0; i < outputs.length; i++)
            spec.append(i == 0 ? "" : ",").append("{\"canvasSize\":\"").append(outputs[i][0]).append("\",\"aspectRatio\":\"").append(outputs[i][1]).append("\",\"providerFields\":{}}");
        var endpoint = AiModelEndpoint.builder().id(id).name(id).modelAlias(name).model(id).enabled(true).baseUrl("https://example.com/v1")
                .imageRequestSpecJson(spec.append("]}").toString()).build();
        return new AiAppSceneModelPolicyService.Selection(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, isDefault), cost, "per_image");
    }

    /** 场景里开放三个：两个标准接入点和一个 4K；retired 已停用。价格都从场景配置来。 */
    private void stubPolicy(String defaultId) {
        Map<String, AiAppSceneModelPolicyService.Selection> byId = new LinkedHashMap<>();
        byId.put("default-image", selection("default-image", "标准模型", 16, "default-image".equals(defaultId), STANDARD));
        byId.put("chosen-image", selection("chosen-image", "另一标准模型", 37, "chosen-image".equals(defaultId),
                new String[][]{{"2048x2048","1:1"},{"2560x1440","16:9"},{"1440x2560","9:16"}}));
        byId.put("image-4k", selection("image-4k", "GPT Image 2 4K", 55, "image-4k".equals(defaultId), FOUR_K));
        when(policy.available(eq("studio"), eq("image"), anyLong())).thenReturn(List.copyOf(byId.values()));
        when(policy.resolve(eq("studio"), eq("image"), nullable(String.class), anyLong())).thenAnswer(i -> {
            String id = i.getArgument(2);
            var hit = byId.get(id == null ? defaultId : id);
            if (hit == null) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "ENDPOINT_NOT_ALLOWED", "所选模型不在场景开放范围内");
            return hit;
        });
    }

    @BeforeEach void setUp() {
        when(text.directorPrices(any())).thenReturn(new long[]{21, 16});
        when(text.capabilities()).thenReturn(new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Capabilities(false, List.of(), 16, 21, null, List.of(), "selectable", "selectable"));
        stubPolicy("default-image");
        when(works.save(any())).thenAnswer(i -> { work = i.getArgument(0); return work; });
        when(works.lockById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(works.findById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(images.generateForDirector(eq("u1"), any(), any())).thenAnswer(i -> {
            IpRunService.IpGenerateRequest req = i.getArgument(2);
            return new IpRunDto("run-" + runSeq.incrementAndGet(), work.getId(), req.nodeId(), "generate", "running", "queued", 0, req.maxCost(),
                    null, null, om.createObjectNode(), om.createObjectNode(), null, null, null);
        });
        service = new DirectorService(works, runs, mock(IpProjectService.class), images, text, mock(StudioWorkflowWorker.class), mock(StudioVideoService.class),
                mock(StudioFixtureProvider.class), mock(StudioMediaImportService.class), mock(MaterialVideoJobService.class), null, mock(MaterialVideoModelClient.class),
                policy, mock(FileStorageService.class), new IpStudioProperties(), mock(IpLibraryService.class), om, mock(PlatformTransactionManager.class));
        service.create("u1", new DirectorService.CreateRequest("模型选择验收", "", null));
    }

    private ObjectNode content() throws Exception { return (ObjectNode) om.readTree(work.getContentJson()); }

    /** 直接改存着的内容：模拟旧客户端或回滚前存下的选择，绕过现在的保存校验。 */
    private void edit(java.util.function.Consumer<ObjectNode> change) throws Exception {
        ObjectNode c = content();
        change.accept(c);
        work.setContentJson(om.writeValueAsString(c));
    }

    private void storedImageModel(String id) throws Exception { edit(c -> ((ObjectNode) c.path("settings")).put("imageModel", id)); }

    private void asset(String id, String kind, String name) throws Exception {
        edit(c -> {
            ObjectNode a = c.withArray("assets").addObject().put("id", id).put("kind", kind).put("name", name).put("description", name)
                    .put("prompt", name).put("rev", 1);
            a.putArray("aliases");
            a.putObject("image").putArray("candidates");
        });
    }

    private JsonNode patch(ObjectNode settings) {
        return service.patch("u1", work.getId(), new DirectorService.PatchRequest(null, null, null, null, settings));
    }

    private JsonNode generate(String type, String target, long maxCost) {
        return service.task("u1", work.getId(), new DirectorService.TaskRequest(type, target, "req-" + type + "-" + target, null, null, maxCost));
    }

    private IpRunService.IpGenerateRequest lastSubmitted() {
        var sent = ArgumentCaptor.forClass(IpRunService.IpGenerateRequest.class);
        verify(images, atLeastOnce()).generateForDirector(eq("u1"), eq(work.getId()), sent.capture());
        return sent.getValue();
    }

    @Test void choosingImageModelUpdatesSavedSelectionAndPrice() {
        var saved = patch(om.createObjectNode().put("imageModel", "chosen-image"));
        assertEquals("chosen-image", saved.path("settings").path("imageModel").asText());
        assertEquals(37, saved.path("pricing").path("image").asLong());
        var reset = patch(om.createObjectNode().putNull("imageModel"));
        assertEquals(16, reset.path("pricing").path("image").asLong());
    }

    @Test void onlyModelsThatCanMakeSquareWideAndTallImagesAreOffered() throws Exception {
        var view = patch(om.createObjectNode());
        List<String> offered = new ArrayList<>();
        view.path("imageModels").forEach(m -> offered.add(m.path("id").asText()));
        assertEquals(List.of("default-image", "chosen-image"), offered);

        var e = assertThrows(BusinessException.class, () -> patch(om.createObjectNode().put("imageModel", "image-4k")));
        assertEquals("DIRECTOR_IMAGE_MODEL_UNSUPPORTED", e.getCode());
        assertEquals(List.of("1:1"), ((Map<?, ?>) e.getDetails()).get("missingRatios"));
        assertTrue(content().path("settings").path("imageModel").isNull());

        var unknown = assertThrows(BusinessException.class, () -> patch(om.createObjectNode().put("imageModel", "hidden")));
        assertEquals("DIRECTOR_INPUT_INVALID", unknown.getCode());
        verifyNoInteractions(images);
    }

    @Test void standardModelGivesEachAssetClassItsLargestSizeOfTheRightRatioAtOnePrice() throws Exception {
        asset("p1", "prop", "修复编号工作本");
        asset("c1", "character", "林夏");
        generate("asset-image", "p1", 16);
        assertEquals("2048x2048", lastSubmitted().size());
        assertEquals("default-image", lastSubmitted().model());
        assertEquals(16L, lastSubmitted().maxCost());
        generate("asset-image", "c1", 16);
        assertEquals("2048x1152", lastSubmitted().size());
        assertEquals("default-image", lastSubmitted().model());
    }

    @Test void selectedModelIsActuallySubmittedWithItsOwnSizeAndApprovedPrice() throws Exception {
        storedImageModel("chosen-image");
        asset("as1", "scene", "庭院");
        generate("asset-image", "as1", 37);
        assertEquals("chosen-image", lastSubmitted().model());
        assertEquals("2560x1440", lastSubmitted().size());
        assertEquals(37L, lastSubmitted().maxCost());
    }

    @Test void savedFourKSelectionKeepsItsOwnEndpointAndPriceForWideImages() throws Exception {
        storedImageModel("image-4k");
        var view = patch(om.createObjectNode());
        assertEquals(55, view.path("pricing").path("image").asLong());
        assertArrayEquals(new long[]{21, 55}, service.directorPrices(content()));
        JsonNode state = view.path("imageModelState");
        assertEquals("image-4k", state.path("id").asText());
        assertTrue(state.path("explicit").asBoolean());
        assertTrue(state.path("available").asBoolean());
        assertEquals(55, state.path("creditCost").asLong());
        assertEquals("[\"1:1\"]", state.path("missingRatios").toString());

        asset("c1", "character", "林夏");
        generate("asset-image", "c1", 55);
        assertEquals("image-4k", lastSubmitted().model());
        assertEquals("3840x2160", lastSubmitted().size());
        assertEquals(55L, lastSubmitted().maxCost());
    }

    @Test void propOnAModelWithoutSquareSizesIsRefusedBeforeAnythingIsSubmitted() throws Exception {
        storedImageModel("image-4k");
        asset("p1", "prop", "修复编号工作本");
        var e = assertThrows(BusinessException.class, () -> generate("asset-image", "p1", 55));
        assertEquals("STUDIO_IMAGE_SIZE_UNSUPPORTED", e.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertTrue(e.getMessage().startsWith("作品设置里选的图片模型「GPT Image 2 4K」不能出 1:1 方图"), e.getMessage());
        assertTrue(e.getMessage().contains("换一个能出方图的图片模型"), e.getMessage());
        assertFalse(e.getMessage().contains("画幅"), "道具不读作品画幅，不能让用户去改它：" + e.getMessage());
        assertEquals("prop", ((Map<?, ?>) e.getDetails()).get("kind"));
        verifyNoInteractions(images);
        verify(runs, never()).save(any());
    }

    @Test void boardFollowsTheWorkAspectAndOnlyThenSuggestsChangingIt() throws Exception {
        storedImageModel("image-4k");
        edit(c -> {
            ObjectNode clip = c.withArray("clips").addObject().put("id", "k1").put("episodeId", "ep1").put("order", 1).put("rev", 1)
                    .put("boardPrompt", "雨夜老宅门口");
            clip.putArray("issues");
            clip.putArray("assetIds");
            clip.putArray("shots").addObject().put("durationSec", 3).put("size", "中景").put("action", "她推开门").putArray("dialogue");
            clip.putObject("board").putArray("candidates");
            ObjectNode video = clip.putObject("video");
            video.putArray("candidates");
            video.putArray("pending");
        });
        generate("board", "k1", 55);
        assertEquals("2160x3840", lastSubmitted().size());
        assertEquals("image-4k", lastSubmitted().model());

        edit(c -> ((ObjectNode) c.path("settings")).put("aspectRatio", "1:1"));
        var e = assertThrows(BusinessException.class, () -> service.task("u1", work.getId(),
                new DirectorService.TaskRequest("board", "k1", "req-board-square", null, null, 55L)));
        assertEquals("STUDIO_IMAGE_SIZE_UNSUPPORTED", e.getCode());
        assertTrue(e.getMessage().contains("分镜图跟作品画幅走。请在作品设置里换一个画幅，或换一个图片模型"), e.getMessage());
        verify(images, times(1)).generateForDirector(any(), any(), any());
    }

    @Test void savedSelectionThatIsNoLongerOfferedDoesNotBlockSavingOtherSettings() throws Exception {
        storedImageModel("image-4k");
        var resent = patch(om.createObjectNode().put("style", "国风水墨").put("imageModel", "image-4k"));
        assertEquals("国风水墨", resent.path("settings").path("style").asText());
        assertEquals("image-4k", resent.path("settings").path("imageModel").asText());
        var omitted = patch(om.createObjectNode().put("aspectRatio", "16:9"));
        assertEquals("image-4k", omitted.path("settings").path("imageModel").asText());
        assertEquals(55, omitted.path("pricing").path("image").asLong());
    }

    @Test void defaultModelWithoutSquareSizesIsReportedAndNotSwappedForAnother() throws Exception {
        stubPolicy("image-4k");
        var view = patch(om.createObjectNode());
        view.path("imageModels").forEach(m -> assertNotEquals("image-4k", m.path("id").asText()));
        JsonNode state = view.path("imageModelState");
        assertFalse(state.path("explicit").asBoolean());
        assertEquals("image-4k", state.path("id").asText());
        assertEquals("[\"1:1\"]", state.path("missingRatios").toString());
        assertEquals(55, view.path("pricing").path("image").asLong());

        asset("p1", "prop", "母亲旧毛衣");
        asset("c1", "character", "林夏");
        var e = assertThrows(BusinessException.class, () -> generate("asset-image", "p1", 55));
        assertEquals("STUDIO_IMAGE_SIZE_UNSUPPORTED", e.getCode());
        assertTrue(e.getMessage().startsWith("默认图片模型「GPT Image 2 4K」不能出 1:1 方图"), e.getMessage());
        verifyNoInteractions(images);
        generate("asset-image", "c1", 55);
        assertEquals("image-4k", lastSubmitted().model());
    }

    @Test void retiredSavedModelIsShownAsUnavailableAndCannotGenerate() throws Exception {
        storedImageModel("retired");
        var view = patch(om.createObjectNode().put("style", "国风水墨").put("imageModel", "retired"));
        assertEquals("国风水墨", view.path("settings").path("style").asText());
        assertEquals("retired", view.path("settings").path("imageModel").asText());
        assertFalse(view.path("imageModelState").path("available").asBoolean());
        assertTrue(view.path("imageModelState").path("explicit").asBoolean());

        asset("c1", "character", "林夏");
        var e = assertThrows(BusinessException.class, () -> generate("asset-image", "c1", 16));
        assertEquals("ENDPOINT_NOT_ALLOWED", e.getCode());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, e.getStatus());
        assertTrue(e.getMessage().contains("作品设置里选的图片模型已停用或不再开放"), e.getMessage());
        verifyNoInteractions(images);
    }

    @Test void batchOnAModelWithoutSquareSizesSubmitsOnlyTheAssetsItCanMake() throws Exception {
        storedImageModel("image-4k");
        asset("c1", "character", "林夏");
        asset("p1", "prop", "修复编号工作本");
        asset("s1", "scene", "老宅");
        asset("p2", "prop", "母亲旧毛衣");
        List<String> refused = new ArrayList<>();
        for (String id : List.of("c1", "p1", "s1", "p2")) {
            try { generate("asset-image", id, 55); }
            catch (BusinessException e) { assertEquals("STUDIO_IMAGE_SIZE_UNSUPPORTED", e.getCode()); refused.add(id); }
        }
        assertEquals(List.of("p1", "p2"), refused);
        var sent = ArgumentCaptor.forClass(IpRunService.IpGenerateRequest.class);
        verify(images, times(2)).generateForDirector(eq("u1"), eq(work.getId()), sent.capture());
        assertEquals(List.of("asset:c1", "asset:s1"), sent.getAllValues().stream().map(IpRunService.IpGenerateRequest::nodeId).toList());
        sent.getAllValues().forEach(r -> { assertEquals("image-4k", r.model()); assertEquals(55L, r.maxCost()); });
    }
}
