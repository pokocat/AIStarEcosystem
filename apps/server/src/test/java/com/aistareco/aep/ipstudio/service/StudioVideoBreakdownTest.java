package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** 拉片 v2 的结构整理与分段（不调模型）。 */
class StudioVideoBreakdownTest {
    final ObjectMapper om=new ObjectMapper();

    @Test
    void scdetLogBecomesCutsMergedAndAwayFromTheEnds() {
        String log="[scdet @ 0x1] lavfi.scd.score: 30.1, lavfi.scd.time: 0.1\n"
                +"[scdet @ 0x1] lavfi.scd.score: 30.1, lavfi.scd.time: 1.8\n"
                +"[scdet @ 0x1] lavfi.scd.score: 30.1, lavfi.scd.time: 1.866667\n"
                +"[scdet @ 0x1] lavfi.scd.score: 30.1, lavfi.scd.time: 3.666667\n"
                +"[scdet @ 0x1] lavfi.scd.score: 30.1, lavfi.scd.time: 9.9\n";
        assertEquals(List.of(1.8,3.667),StudioVideoBreakdown.cuts(log,10.05));
    }

    @Test
    void shotsAreSortedMadeContiguousAndCoverTheWholeFilm() throws Exception {
        JsonNode raw=om.readTree("""
            {"summary":"老板娘劝阿姨离开","shots":[
              {"start":2.0,"end":4.0,"visual":"老板娘招呼","dialogue":[{"who":"P2","text":"你进来坐会吧"}]},
              {"start":0.3,"end":1.8,"visual":"阿姨在门口"},
              {"start":4.1,"end":9.5,"visual":"男子问价","caption":"这款¥40"}
            ],"parts":[{"name":"钩子","start":0,"end":2},{"name":"反转","start":2,"end":8}],
             "remake":{"keep":["三人对话"],"change":"原来是啤酒 → 换成你的商品"}}""");
        var b=StudioVideoBreakdown.normalize(raw,10.0,List.of(1.8,3.7,5.8));
        var shots=b.path("shots");
        assertEquals(3,shots.size());
        assertEquals(0.0,shots.get(0).path("start").asDouble());
        assertEquals("阿姨在门口",shots.get(0).path("visual").asText());
        assertEquals(shots.get(0).path("end").asDouble(),shots.get(1).path("start").asDouble());
        assertEquals(shots.get(1).path("end").asDouble(),shots.get(2).path("start").asDouble());
        assertEquals(10.0,shots.get(2).path("end").asDouble());
        assertEquals("你进来坐会吧",shots.get(1).path("dialogue").get(0).path("text").asText());
        assertEquals(10.0,b.path("parts").get(1).path("end").asDouble(),"最后一段落延到片尾");
        assertEquals(1,b.path("remake").path("change").size(),"一句话写成字符串也收下");
        assertFalse(b.has("shotsFromCuts"));
    }

    @Test
    void withoutUsableShotsTheRealCutsBecomeEmptyShots() throws Exception {
        var b=StudioVideoBreakdown.normalize(om.readTree("{\"summary\":\"x\",\"shots\":\"坏的\"}"),6.0,List.of(2.0,4.0));
        assertTrue(b.path("shotsFromCuts").asBoolean());
        assertEquals(3,b.path("shots").size());
        assertEquals(6.0,b.path("shots").get(2).path("end").asDouble());
    }

    @Test
    void unitsPackWholeShotsUpToTheModelMaximum() throws Exception {
        // 60 秒、35 个镜头左右的门店片：每段不超过 15 秒、只在镜头边界切
        StringBuilder shots=new StringBuilder("[");
        double t=0;int n=0;
        while(t<60){double end=Math.min(60,t+1.7);if(n>0)shots.append(',');shots.append("{\"start\":").append(t).append(",\"end\":").append(end).append('}');t=end;n++;}
        shots.append(']');
        var b=StudioVideoBreakdown.normalize(om.readTree("{\"shots\":"+shots+"}"),60,List.of());
        var units=StudioVideoBreakdown.units(b,15,4,8);
        assertEquals(5,units.size());
        double previous=0;
        for(var u:units){assertEquals(previous,u.startSec(),1e-6);assertTrue(u.length()<=15+1e-6);previous=u.endSec();}
        assertEquals(60,previous,1e-6);
        for(var u:units)assertEquals(b.path("shots").get(u.firstShot()).path("start").asDouble(),u.startSec(),1e-6,"段从镜头开头切");
    }

    @Test
    void aShortTailBorrowsAShotWhenItCannotBeMerged() throws Exception {
        // 贪心装满后尾段只剩 1.5 秒（并进前一段会超过 15 秒）：从前一段挪一个镜头过来
        var b=StudioVideoBreakdown.normalize(om.readTree("{\"shots\":[{\"start\":0,\"end\":10},{\"start\":10,\"end\":14},{\"start\":14,\"end\":15.5}]}"),15.5,List.of());
        var units=StudioVideoBreakdown.units(b,15,4,8);
        assertEquals(2,units.size());
        assertEquals(10,units.get(0).endSec(),1e-6);
        assertEquals(10,units.get(1).startSec(),1e-6);
        assertEquals(10,b.path("shots").get(units.get(1).firstShot()).path("start").asDouble(),1e-6,"第二段从 10 秒那个镜头开始（10 秒的镜头先切成了两拍）");
    }

    @Test
    void noUnitIsShorterThanTheModelMinimumWhenShotsAllowIt() throws Exception {
        var b=StudioVideoBreakdown.normalize(om.readTree("{\"shots\":[{\"start\":0,\"end\":7},{\"start\":7,\"end\":13},{\"start\":13,\"end\":14}]}"),14,List.of());
        var units=StudioVideoBreakdown.units(b,13,4,8);
        assertEquals(2,units.size());
        for(var u:units)assertTrue(u.length()>=4-1e-6,"没有短于 4 秒的段："+units);
    }

    @Test
    void aLongSingleShotBecomesBeatsAndUnitsCutBetweenBeats() throws Exception {
        // 41 秒一镜到底的直播切片：先切成不超过 6 秒的拍，再按 15 秒装段
        var b=StudioVideoBreakdown.normalize(om.readTree("{\"shots\":[{\"start\":0,\"end\":41.4}]}"),41.4,List.of());
        assertEquals(7,b.path("shots").size());
        var units=StudioVideoBreakdown.units(b,15,4,8);
        double previous=0;
        for(var u:units) {
            assertEquals(previous,u.startSec(),1e-6);assertTrue(u.length()<=15+1e-6&&u.length()>=4-1e-6,units.toString());
            assertEquals(b.path("shots").get(u.firstShot()).path("start").asDouble(),u.startSec(),1e-6,"段只在拍的边界切");
            previous=u.endSec();
        }
        assertEquals(41.4,previous,1e-6);
    }

    @Test
    void tooManyUnitsIsTheSameErrorAsTheOldFilmStudy() throws Exception {
        var b=StudioVideoBreakdown.normalize(om.readTree("{\"shots\":[{\"start\":0,\"end\":60}]}"),60,List.of());
        var e=assertThrows(BusinessException.class,()->StudioVideoBreakdown.units(b,5,1,8));
        assertEquals("STUDIO_SEGMENT_TOO_LONG",e.getCode());
    }

    @Test
    void reportAndUnitDocumentsAreTables() throws Exception {
        var b=StudioVideoBreakdown.normalize(om.readTree("""
            {"type":"剧情口播","summary":"s","people":[{"id":"P1","who":"女老板","role":"主角","speaks":true}],
             "shots":[{"start":0,"end":2,"size":"中景","camera":"固定","visual":"招呼|进门","dialogue":[{"who":"P1","text":"进来坐"}],"caption":"热"}],
             "highlights":["前2秒冲突"],"remake":{"keep":["结构"]}}"""),2,List.of());
        String report=StudioVideoBreakdown.report(b);
        assertTrue(report.contains("| 1 | 0–2 秒 | 中景 / 固定 | 招呼｜进门 | P1：进来坐 | 热 |"),report);
        var unit=StudioVideoBreakdown.units(b,15,4,8).get(0);
        assertTrue(StudioVideoBreakdown.unitMarkdown(b,unit).startsWith("# 第 1 段"));
    }

    /** 2026-11-09 真跑：模型没把 41 秒的一镜到底拆成几拍，分段时每段都带着全部台词，写提示词的模型只能猜哪句归哪段。 */
    @Test
    void aLongContinuousShotIsSplitIntoBeatsAtTheGapsBetweenLines() throws Exception {
        JsonNode raw=om.readTree("""
            {"shots":[{"start":0,"end":20,"visual":"主播带货","dialogue":[
              {"who":"P1","at":0.5,"text":"它是新品对不对"},{"who":"P2","at":2.8,"text":"对"},
              {"who":"P1","at":5.4,"text":"抹上去三二一来"},{"who":"P2","at":8.2,"text":"吸收了"},
              {"who":"P1","at":12.6,"text":"倒数三个数"},{"who":"P2","at":17.1,"text":"三二一"}]}]}""");
        var b=StudioVideoBreakdown.normalize(raw,20,List.of());
        var shots=b.path("shots");
        assertTrue(shots.size()>=4,"20 秒按不超过 6 秒一拍切开");
        int lines=0;
        for(int i=0;i<shots.size();i++) {
            var shot=shots.get(i);
            assertTrue(shot.path("end").asDouble()-shot.path("start").asDouble()<=6.0+1e-6||i==shots.size()-1);
            for(JsonNode d:shot.path("dialogue")) {
                lines++;
                double at=d.path("at").asDouble();
                assertTrue(at>=shot.path("start").asDouble()&&at<=shot.path("end").asDouble(),"每拍只带在这一拍里开始说的话");
            }
            if(i<shots.size()-1)assertEquals("同一镜头接着拍",shot.path("transition").asText());
        }
        assertEquals(6,lines,"一句都没丢，也没有重复");
        // 切点落在两句之间：每拍的开始在上一句之后、这一拍第一句之前
        double previousLine=-1;
        for(JsonNode shot:shots) {
            assertTrue(shot.path("start").asDouble()>previousLine||previousLine<0);
            for(JsonNode d:shot.path("dialogue"))previousLine=d.path("at").asDouble();
        }
    }

    @Test
    void untimedLinesAreSpreadByLengthSoEachBeatStillGetsItsOwn() throws Exception {
        JsonNode raw=om.readTree("""
            {"shots":[{"start":0,"end":13,"visual":"一镜到底","dialogue":[
              {"who":"P1","text":"第一句话说得比较长一些"},{"who":"P1","text":"第二句"},{"who":"P1","text":"第三句话也挺长的一句"}]}]}""");
        var shots=StudioVideoBreakdown.normalize(raw,13,List.of()).path("shots");
        assertTrue(shots.size()>=3);
        int lines=0;for(JsonNode s:shots)lines+=s.path("dialogue").size();
        assertEquals(3,lines);
        assertTrue(shots.get(0).path("dialogue").size()<3,"台词分到了几拍里，不是都堆在第一拍");
    }

    @Test
    void aUnitTableShowsOnlyItsOwnPartOfAShotSplitAcrossUnits() throws Exception {
        // 模型最长 5 秒：6 秒一拍的镜头也要被分段均分，每段只看到自己那一半的时间和台词
        JsonNode raw=om.readTree("""
            {"shots":[{"start":0,"end":6,"visual":"一镜到底","dialogue":[{"who":"P1","at":0.5,"text":"前半句"},{"who":"P1","at":4.0,"text":"后半句"}]}]}""");
        var b=StudioVideoBreakdown.normalize(raw,6,List.of());
        var units=StudioVideoBreakdown.units(b,5,2,8);
        assertEquals(2,units.size());
        String first=StudioVideoBreakdown.unitMarkdown(b,units.get(0)),second=StudioVideoBreakdown.unitMarkdown(b,units.get(1));
        assertTrue(first.contains("前半句")&&!first.contains("后半句"),first);
        assertTrue(second.contains("后半句")&&!second.contains("前半句"),second);
        assertTrue(second.contains("| 3–6 秒 |"),"时间截到这一段内："+second);
    }
}
