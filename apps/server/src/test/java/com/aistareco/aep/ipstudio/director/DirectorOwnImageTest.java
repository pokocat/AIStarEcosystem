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
import org.springframework.transaction.PlatformTransactionManager;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 用户自己的图（2026-10-28）：「直接作为资产图」不生成、不扣积分，分镜图真的拿它当参考；
 * 「作为参考图」只在以后生成资产图时交给模型，不碰已采用的资产图，也不会自己发起生成。
 */
class DirectorOwnImageTest {
    private static final String USER = "u1";
    private final ObjectMapper om = new ObjectMapper();
    private final DirectorWorkRepository works = mock(DirectorWorkRepository.class);
    private final IpRunService images = mock(IpRunService.class);
    private final StudioWorkflowService text = mock(StudioWorkflowService.class);
    private final IpProjectService projects = mock(IpProjectService.class);
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
            return new IpRunDto("run-1", work.getId(), req.nodeId(), "generate", "running", "queued", 0, req.maxCost(),
                    null, null, om.createObjectNode(), om.createObjectNode(), null, null, null);
        });
        service = new DirectorService(works, mock(IpRunRepository.class), projects, images, text, mock(StudioWorkflowWorker.class), mock(StudioVideoService.class),
                mock(StudioFixtureProvider.class), mock(StudioMediaImportService.class), mock(MaterialVideoJobService.class), null, mock(MaterialVideoModelClient.class),
                policy, mock(FileStorageService.class), new IpStudioProperties(), mock(IpLibraryService.class), om, mock(PlatformTransactionManager.class));
        service.create(USER, new DirectorService.CreateRequest("自己的图", "", null));
    }

    private JsonNode edit(String op, String target, String data) throws Exception {
        return service.edit(USER, work.getId(), new DirectorService.EditRequest(op, target, null, om.readTree(data)));
    }

    private JsonNode last(JsonNode v) { return v.path("assets").get(v.path("assets").size() - 1); }

    private IpRunService.IpGenerateRequest submitted() {
        var sent = ArgumentCaptor.forClass(IpRunService.IpGenerateRequest.class);
        verify(images, atLeastOnce()).generateForDirector(eq(USER), eq(work.getId()), sent.capture());
        return sent.getValue();
    }

    /** 片段直接关联资产（绕过分镜脚本），出分镜图时看它交出去的参考图。 */
    private void clipUsing(String assetId) throws Exception {
        ObjectNode c = (ObjectNode) om.readTree(work.getContentJson());
        ObjectNode clip = c.withArray("clips").addObject().put("id", "k1").put("episodeId", "ep1").put("order", 1).put("rev", 1).put("boardPrompt", "雨夜老宅门口");
        clip.putArray("issues");
        clip.putArray("assetIds").add(assetId);
        clip.putArray("shots").addObject().put("durationSec", 3).put("size", "中景").put("action", "她推开门").putArray("dialogue");
        clip.putObject("board").putArray("candidates");
        ObjectNode video = clip.putObject("video");
        video.putArray("candidates");
        video.putArray("pending");
        work.setContentJson(om.writeValueAsString(c));
    }

    @Test void uploadedImageBecomesTheAssetImageWithoutGeneratingAndTheBoardUsesIt() throws Exception {
        JsonNode a = last(edit("asset.create", null, "{\"kind\":\"character\",\"name\":\"林夏\",\"image\":{\"key\":\"u/linxia.png\",\"use\":\"asset\"}}"));
        JsonNode slot = a.path("image");
        assertEquals("upload", slot.path("candidates").get(0).path("source").asText());
        assertEquals("u/linxia.png", slot.path("candidates").get(0).path("key").asText());
        assertEquals(slot.path("candidates").get(0).path("id").asText(), slot.path("adoptedId").asText());
        assertEquals("user", slot.path("adoptedBy").asText(), "直接上传的就是用户选定的，不用再确认");
        assertTrue(a.path("refImage").isMissingNode() || a.path("refImage").isNull());
        verifyNoInteractions(images);
        verify(text, never()).submitDirectorText(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());

        clipUsing(a.path("id").asText());
        service.task(USER, work.getId(), new DirectorService.TaskRequest("board", "k1", "req-board", null, null, 16L));
        assertEquals(List.of("u/linxia.png"), submitted().refKeys(), "分镜图拿用户上传的那张当参考");
    }

    @Test void referenceOnlyGuidesLaterGenerationForEveryKindAndNeverReplacesTheAdoptedImage() throws Exception {
        JsonNode a = last(edit("asset.create", null, "{\"kind\":\"scene\",\"name\":\"老宅\",\"description\":\"雨夜的老宅门口\",\"image\":{\"key\":\"u/house.jpg\",\"use\":\"ref\"}}"));
        assertEquals("u/house.jpg", a.path("refImage").path("key").asText());
        assertEquals(0, a.path("image").path("candidates").size(), "参考图不是资产图");
        assertTrue(a.path("image").path("adoptedId").isNull());
        verifyNoInteractions(images);

        service.task(USER, work.getId(), new DirectorService.TaskRequest("asset-image", a.path("id").asText(), "req-scene", null, null, 16L));
        assertEquals("u/house.jpg", submitted().refKeys().get(0));
        assertTrue(submitted().prompt().contains(DirectorPrompts.SCENE_REF_NOTE));

        // 已经有采用的资产图时再设参考图：资产图不变，也不发起生成。
        String id = a.path("id").asText();
        edit("asset.upload", id, "{\"key\":\"u/house-final.png\"}");
        clearInvocations(images);
        JsonNode after = last(edit("asset.setRef", id, "{\"key\":\"u/house-new-ref.jpg\"}"));
        assertEquals("u/house-new-ref.jpg", after.path("refImage").path("key").asText());
        assertEquals("u/house-final.png", adoptedKey(after));
        verifyNoInteractions(images);

        JsonNode prop = last(edit("asset.create", null, "{\"kind\":\"prop\",\"name\":\"灯笼\",\"description\":\"红灯笼\"}"));
        edit("asset.setRef", prop.path("id").asText(), "{\"key\":\"u/lantern.jpg\"}");
        service.task(USER, work.getId(), new DirectorService.TaskRequest("asset-image", prop.path("id").asText(), "req-prop", null, null, 16L));
        assertTrue(submitted().prompt().contains(DirectorPrompts.PROP_REF_NOTE));
    }

    @Test void replacingTheAssetImageKeepsEarlierVersionsToSwitchBack() throws Exception {
        String id = last(edit("asset.create", null, "{\"kind\":\"prop\",\"name\":\"玉佩\",\"image\":{\"key\":\"u/v1.png\",\"use\":\"asset\"}}")).path("id").asText();
        JsonNode slot = last(edit("asset.upload", id, "{\"key\":\"u/v2.png\"}")).path("image");
        assertEquals(2, slot.path("candidates").size());
        assertEquals("u/v2.png", adoptedKey(last(service.get(USER, work.getId()))));
        String first = slot.path("candidates").get(0).path("id").asText();
        assertEquals("u/v1.png", adoptedKey(last(edit("asset.adopt", id, "{\"candidateId\":\"" + first + "\"}"))));
    }

    @Test void unknownUseOrMissingImageIsRejectedAndNothingIsAdded() throws Exception {
        for (String bad : new String[]{"{\"key\":\"u/x.png\",\"use\":\"both\"}", "{\"use\":\"asset\"}"}) {
            var e = assertThrows(BusinessException.class, () -> edit("asset.create", null, "{\"kind\":\"prop\",\"name\":\"玉佩\",\"image\":" + bad + "}"));
            assertEquals("DIRECTOR_INPUT_INVALID", e.getCode());
        }
        assertEquals(0, service.get(USER, work.getId()).path("assets").size());
    }

    /** 已采用的生成图在设参考图后标「需更新」，原因要说是参考图变了，不说成描述改了（2026-10-29 本地验收发现）。 */
    @Test void outdatedReasonNamesTheReferenceWhenOnlyTheReferenceChanged() throws Exception {
        String id = last(edit("asset.create", null, "{\"kind\":\"scene\",\"name\":\"老宅\",\"description\":\"雨夜的老宅门口\"}")).path("id").asText();
        String prompt = last(service.get(USER, work.getId())).path("prompt").asText();
        adoptGenerated(id, DirectorService.hash(prompt + "|scene"), null);
        assertEquals("current", last(service.get(USER, work.getId())).path("image").path("adoptedCheck").asText());
        JsonNode slot = last(edit("asset.setRef", id, "{\"key\":\"u/ref-1.jpg\"}")).path("image");
        assertEquals("outdated", slot.path("adoptedCheck").asText());
        assertEquals("[\"设置了参考图\"]", slot.path("staleReasons").toString());

        adoptGenerated(id, DirectorService.hash(prompt + "|scene|ref:u/ref-1.jpg"), "u/ref-1.jpg");
        assertEquals("[\"参考图已更换\"]", last(edit("asset.setRef", id, "{\"key\":\"u/ref-2.jpg\"}")).path("image").path("staleReasons").toString());
        assertEquals("[\"参考图已移除\"]", last(edit("asset.clearRef", id, "{}")).path("image").path("staleReasons").toString());
        JsonNode a = last(service.get(USER, work.getId()));
        JsonNode changed = last(service.edit(USER, work.getId(), new DirectorService.EditRequest("asset.update", id, a.path("rev").asLong(), om.readTree("{\"description\":\"晴天的老宅门口\"}"))));
        assertEquals("[\"描述或出图提示词已修改\"]", changed.path("image").path("staleReasons").toString());
    }

    /** 模拟一张已采用的生成图：refKey 是生成时交给模型的参考图。 */
    private void adoptGenerated(String assetId, String fingerprint, String refKey) throws Exception {
        ObjectNode c = (ObjectNode) om.readTree(work.getContentJson());
        for (JsonNode x : c.path("assets")) if (x.path("id").asText().equals(assetId)) {
            ObjectNode slot = (ObjectNode) x.path("image");
            var candidates = slot.putArray("candidates");
            ObjectNode m = candidates.addObject().put("id", "g1").put("key", "gen/a.png").put("source", "generated").put("fingerprint", fingerprint)
                    .put("prompt", x.path("prompt").asText()).put("promptFormat", DirectorPrompts.IMAGE_PROMPT_FORMAT);
            var refs = m.putArray("refs");
            if (refKey != null) refs.addObject().put("assetId", assetId).put("name", x.path("name").asText() + "的参考图").put("label", "图1").put("key", refKey);
            slot.put("adoptedId", "g1").put("adoptedBy", "user");
        }
        work.setContentJson(om.writeValueAsString(c));
    }

    private static String adoptedKey(JsonNode asset) {
        String id = asset.path("image").path("adoptedId").asText(null);
        for (JsonNode m : asset.path("image").path("candidates")) if (m.path("id").asText().equals(id)) return m.path("key").asText();
        return null;
    }
}
