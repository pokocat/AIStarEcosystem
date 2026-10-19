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
