package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.prompt.PromptLibraries;
import com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 出图模板进了提示词库（docs/studio-prompt-architecture.md §8 #20）：后台发了新版本，已经采用的资产图、分镜图按它生成时的那一版核对，
 * 换模板本身不算「描述已修改」；真改了描述或镜头仍然标「需更新」。模板进库之前生成的（记的是第 3 版、没有版本号）就是库里的 v1。
 */
class DirectorImageTemplateVersionTest {
    private static final String ASSET = "stage-director-asset-image", BOARD = "stage-director-board";
    /** 分镜图模板现在的版本：这里核对的是「按当时那一版生成的图」，不写死数字，模板正文改了不用改这个测试。 */
    private static final int BOARD_NOW = DirectorPrompts.templateVersion(StudioPromptAssembler.classpath(), BOARD);
    private final ObjectMapper om = new ObjectMapper();
    private DirectorService service;
    private ObjectNode c;

    @BeforeEach
    void setUp() throws Exception {
        StudioFixtureProvider fixtures = mock(StudioFixtureProvider.class);
        when(fixtures.enabled()).thenReturn(true);
        service = new DirectorService(null, null, null, null, null, null, mock(StudioVideoService.class), fixtures, null, null, null, null,
                mock(AiAppSceneModelPolicyService.class), null, null, null, om, mock(PlatformTransactionManager.class));
        c = (ObjectNode) om.readTree("""
                {"seq":10,"settings":{"style":"真人写实","aspectRatio":"9:16"},"taskMeta":{},
                 "assets":[
                  {"id":"as1","kind":"character","name":"陈默","description":"三十岁，短发，藏青夹克","prompt":"","promptCustom":false,
                   "image":{"candidates":[],"adoptedId":null}},
                  {"id":"as2","kind":"scene","name":"旧书店","description":"窄长的店面，靠窗一张木桌，头顶一盏吊灯","prompt":"","promptCustom":false,
                   "image":{"candidates":[],"adoptedId":null}}],
                 "clips":[{"id":"cl1","episodeId":"ep1","order":1,"title":"夜访","durationSec":8,"assetIds":["as1","as2"],
                  "shots":[
                   {"durationSec":4,"size":"中景","camera":"平视，固定机位","still":"陈默推门走进书店","action":"推门进来","dialogue":[]},
                   {"durationSec":4,"size":"近景","camera":"越过陈默肩膀，缓慢推近","still":"陈默低头看桌上的信","action":"低头","dialogue":[]}],
                  "boardPrompt":"","boardPromptCustom":false,
                  "board":{"candidates":[],"adoptedId":null},"video":{"candidates":[],"adoptedId":null}}]}""");
    }

    private ObjectNode asset(String id) {
        for (JsonNode a : c.path("assets")) if (a.path("id").asText().equals(id)) return (ObjectNode) a;
        throw new AssertionError(id);
    }

    private ObjectNode clip() { return (ObjectNode) c.path("clips").get(0); }

    private void adoptAsset(String id, String prompt, Integer version) {
        ObjectNode slot = (ObjectNode) asset(id).path("image");
        slot.putArray("candidates");
        ObjectNode m = slot.withArray("candidates").addObject().put("id", "m-" + id).put("key", "k/" + id + ".png").put("source", "generated")
                .put("fingerprint", DirectorService.hash(prompt + "|" + asset(id).path("kind").asText())).put("promptFormat", 3);
        if (version != null) m.putObject("promptVersions").put(ASSET, version);
        slot.put("adoptedId", "m-" + id).put("adoptedBy", "user");
    }

    private void adoptBoard(String prompt, Integer version) {
        ObjectNode slot = (ObjectNode) clip().path("board");
        slot.putArray("candidates");
        ObjectNode m = slot.withArray("candidates").addObject().put("id", "b1").put("key", "k/board.png").put("source", "generated")
                .put("prompt", prompt).put("fingerprint", DirectorService.hash(prompt + "|k/as1.png|k/as2.png")).put("promptFormat", 3);
        var refs = m.putArray("refs");
        refs.addObject().put("label", "图1").put("key", "k/as1.png");
        refs.addObject().put("label", "图2").put("key", "k/as2.png");
        if (version != null) m.putObject("promptVersions").put(BOARD, version);
        slot.put("adoptedId", "b1").put("adoptedBy", "user");
    }

    private void publishNewTemplates() {
        var library = PromptLibraries.withNewVersions(PromptLibraries.revised(ASSET, "新版本多一句。"), PromptLibraries.revised(BOARD, "新版本多一句。"));
        ReflectionTestUtils.setField(service, "promptAssembler", new StudioPromptAssembler(library));
    }

    private String check(JsonNode slot) { return slot.path("adoptedCheck").asText(); }

    @Test
    void adoptedImagesKeepTheirTemplateVersionAfterANewVersionIsPublished() {
        service.refresh(c);
        adoptAsset("as1", asset("as1").path("prompt").asText(), 1);
        adoptAsset("as2", asset("as2").path("prompt").asText(), null); // 模板进库之前生成的：第 3 版、没有版本号
        adoptBoard(clip().path("boardPrompt").asText(), BOARD_NOW);
        publishNewTemplates();
        service.refresh(c);
        assertTrue(clip().path("boardPrompt").asText().endsWith("新版本多一句。"), "提示词已经按新版本编");
        assertTrue(asset("as1").path("prompt").asText().endsWith("新版本多一句。"));
        assertEquals("current", check(asset("as1").path("image")), asset("as1").toString());
        assertEquals("current", check(asset("as2").path("image")));
        assertEquals("current", check(clip().path("board")), clip().path("board").toString());
    }

    @Test
    void aRealChangeIsStillFlaggedUnderTheOldVersion() {
        service.refresh(c);
        adoptAsset("as1", asset("as1").path("prompt").asText(), 1);
        adoptAsset("as2", asset("as2").path("prompt").asText(), 1);
        adoptBoard(clip().path("boardPrompt").asText(), BOARD_NOW);
        publishNewTemplates();
        asset("as1").put("description", "四十岁，寸头，灰色工装");
        ((ObjectNode) clip().path("shots").get(1)).put("still", "陈默把信塞进口袋");
        service.refresh(c);
        assertEquals("outdated", check(asset("as1").path("image")));
        assertEquals("描述或出图提示词已修改", asset("as1").path("image").path("staleReasons").get(0).asText());
        assertEquals("current", check(asset("as2").path("image")));
        assertEquals("outdated", check(clip().path("board")));
        assertEquals("镜头、台词或提示词已修改", clip().path("board").path("staleReasons").get(0).asText());
    }

    @Test
    void imagesMadeWithTheNewVersionAreCheckedAgainstIt() {
        publishNewTemplates();
        service.refresh(c);
        adoptAsset("as1", asset("as1").path("prompt").asText(), 2);
        adoptAsset("as2", asset("as2").path("prompt").asText(), 2);
        adoptBoard(clip().path("boardPrompt").asText(), BOARD_NOW + 1);
        service.refresh(c);
        assertEquals("current", check(asset("as1").path("image")));
        assertEquals("current", check(clip().path("board")));
        // 记了新版本、内容却是 v1 编的 → 按新版本核对，算已修改
        ReflectionTestUtils.setField(service, "promptAssembler", null);
        service.refresh(c);
        String v1 = asset("as1").path("prompt").asText();
        publishNewTemplates();
        adoptAsset("as1", v1, 2);
        service.refresh(c);
        assertEquals("outdated", check(asset("as1").path("image")));
    }
}
