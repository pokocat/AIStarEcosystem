package com.aistareco.aep.ipstudio.dialogue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** The canvas reader reads the script the user adopted, never an unsaved draft or a pending AI proposal. */
class StudioWritingContentTest {
    private static final ObjectMapper OM = new ObjectMapper();
    private static JsonNode node(String json) throws Exception { return OM.readTree(json); }

    @Test void theSavedScriptWinsOverTheEditorDraftAndTheProposal() throws Exception {
        var n = node("""
                {"type":"text","metadata":{"content":"旧正文","studio":{"scriptMarkdown":"# 第1集\\n采用的版本",
                 "scriptEditor":{"draft":"没保存的草稿","turns":[],"proposal":{"markdown":"AI 建议","summary":"","baseMarkdown":"","runId":"r"}}}}}""");
        assertEquals("# 第1集\n采用的版本", DialogueCanvasDigest.excerpt(n));
    }

    @Test void aBlankSavedFieldFallsBackInsteadOfReadingAsEmpty() throws Exception {
        var n = node("""
                {"type":"text","metadata":{"content":"正文还在","studio":{"scriptMarkdown":"  "}}}""");
        assertEquals("正文还在", DialogueCanvasDigest.excerpt(n));
    }

    @Test void aGeneratedScriptNotYetSavedInTheEditorIsReadable() throws Exception {
        var n = node("""
                {"type":"script","metadata":{"studio":{"script":{"title":"外卖小哥与猫","outline":"捡到会说话的猫",
                 "characters":[{"name":"小周","description":"外卖员","secret":"x"}],"scenes":[],"props":[],
                 "episodes":[{"no":1,"title":"相遇","content":"雨夜"}],"shots":[]}}}}""");
        String text = DialogueCanvasDigest.excerpt(n);
        assertTrue(text.contains("外卖小哥与猫") && text.contains("雨夜") && text.contains("小周"), text);
        assertFalse(text.contains("secret"), "only the script's own fields are read");
    }

    @Test void aShotIsReadAndAMediaPromptStaysThePrompt() throws Exception {
        var shot = node("""
                {"type":"shot","metadata":{"studio":{"shot":{"id":"s1","title":"开场","description":"推门进店","dialogue":"欢迎光临","durationSec":4,"characters":["店员"]}}}}""");
        assertTrue(DialogueCanvasDigest.excerpt(shot).contains("推门进店"));
        var image = node("""
                {"type":"image","metadata":{"prompt":"国风少女"}}""");
        assertEquals("提示词：国风少女", DialogueCanvasDigest.excerpt(image));
    }
}
