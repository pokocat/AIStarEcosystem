package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.CheckSettings;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

/** One compiler for quotes and submissions: what is priced is exactly what is submitted. */
class StudioPlanStepsTest {
    final ObjectMapper om=new ObjectMapper();
    final StudioPlanSteps.Modes modes=Map.of("first-last",new StudioPlanSteps.ModeSpec(true,true,false),"omni",new StudioPlanSteps.ModeSpec(false,false,true))::get;
    StudioPlanSteps.Keys keys(String audio) {
        return new StudioPlanSteps.Keys() {
            public String binding(JsonNode b){return "key-"+(b.has("stepId")?b.path("stepId").asText():b.path("nodeId").asText());}
            public String clip(JsonNode c){return "clip-"+c.path("stepId").asText();}
            public String sourceAudio(){return audio;}
        };
    }
    StudioPlanSteps.Binding binding(CheckSettings check) {
        return new StudioPlanSteps.Binding("pe-1","PEX-1-p-s1",40L,new BillingSelection("personal",null),"PEX-1","reference-video-recreation",1,"production",List.of("canvas-a"),check);
    }

    @Test void videoBindingsBecomeOrderedFramesOrTypedReferences() throws Exception {
        var omni=om.readTree("{\"id\":\"v\",\"operation\":\"video\",\"prompt\":\"开播\",\"settings\":{\"video\":{\"mode\":\"omni\",\"resolutionTier\":\"768p\",\"seed\":7},\"durationSec\":12,\"aspectRatio\":\"9:16\",\"count\":2,"
                +"\"referenceBindings\":[{\"nodeId\":\"clip-node\",\"role\":\"reference-video\",\"order\":1},{\"stepId\":\"img\",\"role\":\"product\",\"order\":0}]}}");
        var request=StudioPlanSteps.request(omni,keys(null),modes,binding(null));
        assertEquals("video",request.operation());assertEquals(12,request.durationSec());assertEquals(2,request.count());assertEquals(40L,request.maxCost());
        assertEquals("PEX-1",request.executionId());assertEquals("personal",request.billing().mode());assertTrue(request.references().isEmpty());
        assertEquals("key-img",request.video().references().get(0).key());assertEquals("image",request.video().references().get(0).mediaType());
        assertEquals("video",request.video().references().get(1).mediaType());assertEquals(7L,request.video().seed());
        var frames=om.readTree("{\"id\":\"v\",\"operation\":\"video\",\"prompt\":\"动作\",\"settings\":{\"video\":{\"mode\":\"first-last\",\"resolutionTier\":\"768p\"},\"durationSec\":6,\"aspectRatio\":\"9:16\",\"count\":1,"
                +"\"referenceBindings\":[{\"stepId\":\"end\",\"role\":\"frame\",\"order\":1},{\"stepId\":\"start\",\"role\":\"frame\",\"order\":0}]}}");
        var framed=StudioPlanSteps.request(frames,keys(null),modes,binding(null)).video();
        assertEquals("key-start",framed.firstFrameKey());assertEquals("key-end",framed.lastFrameKey());
        var extra=om.readTree(frames.toString().replace("\"referenceBindings\":[","\"referenceBindings\":[{\"nodeId\":\"x\",\"role\":\"character\",\"order\":2},"));
        assertThrows(BusinessException.class,()->StudioPlanSteps.request(extra,keys(null),modes,binding(null)),"this mode accepts no other references");
        var unknown=om.readTree(omni.toString().replace("\"omni\"","\"not-in-contract\""));
        assertEquals("STUDIO_VIDEO_MODE_UNAVAILABLE",assertThrows(BusinessException.class,()->StudioPlanSteps.request(unknown,keys(null),modes,binding(null))).getCode());
    }

    @Test void recreationCheckTextAndAssembleCarryTheirTypedInputs() throws Exception {
        var recreation=StudioPlanSteps.request(om.readTree("{\"operation\":\"recreation\",\"prompt\":\"看结构\",\"settings\":{\"sourceNodeId\":\"src\",\"mode\":\"segments\",\"maxSegmentSec\":\"model\",\"videoModel\":\"ep-h3\"}}"),keys(null),modes,binding(null));
        assertEquals("segments",recreation.mode());assertEquals(List.of("src"),recreation.contextNodeIds());assertEquals("model",recreation.recreation().maxSegmentSec());
        var check=StudioPlanSteps.request(om.readTree("{\"operation\":\"check\",\"prompt\":\"\",\"settings\":{\"targetStepId\":\"v\",\"checkIds\":[\"subject-replaced\"]}}"),keys(null),modes,
                binding(new CheckSettings("IPR-v","v.mp4",List.of("subject-replaced"))));
        assertEquals("IPR-v",check.check().targetRunId());assertEquals("reference-video-recreation",check.skillKey());
        var compile=StudioPlanSteps.request(om.readTree("{\"operation\":\"text\",\"prompt\":\"编排\",\"settings\":{\"purpose\":\"plan-compile\"}}"),keys(null),modes,binding(null));
        assertEquals("production",compile.stage());assertEquals("reference-video-recreation",compile.skillKey());assertNull(compile.textEdit());
        var note=StudioPlanSteps.request(om.readTree("{\"operation\":\"text\",\"prompt\":\"写口播\",\"settings\":{\"purpose\":\"script\"}}"),keys(null),modes,binding(null));
        assertNull(note.skillKey(),"an ordinary text step must never read as a planning run");assertEquals("",note.textEdit().content());
        var assemble=om.readTree("{\"operation\":\"assemble\",\"settings\":{\"clipOrder\":[{\"stepId\":\"v1\"},{\"stepId\":\"v2\"}],\"audioStrategy\":\"source-audio\"}}");
        var assembled=StudioPlanSteps.request(assemble,keys("audio.m4a"),modes,binding(null));
        assertEquals(List.of("clip-v1","clip-v2"),assembled.references().stream().map(r->r.storageKey()).toList());
        assertEquals("audio.m4a",assembled.packaging().voiceoverStorageKey());
        assertEquals("STUDIO_SOURCE_AUDIO_UNAVAILABLE",assertThrows(BusinessException.class,()->StudioPlanSteps.request(assemble,keys(null),modes,binding(null))).getCode());
    }

    @Test void requestIdentityIsStablePerAttemptAndFitsTheColumn() {
        String first=StudioPlanExecutionIds.requestId("PEX-abc","production","v1",1);
        assertEquals(first,StudioPlanExecutionIds.requestId("PEX-abc","production","v1",1));
        assertNotEquals(first,StudioPlanExecutionIds.requestId("PEX-abc","production","v1",2));
        assertTrue(first.length()<=64);
        assertTrue(StudioPlanExecutionIds.segmentNodeId("PEX-"+"a".repeat(20),"analysis","b".repeat(32),8).length()<=64);
    }
}
