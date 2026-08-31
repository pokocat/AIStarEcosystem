package com.aistareco.aep.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DramaShortContinuityServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();
    private final DramaShortContinuityService service = new DramaShortContinuityService(OM);

    @Test
    void enrichesScriptWithoutSecondModelOutputAndSeparatesVisualFromPerformanceTraits() throws Exception {
        ObjectNode script = (ObjectNode) OM.readTree("""
                {"meta":{"title":"喵影江湖","scene":"雨夜客栈","character":{"name":"喵无影","description":"嘴硬，口头禅是本喵懒得理你"}},
                 "scenes":[
                   {"heading":"夜·客栈","dialogue":"本喵懒得理你","sfx":"瓦片碎裂","duration_sec":5},
                   {"heading":"夜·客栈","dialogue":"","bgm":"急促锣鼓","duration_sec":7}
                 ]}
                """);

        ObjectNode enriched = service.enrichScript(script);
        var manifest = enriched.path("continuity_manifest");

        assertEquals("1.0", manifest.path("version").asText());
        assertEquals("喵无影", manifest.path("characters").path(0).path("visualTraits").asText());
        assertFalse(manifest.path("characters").path(0).path("visualTraits").asText().contains("口头禅"));
        assertTrue(manifest.path("characters").path(0).path("performanceTraits").asText().contains("口头禅"));
        assertEquals("shot-01", enriched.path("scenes").path(0).path("id").asText());
        assertEquals("shot-01", manifest.path("shots").path(1).path("parentShotId").asText());
        assertEquals(5, manifest.path("shots").path(1).path("audio").path("startSec").asInt());
        assertEquals(12, manifest.path("shots").path(1).path("audio").path("endSec").asInt());
    }

    @Test
    void preflightIsDeterministicAndReportsVoiceAndDroppedRefs() throws Exception {
        ObjectNode data = (ObjectNode) OM.readTree("""
                {"meta":{"scene":"客栈","character":{"name":"喵无影","description":""}},
                 "shots":[{"id":"s1","no":1,"dur":5,"visual":"跃上屋檐","voText":"退后","flow":"done","videoUrl":"/cdn/v.mp4",
                   "appliedRefs":{"requested":2,"applied":1}}]}
                """);

        var out = service.preflight(data);

        assertFalse(out.path("audioReady").asBoolean());
        assertFalse(out.path("assemblyReady").asBoolean());
        assertEquals("s1", out.path("dependencyPlan").path(0).path("shotId").asText());
        String issues = out.path("issues").toString();
        assertTrue(issues.contains("VOICE_SOURCE_REQUIRED"));
        assertTrue(issues.contains("REFS_DROPPED"));
    }

    // ── v0.143 提示词直出：visualBible 多角色 / 多场景锚点 ──────────────────────

    @Test
    void visualBibleDrivesMultiCharacterAndSceneAnchors() throws Exception {
        ObjectNode data = (ObjectNode) OM.readTree("""
                {"meta":{"title":"沙漠访谈","scene":"沙漠寺院","character":{"name":"云曦","description":"温柔但不好糊弄"}},
                 "visualBible":{"universal":"暖金逆光，浮尘",
                   "characters":[{"name":"云曦","visual":"月白襦裙，鎏金步摇","performance":"提问时身体微微前倾"},
                                 {"name":"赛博猴王","visual":"金橙长发，银蓝机械头冠","performance":"吹牛时手舞足蹈"}],
                   "scenes":[{"name":"寺院访谈区","visual":"朱红立柱，青灰琉璃瓦，午后斜阳"},
                             {"name":"沙丘远景","visual":"起伏沙丘与湛蓝天空"}]},
                 "shots":[
                   {"id":"s1","no":1,"dur":4,"visual":"两人入座","castNames":["云曦","赛博猴王"],"sceneName":"寺院访谈区"},
                   {"id":"s2","no":2,"dur":5,"visual":"空镜：远处沙丘","castNames":[],"sceneName":"沙丘远景"},
                   {"id":"s3","no":3,"dur":3,"visual":"猴王特写"}
                 ]}
                """);

        var manifest = service.ensureDraft(data);

        assertEquals(2, manifest.path("characters").size());
        assertEquals("character-main", manifest.path("characters").path(0).path("id").asText());
        assertEquals("character-2", manifest.path("characters").path(1).path("id").asText());
        // 视觉锚点带名字 + 外貌；表演描述绝不混进视觉（否则一句台词污染所有镜头）。
        assertTrue(manifest.path("characters").path(1).path("visualTraits").asText().contains("银蓝机械头冠"));
        assertFalse(manifest.path("characters").path(1).path("visualTraits").asText().contains("手舞足蹈"));
        assertTrue(manifest.path("characters").path(1).path("performanceTraits").asText().contains("手舞足蹈"));

        assertEquals(2, manifest.path("scenes").size());
        assertEquals("朱红立柱，青灰琉璃瓦，午后斜阳", manifest.path("scenes").path(0).path("visualTraits").asText());

        // 镜 1：两人都在 → 两个角色锚点；场景按名字挂到对应场景。
        assertEquals(2, manifest.path("shots").path(0).path("castIds").size());
        assertEquals("scene-main", manifest.path("shots").path(0).path("sceneId").asText());
        // 镜 2：显式空 castNames = 纯空镜，不能被补成全员。
        assertEquals(0, manifest.path("shots").path(1).path("castIds").size());
        assertEquals("scene-2", manifest.path("shots").path(1).path("sceneId").asText());
        // 镜 3：没写 castNames（老草稿 / 模型漏字段）→ 按全员锚定，不丢一致性。
        assertEquals(2, manifest.path("shots").path(2).path("castIds").size());
        assertEquals("scene-main", manifest.path("shots").path(2).path("sceneId").asText());
    }

    @Test
    void withoutVisualBibleCastNamesIsIgnoredSoLegacyDraftsBehaveExactlyAsBefore() throws Exception {
        // AI 对话线的老草稿即便（历史/自定义客户端）带了 castNames，也必须按旧规则始终锚定主角，
        // 否则同一份 payload 在升级前后会得出不同的锚点。
        ObjectNode data = (ObjectNode) OM.readTree("""
                {"meta":{"scene":"清晨出租屋","character":{"name":"阿杰","description":"急性子"}},
                 "shots":[{"id":"s1","no":1,"dur":4,"visual":"闹钟狂响","castNames":[]}]}
                """);

        var manifest = service.ensureDraft(data);

        assertEquals(1, manifest.path("shots").path(0).path("castIds").size());
        assertEquals("character-main", manifest.path("shots").path(0).path("castIds").path(0).asText());
    }

    @Test
    void withoutVisualBibleLegacySingleAnchorBehaviourIsUnchanged() throws Exception {
        ObjectNode data = (ObjectNode) OM.readTree("""
                {"meta":{"scene":"清晨出租屋","character":{"name":"阿杰","description":"急性子"}},
                 "characterAvatar":{"id":"dh-1","image":"https://cdn.test/a.jpg"},
                 "shots":[{"id":"s1","no":1,"dur":4,"visual":"闹钟狂响"}]}
                """);

        var manifest = service.ensureDraft(data);

        assertEquals(1, manifest.path("characters").size());
        assertEquals("character-main", manifest.path("characters").path(0).path("id").asText());
        assertEquals("阿杰", manifest.path("characters").path(0).path("visualTraits").asText());
        assertEquals("dh-1", manifest.path("characters").path(0).path("avatarId").asText());
        assertEquals(1, manifest.path("scenes").size());
        assertEquals("清晨出租屋", manifest.path("scenes").path(0).path("visualTraits").asText());
        assertEquals("scene-main", manifest.path("shots").path(0).path("sceneId").asText());
        assertEquals("character-main", manifest.path("shots").path(0).path("castIds").path(0).asText());
    }
}
