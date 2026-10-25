package com.aistareco.aep.ipstudio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

/** Recover syntax without inventing values; ambiguous or incomplete model output remains an error. */
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

    @Test void productionScriptWithStrayHanEscapeAndMissingFinalBraceIsRecoveredWithoutRewriting() throws Exception {
        // 2026-10-25 Qwen: finish=stop, invalid \\远 plus a missing final }. Minimal excerpt of the real failure.
        String reply = "{\"title\":\"账本\",\"content\":\"两人相视一笑，没有言语。\\远处，孩子们的笑声传来。\"";
        var result = ModelJson.parse(om, reply);
        assertEquals("账本", result.path("title").asText());
        assertEquals("两人相视一笑，没有言语。远处，孩子们的笑声传来。", result.path("content").asText());
        assertThrows(JsonProcessingException.class, () -> om.readTree(reply), "the shared mapper remains strict");
    }

    @Test void literalLineBreaksAndTabsKeepTheirExactStringValue() throws Exception {
        String value = "第一行\n第二行\r\n\t缩进";
        assertEquals(value, ModelJson.parse(om, "{\"content\":\"" + value + "\"}").path("content").asText());
    }

    @Test void validEscapesAndLiteralBackslashesAreNeverReinterpretedDuringRepair() throws Exception {
        String value = "原有\\远处、C:\\new\\file、引号\"、换行\n、制表\t、/";
        String valid = om.createObjectNode().put("content", value).toString();
        assertEquals(value, ModelJson.parse(om, valid.substring(0, valid.length() - 1)).path("content").asText());
        assertEquals("远处", ModelJson.parse(om, "{\"content\":\"\\u8fdc处\",}").path("content").asText());
    }

    @Test void trailingCommasAreRemovedOnlyAfterCompleteValues() throws Exception {
        var result = ModelJson.parse(om, "```json\n{\"items\":[{\"text\":\"保留 ,} 和 ,]\",},],}\n```");
        assertEquals(1, result.path("items").size());
        assertEquals("保留 ,} 和 ,]", result.path("items").get(0).path("text").asText());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"content\":\"未知\\q转义\"}", "{\"content\":\"\\u12汉\"}",
            "{\"content\":\"不能补全的台词", "{\"outline\":{\"a\":1},\"content\":\"半句",
            "{\"a\":1,", "{\"a\":}", "{\"a\":,}", "{\"a\":1 \"b\":2}",
            "[,]", "[1,,]", "[{\"a\":1},{\"b\":", "说明：[{\"a\":1},{\"b\":", "{\"a\":[1}",
            "{\"a\":1} {\"b\":2}", "{\"a\":1} false", "{\"a\":1} ]",
            "null {\"a\":1}", "true {\"a\":1}", "123 {\"a\":1}", "{\"a\":1},", "} {\"a\":1}",
            "\"这还是一个半截字符串 {\"a\":1}",
            "{\"a\":1,\"a\":2}", "说明：{\"a\":1} 后面还有 {\"b\":2}"
    })
    void ambiguousIncompleteOrMultipleDocumentsAreRefused(String reply) {
        assertThrows(JsonProcessingException.class, () -> ModelJson.parse(om, reply));
    }
}
