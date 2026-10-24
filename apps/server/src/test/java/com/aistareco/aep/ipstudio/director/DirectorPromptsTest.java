package com.aistareco.aep.ipstudio.director;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DirectorPromptsTest {

    @Test
    void scriptPromptAppendsChosenGenreAndToneRules() {
        String p = DirectorPrompts.script("奇幻脑洞", "治愈温情");
        assertTrue(p.startsWith(DirectorPrompts.SCRIPT));
        assertTrue(p.contains(DirectorPrompts.GENRES.get("奇幻脑洞")));
        assertTrue(p.contains(DirectorPrompts.TONES.get("治愈温情")));
        assertTrue(p.indexOf("【题材：奇幻脑洞】") < p.indexOf("【调性：治愈温情】"));
    }

    @Test
    void scriptPromptWithoutTagsIsTheBasePrompt() {
        assertEquals(DirectorPrompts.SCRIPT, DirectorPrompts.script(null, null));
        assertEquals(DirectorPrompts.SCRIPT, DirectorPrompts.script("不存在的题材", ""));
    }

    @Test
    void basePromptKeepsTheOutputContract() {
        // 编剧提示词换了写法，输出仍是导演台的 {title, logline, content}，后面的拆分 / 提取都读 content。
        assertTrue(DirectorPrompts.SCRIPT.contains("\"outline\":{\"world\""));
        assertTrue(DirectorPrompts.SCRIPT.contains("\"content\":\"完整剧本正文\"}"));
        assertEquals(6, DirectorPrompts.GENRES.size());
        assertEquals(5, DirectorPrompts.TONES.size());
    }

    @Test
    void scriptOutputKeepsTheOutlineAndToleratesItsAbsence() throws Exception {
        ObjectMapper om = new ObjectMapper();
        JsonNode meta = om.readTree("{\"task\":\"script\"}");
        String body = "\"content\":\"# 第1集 掉漆\\n## 第1场 莫高窟第17窟 · 深夜\\n陈默：钱我还在凑。\"";
        JsonNode with = DirectorPrompts.validate(om, meta, om.readTree("{\"title\":\"泥与光\",\"outline\":{\"world\":\"飞仙会动\",\"characters\":[{\"name\":\"陈默\",\"flaw\":\"爱面子\"},{\"name\":\"\"}],\"plot\":\"起承转合\"}," + body + "}"));
        assertEquals("飞仙会动", with.path("outline").path("world").asText());
        assertEquals(1, with.path("outline").path("characters").size(), "nameless characters are dropped");
        assertEquals("爱面子", with.path("outline").path("characters").get(0).path("flaw").asText());
        JsonNode without = DirectorPrompts.validate(om, meta, om.readTree("{\"title\":\"泥与光\"," + body + "}"));
        assertTrue(without.path("outline").isMissingNode());
    }
}
