package com.aistareco.aep.ipstudio.segmented;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class SegmentedScriptTest {
    private static final ObjectMapper OM = new ObjectMapper();
    private static final List<SegmentedPlan.Segment> PLAN = SegmentedPlan.segments(30, 5, 15, false);

    private static JsonNode raw(String shotsOne, String shotsTwo) throws Exception {
        return OM.readTree("""
                {"title":"锅盔","summary":"探店","style":"真人写实","assets":[{"name":"小夏","kind":"character","ref":"图1","description":"短发","voice":"年轻女声"},{"name":"路人","kind":"weird","ref":"图9","description":"","voice":""}],
                 "segments":[{"no":1,"title":"开场","summary":"进店","shots":[%s]},{"no":2,"title":"结尾","summary":"吃","shots":[%s]}]}""".formatted(shotsOne, shotsTwo));
    }
    private static String shot(double seconds, String speaker, String text) {
        return "{\"durationSec\":%s,\"size\":\"近景\",\"camera\":\"固定机位\",\"still\":\"小夏举起锅盔\",\"action\":\"小夏咬一口\",\"dialogue\":[{\"speaker\":\"%s\",\"text\":\"%s\"}]}".formatted(seconds, speaker, text);
    }

    @Test void theWrongNumberOfSegmentsFailsAndIsRefunded() {
        var e = assertThrows(BusinessException.class, () -> SegmentedScript.normalize(OM, OM.readTree("{\"segments\":[{\"shots\":[]}]}"), PLAN, 0));
        assertEquals("AI_BAD_OUTPUT", e.getCode());
    }

    @Test void secondsThatDoNotAddUpAreSpreadOverTheShots() throws Exception {
        var out = SegmentedScript.normalize(OM, raw(shot(3, "小夏", "好吃") + "," + shot(3, "小夏", "真的"), shot(5, "小夏", "快来") + "," + shot(10, "小夏", "快来")), PLAN, 1);
        double first = 0;
        for (JsonNode s : out.path("segments").get(0).path("shots")) first += s.path("durationSec").asDouble();
        assertEquals(15, first, 0.01);
    }

    @Test void moreShotsThanTheBoardHoldsAreMergedAndNothingIsLost() throws Exception {
        String five = String.join(",", shot(3, "小夏", "一"), shot(3, "小夏", "二"), shot(3, "小夏", "三"), shot(3, "小夏", "四"), shot(3, "小夏", "五"));
        var out = SegmentedScript.normalize(OM, raw(five, shot(15, "小夏", "结尾")), PLAN, 1);
        JsonNode shots = out.path("segments").get(0).path("shots");
        assertEquals(4, shots.size());
        assertEquals(2, shots.get(3).path("dialogue").size());
        assertEquals("五", shots.get(3).path("dialogue").get(1).path("text").asText());
    }

    @Test void onlyAKnownReferenceNumberIsKeptAndTheNarratorHasNoSpeaker() throws Exception {
        var out = SegmentedScript.normalize(OM, raw(shot(15, "旁白", "开场"), shot(15, "小夏", "结尾")), PLAN, 1);
        assertEquals("图1", out.path("assets").get(0).path("ref").asText());
        assertFalse(out.path("assets").get(1).has("ref"));
        assertEquals("character", out.path("assets").get(1).path("kind").asText());
        assertFalse(out.path("segments").get(0).path("shots").get(0).path("dialogue").get(0).has("speakerId"));
    }

    @Test void issuesNameTheShotsThatCannotBeSpokenOrHaveTwoSpeakers() throws Exception {
        String two = "{\"durationSec\":15,\"size\":\"中景\",\"camera\":\"固定\",\"still\":\"两人\",\"action\":\"\",\"dialogue\":[{\"speaker\":\"小夏\",\"text\":\"好\"},{\"speaker\":\"老板\",\"text\":\"嗯\"}]}";
        var out = SegmentedScript.normalize(OM, raw(shot(15, "小夏", "这".repeat(80)), two), PLAN, 1);
        var issues = SegmentedScript.issues(out, PLAN);
        assertTrue(issues.stream().anyMatch(i -> i.contains("第 1 段第 1 镜") && i.contains("念不完")), issues.toString());
        assertTrue(issues.stream().anyMatch(i -> i.contains("第 2 段第 1 镜") && i.contains("2 个人说话")), issues.toString());
        assertTrue(issues.stream().anyMatch(i -> i.contains("第 1 段只有 1 个镜头")), issues.toString());
    }

    @Test void theSecondBoardOnlyExistsWhenThereAreMoreThanFourShots() throws Exception {
        var plan = SegmentedPlan.segments(30, 4, 30, false);
        String six = String.join(",", shot(5, "小夏", "一"), shot(5, "小夏", "二"), shot(5, "小夏", "三"), shot(5, "小夏", "四"), shot(5, "小夏", "五"), shot(5, "小夏", "六"));
        var out = SegmentedScript.normalize(OM, OM.readTree("{\"segments\":[{\"shots\":[" + six + "]}]}"), plan, 0);
        JsonNode segment = out.path("segments").get(0);
        assertEquals(4, SegmentedScript.boardShots(segment, 0).size());
        assertEquals(2, SegmentedScript.boardShots(segment, 1).size());
        var short4 = SegmentedScript.normalize(OM, OM.readTree("{\"segments\":[{\"shots\":[" + shot(30, "小夏", "一") + "]}]}"), plan, 0);
        assertTrue(SegmentedScript.boardShots(short4.path("segments").get(0), 1).isEmpty());
    }

    @Test void theRenderedTextIsWhatAPersonReads() throws Exception {
        var out = SegmentedScript.normalize(OM, raw(shot(15, "小夏", "好吃"), shot(15, "旁白", "快来")), PLAN, 1);
        String text = SegmentedScript.render(out, PLAN);
        assertTrue(text.contains("第1段（0–15 秒）"), text);
        assertTrue(text.contains("第2段（15–30 秒）"), text);
        assertTrue(text.contains("小夏说：「好吃」"), text);
        assertTrue(text.contains("旁白说：「快来」"), text);
        assertFalse(text.contains("{"), text);
    }
}
