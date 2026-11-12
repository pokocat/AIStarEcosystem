package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** 爆款复刻三种方式的公共部分：模型能不能带参考视频、每段原片多长、报价和推荐（StudioCloneVideoPlan）。 */
class StudioCloneVideoPlanTest {
    final ObjectMapper om=new ObjectMapper();
    final StudioVideoService videos=mock(StudioVideoService.class);
    final StudioDepthVideoService depth=mock(StudioDepthVideoService.class);
    final StudioPlanQuoter quoter=mock(StudioPlanQuoter.class);
    final StudioCloneVideoPlan service=new StudioCloneVideoPlan(videos,depth,quoter,mock(FileStorageService.class),om);
    final AtomicReference<ObjectNode> quoted=new AtomicReference<>();

    VideoStudioModel model(int contractMax,Integer referenceMin,Integer referenceMax) throws Exception {
        var model=om.readTree("""
            {"endpointId":"selected-channel","name":"H3","isDefault":true,"selectableById":true,"supportsPromptOptimization":true,
             "contract":{"minSeconds":4,"maxSeconds":%d,"modes":[{"mode":"reference","needsFirstFrame":false,"needsLastFrame":false,
              "references":{"image":{"maxCount":9},"audio":{"maxCount":1},"maxImagesWithVideo":4,"maxTotal":12,
               "video":{"maxCount":1%s%s}}}]}}
            """.formatted(contractMax,referenceMin==null?"":",\"minDurationSec\":"+referenceMin,referenceMax==null?"":",\"maxDurationSec\":"+referenceMax));
        return om.treeToValue(model,VideoStudioModel.class);
    }
    @BeforeEach void setup() throws Exception {
        when(videos.models()).thenReturn(List.of(model(15,2,10)));
        doAnswer(i->{ObjectNode plan=i.getArgument(1);quoted.set(plan.deepCopy());plan.putObject("budget").put("estimated",100L*plan.path("steps").size());return null;})
                .when(quoter).quote(eq("u"),any());
    }

    @Test void eachSegmentIsCappedByTheReferenceVideoLimitNotOnlyTheModel() {
        var clip=StudioCloneVideoPlan.clip(videos.models().get(0));
        assertEquals(4,clip.minSec());assertEquals(10,clip.maxSec(),"参考视频最长 10 秒，即使模型单段能出 15 秒");
    }
    /** 全能参考配了「编辑原视频」的模型（Seedance 2.5）：普通参考视频 2–15 秒，编辑时原视频 4–30 秒。 */
    VideoStudioModel editingModel() throws Exception {
        var model=(ObjectNode)om.valueToTree(model(30,2,15));
        ((ObjectNode)model.path("contract").path("modes").get(0)).putObject("edit").put("minSourceSec",4).put("maxSourceSec",30).put("followSource",true)
                .putObject("requestFields").put("omni_reference_task_type","edit");
        ArrayNode tiers=((ObjectNode)model.path("contract")).putArray("tiers");
        var canvases=tiers.addObject().put("tier","720p").putArray("canvases");
        canvases.addObject().put("aspectRatio","9:16").put("width",720).put("height",1280);
        canvases.addObject().put("aspectRatio","16:9").put("width",1280).put("height",720);
        return om.treeToValue(model,VideoStudioModel.class);
    }
    @Test void replacementOnAModelThatEditsCutsByTheEditLimitAndMarksEveryVideoAsAnEdit() throws Exception {
        when(videos.models()).thenReturn(List.of(editingModel()));
        var selected=videos.models().get(0);
        assertEquals(15,StudioCloneVideoPlan.clip(selected,"depth").maxSec(),"深度复刻照普通参考视频的上限");
        assertEquals(30,StudioCloneVideoPlan.clip(selected,"replacement").maxSec(),"元素替换按编辑的上限");
        assertEquals(4,StudioCloneVideoPlan.clip(selected,"replacement").minSec());
        var quote=service.price("u","replacement","selected-channel","720p",45,"9:16",1,false,false,false);
        assertEquals(2,quote.segments().size());
        assertTrue(quoted.get().path("steps").path(0).path("settings").path("video").path("edit").asBoolean());
        service.price("u","depth","selected-channel","720p",45,"9:16",1,false,false,false);
        assertFalse(quoted.get().path("steps").toString().contains("\"edit\""),"深度复刻不编辑原视频");
        assertFalse(StudioCloneVideoPlan.edits("replacement",model(15,2,10)),"没配编辑的模型照常用全能参考");
    }
    @Test void anEditThatFollowsTheSourceUsesTheSourceShape() throws Exception {
        var selected=editingModel();
        assertEquals("16:9",StudioCloneVideoPlan.closestRatio(selected,"720p",1920,1080,"9:16"));
        assertEquals("9:16",StudioCloneVideoPlan.closestRatio(selected,"720p",720,1280,"16:9"));
        assertEquals("9:16",StudioCloneVideoPlan.closestRatio(selected,"720p",0,0,"9:16"),"读不到尺寸就用页面选的");
    }
    @Test void aChannelWithoutVideoReferenceCannotCloneFromFootage() {
        var first=new VideoStudioModeSpec("i2v",true,false,null,null);
        var contract=new VideoStudioContract(List.of(first),List.of(),5,15,7000,100);
        var model=new VideoStudioModel("selected-channel","首帧",true,true,false,contract,null,List.of(1));
        assertEquals("STUDIO_CLONE_REFERENCE_UNSUPPORTED",assertThrows(BusinessException.class,()->StudioCloneVideoPlan.clip(model)).getCode());
        when(videos.models()).thenReturn(List.of(model));
        assertEquals("STUDIO_CLONE_REFERENCE_UNSUPPORTED",assertThrows(BusinessException.class,()->service.require("replacement","selected-channel")).getCode());
    }
    @Test void onlyDepthNeedsTheMotionExtractionRuntime() {
        service.require("replacement","selected-channel");verify(depth,never()).requireConfigured();
        service.require("depth","selected-channel");verify(depth).requireConfigured();
        doThrow(new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_DEPTH_NOT_CONFIGURED","x")).when(depth).requireConfigured();
        assertEquals("STUDIO_DEPTH_NOT_CONFIGURED",assertThrows(BusinessException.class,()->service.price("u","depth","selected-channel","720p",12,"9:16",0,false,false,false)).getCode());
        verifyNoInteractions(quoter);
    }
    @Test void priceSplitsByTheClipLimitAndQuotesAVideoWithTheFootagePlusACheckPerSegment() {
        var quote=service.price("u","replacement","selected-channel","720p",25,"9:16",2,true,true,false);
        assertEquals(List.of(10,10,5),quote.segments());
        assertEquals(600,quote.estimated());assertEquals(1800,quote.cap());
        var steps=quoted.get().path("steps");
        assertEquals(6,steps.size());
        var video=steps.path(0).path("settings");
        assertEquals("reference-video",video.path("referenceBindings").path(0).path("role").asText(),"视频1 是原片片段");
        assertEquals(5,video.path("referenceBindings").size(),"视频 + 2 张图 + 人物 + 声音");
        assertFalse(video.path("video").path("optimize").asBoolean());
        assertEquals("check",steps.path(1).path("operation").asText());assertEquals("v1",steps.path(1).path("settings").path("targetStepId").asText());
    }
    @Test void picturesBeyondTheLimitWithAVideoAreNotQuoted() {
        service.price("u","replacement","selected-channel","720p",8,"9:16",17,true,false,false);
        long images=0;for(JsonNode b:quoted.get().path("steps").path(0).path("settings").path("referenceBindings"))if("reference-image".equals(b.path("role").asText()))images++;
        assertEquals(4,images,"带参考视频时图片最多 4 张");
        assertThrows(BusinessException.class,()->service.price("u","replacement","selected-channel","720p",8,"9:16",18,true,false,false));
    }
    @Test void depthAlwaysQuotesThePromptRewrite() {
        service.price("u","depth","selected-channel","720p",8,"9:16",0,false,false,false);
        JsonNode video=null;for(JsonNode st:quoted.get().path("steps"))if("v1".equals(st.path("id").asText()))video=st;
        assertTrue(video.path("settings").path("video").path("optimize").asBoolean());
    }
    /** 深度复刻多一张场景图（加一次检查），每段视频都带上它。 */
    @Test void depthQuotesTheSceneImageAndEverySegmentCarriesIt() {
        service.price("u","depth","selected-channel","720p",8,"9:16",0,false,false,false);
        var steps=quoted.get().path("steps");
        assertEquals("image",steps.path(0).path("operation").asText());assertEquals("k1",steps.path(0).path("id").asText());
        assertEquals("check",steps.path(1).path("operation").asText());assertEquals("k1",steps.path(1).path("settings").path("targetStepId").asText());
        long images=0;for(JsonNode b:steps.path(2).path("settings").path("referenceBindings"))if("reference-image".equals(b.path("role").asText()))images++;
        assertEquals(1,images,"没传素材时，视频也带着场景图");
    }
    @Test void unboundedImageCountsAreRejectedBeforeAnyQuote() {
        assertThrows(BusinessException.class,()->service.price("u","depth","selected-channel","720p",12,"9:16",Integer.MAX_VALUE,false,false,false));
        verifyNoInteractions(quoter);
    }
    @Test void adviceFollowsShotCountAndLength() {
        assertEquals("depth",StudioCloneVideoPlan.advice(30,1).recommended(),"一镜到底");
        assertEquals("depth",StudioCloneVideoPlan.advice(30,2).recommended());
        assertEquals("depth",StudioCloneVideoPlan.advice(40,5).recommended(),"平均 8 秒一个镜头");
        assertEquals("recreation",StudioCloneVideoPlan.advice(15,6).recommended(),"平均 2.5 秒，换镜频繁");
        var a=StudioCloneVideoPlan.advice(15,6);
        assertEquals(6,a.shots());assertEquals(2.5,a.averageShotSec());assertFalse(a.reason().isBlank());
    }
    @Test void adviceReadsOnlyTheCallersOwnVideo() {
        when(depth.source("u","not-mine.mp4")).thenThrow(BusinessException.badRequest("IP_ASSET_NOT_OWNED","x"));
        assertEquals("IP_ASSET_NOT_OWNED",assertThrows(BusinessException.class,()->service.advise("u","not-mine.mp4")).getCode());
    }
}
