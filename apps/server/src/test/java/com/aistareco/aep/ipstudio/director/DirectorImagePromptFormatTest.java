package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 2026-10-28 出图提示词加入演员布光、中性白平衡与肤色还原（用户反馈 H3 成片人物脸黑、发黄）。
 * 两件事要钉住：新规则真的写进了参考图和分镜图的提示词（真人风格写皮肤，其他风格不写）；
 * 换模板本身不能把已采用的参考图、分镜图都标成「需更新」：之前生成的（没有 promptFormat）按旧模板核对。
 */
class DirectorImagePromptFormatTest {
    private final ObjectMapper om = new ObjectMapper();
    private DirectorService service;
    private ObjectNode c;

    @BeforeEach
    void setUp() throws Exception {
        StudioFixtureProvider fixtures = mock(StudioFixtureProvider.class);
        when(fixtures.enabled()).thenReturn(true);
        service = new DirectorService(null, null, null, null, null, null, mock(StudioVideoService.class), fixtures, null, null, null,
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

    private String legacyAssetPrompt(String id) { return DirectorPrompts.legacyAssetPrompt(c.path("settings"), asset(id)); }

    private String legacyBoardPrompt() {
        return DirectorPrompts.legacyBoardPrompt(c.path("settings"), clip(),
                List.of(new DirectorPrompts.Ref("图1", "character", "陈默"), new DirectorPrompts.Ref("图2", "scene", "旧书店")),
                Map.of("as1", "陈默", "as2", "旧书店"));
    }

    /** 生成时记下的候选（指纹与 DirectorService#assetFingerprint / #boardCurrent 同一个算法）。 */
    private void adoptAsset(String id, String prompt, Integer format) {
        ObjectNode slot = (ObjectNode) asset(id).path("image");
        ObjectNode m = slot.withArray("candidates").addObject().put("id", "m-" + id).put("key", "k/" + id + ".png").put("source", "generated")
                .put("fingerprint", DirectorService.hash(prompt + "|" + asset(id).path("kind").asText()));
        if (format != null) m.put("promptFormat", format);
        slot.put("adoptedId", "m-" + id).put("adoptedBy", "user");
    }

    private void adoptBoard(String prompt, Integer format) {
        ObjectNode slot = (ObjectNode) clip().path("board");
        ObjectNode m = slot.withArray("candidates").addObject().put("id", "b1").put("key", "k/board.png").put("source", "generated")
                .put("prompt", prompt).put("fingerprint", DirectorService.hash(prompt + "|k/as1.png|k/as2.png"));
        var refs = m.putArray("refs");
        refs.addObject().put("label", "图1").put("key", "k/as1.png");
        refs.addObject().put("label", "图2").put("key", "k/as2.png");
        if (format != null) m.put("promptFormat", format);
        slot.put("adoptedId", "b1").put("adoptedBy", "user");
    }

    // ── 新规则写进了提示词 ─────────────────────────────────────────────────

    @Test
    void liveActionPromptsAskForActorLightingNeutralWhiteBalanceAndTrueSkinTone() {
        service.refresh(c);
        String sheet = asset("as1").path("prompt").asText();
        assertTrue(sheet.contains("白平衡中性") && sheet.contains("柔和补光") && sheet.contains("不磨皮、不刻意美白"), sheet);
        String scene = asset("as2").path("prompt").asText();
        assertTrue(scene.contains("暖光只落在光源照到的地方") && scene.contains("夜景保留夜色"), scene);
        assertFalse(scene.contains("光线统一"), "旧的笼统写法已换掉");
        String board = clip().path("boardPrompt").asText();
        assertTrue(board.contains("给演员打光") && board.contains("肤色按角色参考图自然还原") && board.contains("不把人物的脸压黑或染黄"), board);
        assertTrue(board.contains("人物的肤色和整体色调保持一致"), "宫格之间人物的肤色和色调要一致");
        assertTrue(board.contains("图2 提供场景「旧书店」的空间布局与光源方向"), "场景图交代空间和光源方向，不交代它自己的曝光和偏色");
        assertTrue(board.contains("参考图本身偏暗或偏色的地方不照搬"), board);
    }

    @Test
    void otherStylesGetClearFaceLightingWithoutLiveActionSkinRules() {
        c.with("settings").put("style", "日系动画");
        service.refresh(c);
        String sheet = asset("as1").path("prompt").asText(), board = clip().path("boardPrompt").asText();
        assertTrue(sheet.contains("面部受光充分") && board.contains("人物面部受光清楚"), board);
        assertFalse(sheet.contains("皮肤纹理") || board.contains("皮肤质感") || board.contains("给演员打光"), "动画风格不写真人皮肤规则");
    }

    @Test
    void liveActionIsDecidedFromTheFreeTextStyle() {
        for (String s : List.of("真人写实", "电影感写实", "港剧实拍", "影视级真人")) assertTrue(DirectorPrompts.liveAction(s), s);
        for (String s : List.of("日系动画", "写实动画", "国风水墨", "3D 卡通", "赛博朋克插画", "像素风")) assertFalse(DirectorPrompts.liveAction(s), s);
    }

    @Test
    void shotRulesNoLongerAskForUnevenLightingOnFaces() {
        String plan = DirectorPrompts.plan(12, 15, 4);
        assertFalse(plan.contains("光线明暗不均"), "这条曾经诱导欠曝");
        assertTrue(plan.contains("默认把人物的脸照清楚") && plan.contains("直接写进 still"), "默认照清楚，特殊布光写进 still 交给分镜图");
    }

    @Test
    void customPromptsAreLeftAsTheUserWroteThem() {
        asset("as1").put("prompt", "我手写的设定图提示词").put("promptCustom", true);
        clip().put("boardPrompt", "我手写的分镜图提示词").put("boardPromptCustom", true);
        service.refresh(c);
        assertEquals("我手写的设定图提示词", asset("as1").path("prompt").asText());
        assertEquals("我手写的分镜图提示词", clip().path("boardPrompt").asText());
    }

    // ── 换模板不把已采用的图标成「需更新」 ─────────────────────────────────────

    @Test
    void imagesMadeWithTheOldTemplateStayCurrentAfterTheTemplateChange() {
        adoptAsset("as1", legacyAssetPrompt("as1"), null);
        adoptAsset("as2", legacyAssetPrompt("as2"), null);
        adoptBoard(legacyBoardPrompt(), null);
        service.refresh(c);
        assertTrue(clip().path("boardPrompt").asText().contains("给演员打光"), "提示词已经换成新模板");
        assertEquals("current", asset("as1").path("image").path("adoptedCheck").asText(), asset("as1").toString());
        assertEquals("current", asset("as2").path("image").path("adoptedCheck").asText());
        assertEquals("current", clip().path("board").path("adoptedCheck").asText(), clip().path("board").toString());
    }

    @Test
    void oldTemplateImagesAreStillFlaggedWhenTheUserReallyChangedSomething() {
        adoptAsset("as1", legacyAssetPrompt("as1"), null);
        adoptAsset("as2", legacyAssetPrompt("as2"), null);
        adoptBoard(legacyBoardPrompt(), null);
        asset("as1").put("description", "四十岁，寸头，灰色工装");
        ((ObjectNode) clip().path("shots").get(1)).put("still", "陈默把信塞进口袋");
        service.refresh(c);
        assertEquals("outdated", asset("as1").path("image").path("adoptedCheck").asText());
        assertEquals("描述或出图提示词已修改", asset("as1").path("image").path("staleReasons").get(0).asText());
        assertEquals("outdated", clip().path("board").path("adoptedCheck").asText());
        assertEquals("镜头、台词或提示词已修改", clip().path("board").path("staleReasons").get(0).asText());
    }

    @Test
    void imagesMadeWithTheNewTemplateAreCheckedAgainstTheNewTemplateOnly() {
        service.refresh(c);
        adoptAsset("as1", asset("as1").path("prompt").asText(), DirectorPrompts.IMAGE_PROMPT_FORMAT);
        adoptAsset("as2", asset("as2").path("prompt").asText(), DirectorPrompts.IMAGE_PROMPT_FORMAT);
        adoptBoard(clip().path("boardPrompt").asText(), DirectorPrompts.IMAGE_PROMPT_FORMAT);
        service.refresh(c);
        assertEquals("current", asset("as1").path("image").path("adoptedCheck").asText());
        assertEquals("current", clip().path("board").path("adoptedCheck").asText());

        // 记了新版本、内容却是旧模板的（不会发生，但核对必须按新模板）→ 已修改
        ((ObjectNode) asset("as1").path("image")).putArray("candidates");
        adoptAsset("as1", legacyAssetPrompt("as1"), DirectorPrompts.IMAGE_PROMPT_FORMAT);
        service.refresh(c);
        assertEquals("outdated", asset("as1").path("image").path("adoptedCheck").asText());
    }

    @Test
    void aTaskSubmittedBeforeTheChangeAndFinishedAfterIsStillAdopted() throws Exception {
        // 换模板之前提交的出图任务：记下的指纹按旧模板算，没有 promptFormat
        c.with("taskMeta").putObject("IPR-old").put("node", "asset:as1").put("prompt", legacyAssetPrompt("as1"))
                .put("fingerprint", DirectorService.hash(legacyAssetPrompt("as1") + "|character"));
        IpRun run = new IpRun();
        run.setId("IPR-old");
        run.setNodeId("asset:as1");
        run.setStatus("done");
        run.setOutputJson("{\"candidates\":[{\"key\":\"k/as1-new.png\"}]}");
        Method apply = DirectorService.class.getDeclaredMethod("apply", DirectorWork.class, ObjectNode.class, IpRun.class);
        apply.setAccessible(true);
        apply.invoke(service, new DirectorWork(), c, run);
        JsonNode slot = asset("as1").path("image");
        assertFalse(slot.path("candidates").get(0).path("stale").asBoolean(false), slot.toString());
        assertEquals(slot.path("candidates").get(0).path("id").asText(), slot.path("adoptedId").asText(), "没有因为换模板只进历史");
        service.refresh(c);
        assertEquals("current", asset("as1").path("image").path("adoptedCheck").asText(), "也没有被标成需更新");
    }
}
