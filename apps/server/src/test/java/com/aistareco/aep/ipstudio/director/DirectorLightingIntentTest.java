package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 默认布光要给明确的创作意图让路（2026-10-28 review）：普通镜头照默认给演员打光；
 * 镜头、场景设定或画面风格写明逆光剪影、脸在阴影里、特殊调色时按写的来，同一格里不能同时写着「补光把脸照清楚」。
 * 「昏暗」「夜里」这类环境描述不算特殊布光，仍按默认把人物交代清楚（用户反馈的就是脸黑）。
 */
class DirectorLightingIntentTest {
    private static final String FILL = "柔和补光让眼睛和暗侧脸颊看得清";
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
                  {"id":"as1","kind":"character","name":"陈默","description":"三十岁，短发，藏青夹克","prompt":"","promptCustom":false,"image":{"candidates":[],"adoptedId":null}},
                  {"id":"as2","kind":"scene","name":"旧书店","description":"窄长的店面，靠窗一张木桌，头顶一盏吊灯","prompt":"","promptCustom":false,"image":{"candidates":[],"adoptedId":null}}],
                 "clips":[{"id":"cl1","episodeId":"ep1","order":1,"title":"夜访","durationSec":12,"assetIds":["as1","as2"],
                  "shots":[
                   {"durationSec":4,"size":"中景","camera":"平视，固定机位","still":"陈默推门走进书店","action":"推门","dialogue":[]},
                   {"durationSec":4,"size":"近景","camera":"越过陈默肩膀，缓慢推近","still":"陈默低头看桌上的信","action":"低头","dialogue":[]},
                   {"durationSec":4,"size":"特写","camera":"俯拍，固定机位","still":"信封上的火漆","action":"静止","dialogue":[]}],
                  "boardPrompt":"","boardPromptCustom":false,"board":{"candidates":[],"adoptedId":null},"video":{"candidates":[],"adoptedId":null}}]}""");
    }

    private ObjectNode clip() { return (ObjectNode) c.path("clips").get(0); }
    private ObjectNode shot(int i) { return (ObjectNode) clip().path("shots").get(i); }
    private String asset(String id) {
        for (JsonNode a : c.path("assets")) if (a.path("id").asText().equals(id)) return a.path("prompt").asText();
        throw new AssertionError(id);
    }
    private String board() { service.refresh(c); return clip().path("boardPrompt").asText(); }

    @Test
    void ordinaryShotsGetTheDefaultActorLightingAndNothingThatOverridesIt() {
        String board = board();
        assertTrue(board.contains("布光与调色：顺着场景的光源方向布光") && board.contains(FILL), board);
        assertFalse(board.contains("不为它补光提亮") || board.contains("按画面风格"), "没有特殊布光时不出现让位的说法");
    }

    @Test
    void aDarkRoomIsNotASilhouette() {
        // 用户反馈的就是暗戏里脸黑：环境昏暗不等于要把脸藏起来，仍按默认打光、保留氛围
        shot(0).put("still", "昏暗的走廊里陈默停下脚步");
        String board = board();
        assertTrue(board.contains(FILL) && board.contains("夜景和暗调的戏保留氛围"), board);
        assertFalse(board.contains("不为它补光提亮"), board);
    }

    @Test
    void aSilhouetteCellKeepsItsLightingAndOnlyTheOtherCellsGetTheDefault() {
        shot(0).put("still", "陈默背对夕阳形成剪影，脸部隐入阴影，只见轮廓");
        String board = board();
        int keep = board.indexOf("左上格按画面描述里写的布光来，不为它补光提亮"), others = board.indexOf("其余各格"), fill = board.indexOf(FILL);
        assertTrue(keep >= 0 && others > keep && fill > others, "补光只写给其余各格：" + board);
        assertEquals(board.indexOf(FILL), board.lastIndexOf(FILL), "补光只出现一次");
        assertTrue(board.contains("明暗只随画面描述的布光变化"), "各格一致的要求不再强求剪影格和其他格同样亮");
    }

    @Test
    void whenEveryCellAsksForItsOwnLightingThereIsNoDefaultFillAtAll() {
        shot(0).put("still", "陈默背光站在门口，只见轮廓");
        shot(1).put("still", "台灯光照在陈默半边脸上，另一半在阴影里");
        shot(2).put("still", "火漆在烛光映照下发红").put("camera", "低调照明，俯拍");
        String board = board();
        assertTrue(board.contains("左上格、右上格、左下格按画面描述里写的布光来"), board);
        assertFalse(board.contains(FILL) || board.contains("其余各格"), board);
    }

    @Test
    void aLightingStyleOverridesTheDefaultsOnEveryImage() {
        c.with("settings").put("style", "真人写实，逆光剪影");
        String board = board();
        assertTrue(board.contains("按画面风格「真人写实，逆光剪影」的布光和调色来") && board.contains("不另外补光提亮"), board);
        assertFalse(board.contains(FILL) || board.contains("不把人物的脸压黑或染黄"), "风格要剪影时不再同时要求把脸照亮");
        String sheet = asset("as1"), scene = asset("as2");
        assertTrue(sheet.contains("色彩和调色按画面风格来") && !sheet.contains("白平衡中性"), sheet);
        assertTrue(scene.contains("保留写明的明暗和色调") && !scene.contains("整体曝光正常"), scene);
    }

    @Test
    void aSceneThatIsMeantToBeDimStaysDim() {
        ((ObjectNode) c.path("assets").get(1)).put("description", "阴暗潮湿的地下室，墙上一盏昏黄的灯泡");
        service.refresh(c);
        String scene = asset("as2");
        assertTrue(scene.contains("保留写明的明暗和色调"), scene);
        assertFalse(scene.contains("整体曝光正常") || scene.contains("不把整个画面染成一层黄"), "设定写了昏暗、昏黄就不再要求提亮和去黄：" + scene);
        // 没写明暗的场景照默认
        assertTrue(DirectorPrompts.assetPrompt(c.path("settings"), om.createObjectNode().put("kind", "scene").put("name", "办公室").put("description", "开放式工位"))
                .contains("整体曝光正常"));
    }

    @Test
    void onlyExplicitLightingCountsAsIntent() {
        for (String s : List.of("背对夕阳形成剪影", "逆光", "脸隐在阴影里", "台灯光照在他脸上", "霓虹灯映红了她的脸", "低调照明", "黑白", "冷色调"))
            assertTrue(DirectorPrompts.lightingIntent(s), s);
        for (String s : List.of("昏暗的走廊", "夜里的便利店", "窗框的阴影落在桌上", "陈默推门走进书店", "暖黄的路灯下两人并肩走"))
            assertFalse(DirectorPrompts.lightingIntent(s), s);
    }
}
