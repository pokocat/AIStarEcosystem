package com.aistareco.aep.ipstudio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Model replies come back fenced or wrapped in a sentence; the object inside is read as-is. Only missing final brackets are added. */
class ModelJsonTest {
    final ObjectMapper om = new ObjectMapper();

    @Test void plainObjectIsRead() throws Exception {
        assertEquals(1, ModelJson.parse(om, "{\"a\":1}").path("a").asInt());
    }

    @Test void fencesWithAndWithoutALanguageTagAreRemoved() throws Exception {
        assertEquals(1, ModelJson.parse(om, "```json\n{\"a\":1}\n```").path("a").asInt());
        assertEquals(1, ModelJson.parse(om, "```\n{\"a\":1}\n```  ").path("a").asInt());
        assertEquals("{\"a\":1}", ModelJson.stripFence("  ```json\n{\"a\":1}```"));
    }

    @Test void proseAroundTheObjectIsIgnoredOnlyWhenTheDirectReadFails() throws Exception {
        assertEquals(2, ModelJson.parse(om, "方案如下：{\"a\":2}。以上").path("a").asInt());
        assertEquals("x", ModelJson.parse(om, "{\"a\":\"} 在字符串里 {\",\"b\":\"x\"}").path("b").asText(), "a direct read wins over the brace heuristic");
    }

    @Test void whatIsNotJsonStaysAnError() {
        assertThrows(JsonProcessingException.class, () -> ModelJson.parse(om, "好的，我来整理"));
        assertThrows(JsonProcessingException.class, () -> ModelJson.parse(om, "```json\n{\"a\":\n```"));
        assertTrue(assertDoesNotThrowValue(() -> ModelJson.parse(om, "  ")).isMissingNode(), "a blank reply is a missing node for the caller to refuse");
    }

    @Test void missingFinalBracketsAreClosed() throws Exception {
        // 2026-10-24 线上：Qwen 写完剧本正文、引号也闭合了，只漏了最后的 }。
        assertEquals("泥与光", ModelJson.parse(om, "{\n\"title\": \"泥与光\",\n\"content\": \"# 第1集\\n陈默：再稳一点……\"").path("title").asText());
        assertEquals(2, ModelJson.parse(om, "{\"a\":[1,{\"b\":2}").path("a").get(1).path("b").asInt());
        assertEquals("x}y", ModelJson.parse(om, "{\"a\":\"x}y\"").path("a").asText(), "brackets inside strings are not counted");
    }

    @Test void truncatedRepliesStillFail() {
        assertThrows(JsonProcessingException.class, () -> ModelJson.parse(om, "{\"content\":\"第1集 陈默蹲在"), "cut off inside a string");
        assertThrows(JsonProcessingException.class, () -> ModelJson.parse(om, "{\"a\":1,"), "cut off after a comma");
        assertThrows(JsonProcessingException.class, () -> ModelJson.parse(om, "{\"a\":[1}"), "mismatched brackets are not guessed");
    }

    interface Thrower<T> { T get() throws Exception; }
    static <T> T assertDoesNotThrowValue(Thrower<T> thrower) {
        try { return thrower.get(); } catch (Exception e) { throw new AssertionError(e); }
    }
}
