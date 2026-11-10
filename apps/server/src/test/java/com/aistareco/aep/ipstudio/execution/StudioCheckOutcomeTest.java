package com.aistareco.aep.ipstudio.execution;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** Three-state check verdicts with engineering-owned evidence; a model pass never outranks missing evidence. */
class StudioCheckOutcomeTest {
    final ObjectMapper om=new ObjectMapper();
    final List<Double> times=StudioCheckOutcome.sampleTimes(12,4);

    @Test void sampleTimesMatchTheFourFrameVisualContext() {assertEquals(List.of(1.5,4.5,7.5,10.5),times);}

    /** 2026-11-10：14 秒 9 个镜头的成片均匀抽 4 帧，多数镜头一帧都看不到。按镜头抽：每镜开头结尾各一帧，短镜头取中间。 */
    @Test void everyShotIsSeenWhenSamplingByShots() {
        var cuts=List.of(2.033,3.8,5.833,6.4,6.733,7.6,9.267,11.133);
        var picked=StudioCheckOutcome.shotTimes(14.16,cuts);
        double from=0;
        for(double to:new double[]{2.033,3.8,5.833,6.4,6.733,7.6,9.267,11.133,14.16}) {
            final double a=from,b=to;
            assertTrue(picked.stream().anyMatch(t->t>a&&t<b),"镜头 "+a+"–"+b+" 至少一帧");
            from=to;
        }
        assertEquals(List.of(0.3,1.73),picked.subList(0,2),"第一镜取开头和结尾");
        assertTrue(picked.contains(6.57),"0.33 秒的镜头取中间一帧");
        assertTrue(picked.size()<=StudioCheckOutcome.MAX_SHOT_FRAMES);
        for(int i=1;i<picked.size();i++)assertTrue(picked.get(i)>picked.get(i-1));
        // 一镜到底（或没测到切镜）：大约每 2 秒一帧
        assertEquals(7,StudioCheckOutcome.shotTimes(14,List.of()).size());
        assertEquals(4,StudioCheckOutcome.shotTimes(3,List.of()).size());
        // 切得很碎：不超过上限
        List<Double> many=new java.util.ArrayList<>();for(int i=1;i<40;i++)many.add(i*1.5);
        assertEquals(StudioCheckOutcome.MAX_SHOT_FRAMES,StudioCheckOutcome.shotTimes(60,many).size());
    }

    @Test void evidenceMustCiteARealSampledFrame() throws Exception {
        var answer=om.readTree("""
            {"status":"pass","items":[
              {"id":"subject-replaced","status":"pass","evidence":[{"kind":"frame","timeSec":4.5,"observation":"手里是蓝色保温杯"}],"reason":"新商品出现"},
              {"id":"old-subject-residue","status":"pass","evidence":[{"kind":"frame","timeSec":3.3,"observation":"编造的时间"}],"reason":"没看到旧包装"},
              {"id":"dialogue-and-subtitles","status":"pass","evidence":[{"kind":"text","observation":"字幕应该没问题"}],"reason":"猜的"},
              {"id":"not-requested","status":"fail","evidence":[],"reason":"多余项"}]}""");
        var result=StudioCheckOutcome.normalize(answer,List.of("subject-replaced","old-subject-residue","dialogue-and-subtitles","character-consistency"),times,false,true,"IPR-v","key.mp4");
        assertEquals("unknown",result.path("status").asText(),"the model's overall pass is recomputed");
        assertEquals(4,result.path("items").size());
        assertEquals("pass",result.path("items").get(0).path("status").asText());
        assertEquals(4.5,result.path("items").get(0).path("evidence").get(0).path("timeSec").asDouble());
        assertEquals("unknown",result.path("items").get(1).path("status").asText(),"invented frame time drops the evidence");
        assertEquals(0,result.path("items").get(1).path("evidence").size());
        assertEquals("unknown",result.path("items").get(2).path("status").asText(),"text alone never justifies a verdict");
        assertEquals("unknown",result.path("items").get(3).path("status").asText(),"missing item stays unknown");
        assertEquals("[1.5,4.5,7.5,10.5]",result.path("sampledTimesSec").toString());
        assertEquals("IPR-v",result.path("targetRunId").asText());
    }

    @Test void anyGroundedFailMakesTheResultFailAndImagesNeedNoClock() throws Exception {
        var video=StudioCheckOutcome.normalize(om.readTree("{\"items\":[{\"id\":\"a\",\"status\":\"fail\",\"evidence\":[{\"kind\":\"frame\",\"timeSec\":1.5,\"observation\":\"旧包装还在\"}],\"reason\":\"残留\",\"suggestion\":\"提示词写明去掉旧包装\"},{\"id\":\"b\",\"status\":\"pass\",\"evidence\":[{\"kind\":\"media\",\"observation\":\"时长 12 秒\"}],\"reason\":\"时长对\"}]}"),
                List.of("a","b"),times,false,true,"r",null);
        assertEquals("fail",video.path("status").asText());assertEquals("pass",video.path("items").get(1).path("status").asText(),"server-measured media facts are a valid source");
        var image=StudioCheckOutcome.normalize(om.readTree("{\"items\":[{\"id\":\"a\",\"status\":\"pass\",\"evidence\":[{\"kind\":\"frame\",\"observation\":\"商品正面清晰\"}],\"reason\":\"对\"}]}"),
                List.of("a"),List.of(),true,false,"r","img.png");
        assertEquals("pass",image.path("status").asText());
        var clocked=StudioCheckOutcome.normalize(om.readTree("{\"items\":[{\"id\":\"a\",\"status\":\"pass\",\"evidence\":[{\"kind\":\"frame\",\"timeSec\":2,\"observation\":\"x\"}],\"reason\":\"对\"}]}"),
                List.of("a"),List.of(),true,false,"r","img.png");
        assertEquals("unknown",clocked.path("status").asText(),"an image has no frame clock to cite");
    }

    @Test void malformedAnswersAreRefusedNotPassed() {
        assertThrows(com.aistareco.common.BusinessException.class,()->StudioCheckOutcome.normalize(om.createObjectNode().put("status","pass"),List.of("a"),times,false,true,"r",null));
    }
}
