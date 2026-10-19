package com.aistareco.aep.ipstudio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Model replies come back fenced or wrapped in a sentence; the object inside is read as-is and never repaired. */
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

    interface Thrower<T> { T get() throws Exception; }
    static <T> T assertDoesNotThrowValue(Thrower<T> thrower) {
        try { return thrower.get(); } catch (Exception e) { throw new AssertionError(e); }
    }
}
