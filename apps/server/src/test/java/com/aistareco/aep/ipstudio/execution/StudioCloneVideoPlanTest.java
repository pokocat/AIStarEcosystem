package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dto.StudioSegmentedDtos.SegmentedVideoRequest;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class StudioCloneVideoPlanTest {
    final ObjectMapper om=new ObjectMapper();
    final StudioVideoService videos=mock(StudioVideoService.class);
    final StudioWorkflowService workflow=mock(StudioWorkflowService.class);
    final StudioDepthVideoService depth=mock(StudioDepthVideoService.class);
    final IpProjectService projects=mock(IpProjectService.class);
    final StudioCloneVideoPlan service=new StudioCloneVideoPlan(videos,workflow,depth,projects,om);
    final ObjectNode doc=om.createObjectNode();
    @BeforeEach void setup() throws Exception {
        var model=om.readTree("""
            {"endpointId":"selected-channel","isDefault":true,"selectableById":true,"supportsPromptOptimization":true,
             "contract":{"minSeconds":5,"maxSeconds":15,"modes":[{"mode":"reference","needsFirstFrame":false,"needsLastFrame":false,
              "references":{"video":{"maxCount":1,"minDurationSec":2,"maxDurationSec":15}}}]}}
            """);
        when(videos.models()).thenReturn(List.of(om.treeToValue(model,VideoStudioModel.class)));
        var nodes=doc.putArray("nodes");
        nodes.addObject().put("id","source").put("type","video").putObject("metadata").put("storageKey","original.mp4");
        nodes.addObject().put("id","product").put("type","image").putObject("metadata").put("storageKey","new-product.jpg");
        when(projects.readDoc(any())).thenReturn(doc);
        when(projects.requireOwnedAssetKey(eq("u"),anyString())).thenAnswer(i->i.getArgument(1));
        when(depth.source("u","original.mp4")).thenReturn(new StudioDepthVideoService.Source("original.mp4",12,720,1280));
        when(workflow.quote(eq("u"),any())).thenReturn(480L);
    }
    SegmentedVideoRequest config() {
        var body=om.createObjectNode().put("model","selected-channel").put("text","将人物手里的商品换成图1")
                .put("duration",12).put("ratio","9:16").put("tier","720p").put("optimize",false);
        body.putArray("materials").addObject().put("nodeId","product").put("slot","image");
        return om.convertValue(body,SegmentedVideoRequest.class);
    }
    ObjectNode plan(){var p=om.createObjectNode();p.putArray("steps");return p;}
    @Test void depthRecipeFeedsOnlyTheDerivedDepthVideoAndNewImagesToGeneration() {
        var p=plan();assertEquals(List.of("source","product"),service.build("u","p","depth","source",config(),p));
        assertEquals("video-control",p.path("steps").path(0).path("operation").asText());
        var video=p.path("steps").path(1);
        assertEquals("深度复刻成片",video.path("title").asText(),"the collected asset title must not fall back to the internal depth instruction");
        assertEquals("depth",video.path("dependsOn").path(0).asText());
        var refs=video.path("settings").path("referenceBindings");
        assertEquals("depth",refs.path(0).path("stepId").asText());assertFalse(refs.path(0).has("nodeId"));
        assertEquals("reference-video",refs.path(0).path("role").asText());
        assertEquals("product",refs.path(1).path("nodeId").asText());
        verify(depth).requireConfigured();verify(workflow,never()).submit(anyString(),anyString(),any());
    }
    @Test void replacementRecipeReferencesTheWholeOriginalAndHasNoDepthStep() {
        var p=plan();service.build("u","p","replacement","source",config(),p);
        assertEquals(1,p.path("steps").size());assertEquals("source",p.path("steps").path(0).path("settings").path("referenceBindings").path(0).path("nodeId").asText());
        verify(depth,never()).requireConfigured();
    }
    @Test void aChannelWithOnlyFirstFrameSupportCannotPretendToCloneVideo() {
        var first=new VideoStudioModeSpec("i2v",true,false,null,null);
        var contract=new VideoStudioContract(List.of(first),List.of(),5,15,7000,100);
        when(videos.models()).thenReturn(List.of(new VideoStudioModel("selected-channel","首帧",true,true,false,contract,null,List.of(1))));
        assertEquals("STUDIO_CLONE_REFERENCE_UNSUPPORTED",assertThrows(BusinessException.class,()->service.build("u","p","replacement","source",config(),plan())).getCode());
        verify(depth,never()).source(anyString(),anyString());
    }
    @Test void longSourcesAreRefusedInsteadOfTruncatingOrCharging() {
        when(depth.source("u","original.mp4")).thenReturn(new StudioDepthVideoService.Source("original.mp4",30,720,1280));
        assertThrows(BusinessException.class,()->service.build("u","p","depth","source",config(),plan()));
        verify(workflow,never()).submit(anyString(),anyString(),any());
    }
    @Test void imagesMustBelongToTheCallerBeforeAnyRecipeIsAccepted() {
        when(projects.requireOwnedAssetKey("u","new-product.jpg")).thenThrow(BusinessException.badRequest("IP_ASSET_NOT_OWNED","素材不属于本人"));
        assertEquals("IP_ASSET_NOT_OWNED",assertThrows(BusinessException.class,()->service.build("u","p","depth","source",config(),plan())).getCode());
    }
    @Test void quoteCountsTheVideoReferenceAndConfirmedRetryAllowance() {
        var quote=service.price("u","replacement","selected-channel","720p",12,"9:16",1,false,false,false);
        assertEquals(480,quote.estimated());assertEquals(1440,quote.cap());
        verify(workflow).quote(eq("u"),argThat(r->r.video().references().size()==2&&"video".equals(r.video().references().get(0).mediaType())));
    }
    @Test void missingSourceAndUnboundedCountsAreRejectedBeforeModelOrMediaWork() {
        assertThrows(BusinessException.class,()->service.build("u","p","depth",null,config(),plan()));
        assertThrows(BusinessException.class,()->service.price("u","depth","selected-channel","720p",12,"9:16",Integer.MAX_VALUE,false,false,false));
        verifyNoInteractions(depth,workflow);
    }
    @Test void replacementImagesAreOptionalWhenTheUserDescribesTheNewAppearance() {
        var body=(ObjectNode)om.valueToTree(config());body.putArray("materials");body.put("text","替换成穿蓝色衣服的小狐狸");
        for(String kind:List.of("depth","replacement")) {
            var p=plan();assertEquals(List.of("source"),service.build("u","p",kind,"source",om.convertValue(body,SegmentedVideoRequest.class),p));
            var step=p.path("steps").path(p.path("steps").size()-1);
            assertEquals(1,step.path("settings").path("referenceBindings").size());
            assertTrue(step.path("prompt").asText().contains("小狐狸"));
        }
    }
    @Test void depthSourceLengthFollowsTheActualChannelInsteadOfAHardcoded15Seconds() throws Exception {
        var model=om.valueToTree(videos.models().get(0));
        ((ObjectNode)model.path("contract").path("modes").path(0).path("references").path("video")).put("maxDurationSec",60);
        when(videos.models()).thenReturn(List.of(om.treeToValue(model,VideoStudioModel.class)));
        when(depth.source("u","original.mp4")).thenReturn(new StudioDepthVideoService.Source("original.mp4",30,720,1280));
        assertDoesNotThrow(()->service.build("u","p","depth","source",config(),plan()));
        when(depth.source("u","original.mp4")).thenReturn(new StudioDepthVideoService.Source("original.mp4",61,720,1280));
        assertThrows(BusinessException.class,()->service.build("u","p","depth","source",config(),plan()));
    }
}
