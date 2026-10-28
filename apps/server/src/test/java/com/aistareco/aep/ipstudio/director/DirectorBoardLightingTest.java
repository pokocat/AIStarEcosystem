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
 * 分镜图的布光是一段默认指导，各格的镜头描述原样保留，由出图模型结合上下文理解（2026-10-28 第二轮 review 后定）。
 * 之前按关键词推断特殊布光、再给那一格追加「不补光」，把「自然色调」「不要逆光剪影」「低调地放下」都读反了。
 * 这里钉住的是：代码不再从描述里读布光，什么描述、什么风格都是同一段指导；剪影、暗面、特殊光色只留在描述里。
 */
class DirectorBoardLightingTest {
    private static final String LIVE = "布光与调色：默认按影视人像布光，主光塑造五官，适度补光，让肤色自然、有气色，保留皮肤质感和场景氛围。"
            + "画面风格写明的布光和调色照风格来；画面描述里明确写的剪影、暗面或特殊光色优先，只作用于写到的人物或区域，其他部分沿用默认布光。";
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
    /** 去掉各格的镜头描述，剩下的就是代码自己加的部分。 */
    private static String withoutCells(String board) {
        return String.join("\n", board.lines().filter(l -> !l.matches("^(左上|右上|左下|右下)格：.*")).toList());
    }

    @Test
    void whateverTheShotsSayTheGuidanceIsTheSameAndTheDescriptionsAreKeptAsWritten() {
        String plain = withoutCells(board());
        List<String> stills = List.of("陈默背对夕阳形成剪影，脸部隐入阴影，只见轮廓", "暖光照在陈默脸上，柔和补光让五官清楚",
                "陈默走进房间，不要逆光剪影，脸部自然明亮", "陈默低调地把信放在桌上", "台灯光照在陈默半边脸上，另一半在阴影里", "昏暗的走廊里陈默停下脚步");
        for (String still : stills) {
            shot(0).put("still", still);
            String board = board();
            assertEquals(plain, withoutCells(board), "代码不从描述里读布光：" + still);
            assertTrue(board.contains("左上格：中景，平视，固定机位。" + still + "\n"), "描述原样交给出图模型：" + board);
            assertEquals(1, board.lines().filter(l -> l.startsWith("布光与调色：")).count());
            assertFalse(board.contains("补光提亮") || board.contains("不补光"), "不再追加「这一格不补光」这类强指令：" + board);
        }
        assertTrue(plain.contains(LIVE), plain);
        assertTrue(plain.contains("明暗和光色只随画面描述的布光变化"), plain);
    }

    @Test
    void theStyleOnlyDecidesLiveActionAndIsOtherwiseLeftToTheModel() {
        for (String style : List.of("真人写实，自然色调", "真人写实，柔和胶片质感", "真人写实，冷色调", "真人写实，逆光剪影")) {
            c.with("settings").put("style", style);
            String board = board();
            assertTrue(board.startsWith(style + "风格，") && board.contains(LIVE), board);
            assertTrue(asset("as1").contains("白平衡中性") && asset("as1").contains("画面风格写明了调色的按风格来"), asset("as1"));
        }
        c.with("settings").put("style", "日系动画");
        assertTrue(board().contains("布光与调色：默认让人物面部受光清楚、五官可辨，配色干净，保留场景氛围。画面风格写明的布光和调色照风格来；"));
    }

    @Test
    void scenesAlwaysGetTheSameLightingSentence() {
        service.refresh(c);
        String ordinary = asset("as2").replace("窄长的店面，靠窗一张木桌，头顶一盏吊灯", "");
        ((ObjectNode) c.path("assets").get(1)).put("description", "阴暗潮湿的地下室，墙上一盏昏黄的灯泡");
        service.refresh(c);
        assertEquals(ordinary, asset("as2").replace("阴暗潮湿的地下室，墙上一盏昏黄的灯泡", ""), "昏暗与否交给设定原文，不换另一套写法");
        assertTrue(ordinary.contains("设定或画面风格写明的昏暗、夜色、有色灯光和调色照写"), ordinary);
    }
}
