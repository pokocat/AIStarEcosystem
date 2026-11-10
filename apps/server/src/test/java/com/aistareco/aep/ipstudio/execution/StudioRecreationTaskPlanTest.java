package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
import com.aistareco.aep.ipstudio.service.StudioVideoBreakdown;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 视频页爆款复刻的制作方案由代码拼（线上 11-07 至 11-09 的失败：清晰度写成别的模型的、一步塞多段原片、方案读不出来）。
 * 拼出来的方案必须原样通过模型方案用的同一个校验。
 */
class StudioRecreationTaskPlanTest {
    final ObjectMapper om=new ObjectMapper();

    static VideoStudioContract h3() {
        var image=new VideoStudioMediaLimit("image",9,30_000_000,List.of("jpg","png"),null,null);
        var video=new VideoStudioMediaLimit("video",1,50_000_000,List.of("mp4"),2,15);
        var audio=new VideoStudioMediaLimit("audio",1,15_000_000,List.of("mp3"),2,15);
        var refs=new VideoStudioReferenceRules(image,video,audio,4,9,1,15);
        var modes=List.of(new VideoStudioModeSpec("text_to_video",false,false,null,null),
                new VideoStudioModeSpec("first_frame",true,false,image,null),
                new VideoStudioModeSpec("universal_reference_video",false,false,null,refs));
        var tiers=List.of(new VideoStudioTier("768p",List.of(new VideoStudioCanvas("9:16",432,768))),new VideoStudioTier("544p",List.of(new VideoStudioCanvas("9:16",306,544))));
        return new VideoStudioContract(modes,tiers,4,15,2000,4294967295L);
    }

    JsonNode film() throws Exception {
        var b=StudioVideoBreakdown.normalize(om.readTree("""
            {"summary":"门店爆满","type":"探店","people":[{"id":"P1","who":"女老板","role":"主角","speaks":true}],
             "shots":[{"start":0,"end":6,"visual":"排队","caption":"开店18年"},{"start":6,"end":12,"visual":"满床"},{"start":12,"end":19.5,"visual":"老板说话","dialogue":[{"who":"P1","text":"我们不推销"}]}]}"""),19.5,List.of(6.0,12.0));
        var units=StudioVideoBreakdown.units(b,15,4,8);
        ObjectNode film=om.createObjectNode();film.set("breakdown",b);
        var segments=film.putArray("segments");
        for(var u:units)segments.addObject().put("no",u.no()).put("title",u.title()).put("startSec",u.startSec()).put("endSec",u.endSec())
                .put("firstShot",u.firstShot()).put("lastShot",u.lastShot()).put("storageKey","ipstudio_gen/u/clip-"+u.no()+".mp4").put("durationSec",u.length());
        return film;
    }

    List<StudioRecreationTaskPlan.Material> materials() {
        return List.of(new StudioRecreationTaskPlan.Material("cup","保温杯","image"),new StudioRecreationTaskPlan.Material("girl","小美","character"));
    }

    @Test
    void factsComeFromThePageAndTheContractNotFromTheModel() throws Exception {
        var task=StudioRecreationTaskPlan.prepare(film(),materials(),"ai-h3",h3(),"1080p","9:16",null);
        assertEquals("universal_reference_video",task.path("mode").asText(),"有参考的模式优先");
        assertEquals("768p",task.path("tier").asText(),"页面带来的清晰度这个模型没有，就用合同里的第一档");
        assertEquals(2,task.path("units").size());
        var first=task.path("units").get(0);
        assertEquals("girl",first.path("refs").get(0).path("nodeId").asText(),"人物排在商品前面");
        assertEquals("图1",first.path("refs").get(0).path("label").asText());
        assertEquals("cup",first.path("refs").get(1).path("nodeId").asText());
        for(JsonNode r:first.path("refs"))assertNotEquals("reference-video",r.path("role").asText(),"原片片段不交给视频模型");
        assertEquals(12,first.path("seconds").asInt());
        assertEquals(12.0,task.path("units").get(1).path("offsetSec").asDouble());
    }

    @Test
    void theBuiltPlanPassesTheSameValidatorAsAModelPlan() throws Exception {
        var task=StudioRecreationTaskPlan.prepare(film(),materials(),"ai-h3",h3(),"768p","9:16",null);
        JsonNode answer=om.readTree("""
            {"summary":"换成小美和保温杯","keep":["开场排队"],"change":["原来是女老板 → 换成小美"],
             "units":[{"no":1,"title":"门店爆满","prompt":"第1镜（0–6 秒）：图1 的女生……","captions":[{"start":0,"end":3,"text":"开店18年"}]},
                      {"no":2,"title":"不推销","prompt":"第1镜（0–7 秒）：图1 的女生说：「我们不推销」","captions":[{"start":1,"end":2,"text":"不推销"}]}]}""");
        var plan=StudioRecreationTaskPlan.build(task,answer);
        Set<String> allowed=new HashSet<>(List.of("clip-1","clip-2","cup","girl"));
        var validated=StudioPlanValidator.validateSkillPlan(plan,rules(),"production",allowed);
        assertEquals(3,validated.path("steps").size());
        var v1=validated.path("steps").get(0).path("settings");
        assertEquals("ai-h3",v1.path("model").asText());
        assertEquals("768p",v1.path("video").path("resolutionTier").asText());
        var assemble=validated.path("steps").get(2).path("settings");
        assertEquals(2,assemble.path("clipOrder").size());
        assertEquals(12+1.0,assemble.path("captions").get(1).path("start").asDouble(),"第二段的字幕按成片时间顺延");
    }

    /** 2026-11-09 真跑：原作者的抖音号被写进字幕；原片一条字幕挂满全片时被拆成几条一样的。 */
    @Test
    void theOriginalCreatorsAccountNeverReachesTheCaptionsAndRepeatsAreJoined() throws Exception {
        var task=StudioRecreationTaskPlan.prepare(film(),materials(),"ai-h3",h3(),"768p","9:16",null);
        JsonNode answer=om.readTree("""
            {"units":[{"no":1,"prompt":"第1镜","captions":[{"start":0,"end":12,"text":"我刷到的带货直播"}]},
                      {"no":2,"prompt":"第1镜","captions":[{"start":0,"end":4,"text":"我刷到的带货直播"},
                        {"start":4,"end":7,"text":"抖音号:78699247005\\n抖音搜索 小尼的奇妙日记"},{"start":5,"end":7,"text":"来抖音 发现更多创作者"}]}]}""");
        var captions=StudioRecreationTaskPlan.build(task,answer).path("steps").get(2).path("settings").path("captions");
        assertEquals(1,captions.size(),captions.toString());
        assertEquals("我刷到的带货直播",captions.get(0).path("text").asText());
        assertEquals(0.0,captions.get(0).path("start").asDouble());
        assertEquals(16.0,captions.get(0).path("end").asDouble());
    }

    @Test
    void aMissingUnitPromptFailsInsteadOfBeingFilledIn() throws Exception {
        var task=StudioRecreationTaskPlan.prepare(film(),materials(),"ai-h3",h3(),"768p","9:16",null);
        var e=assertThrows(BusinessException.class,()->StudioRecreationTaskPlan.build(task,om.readTree("{\"units\":[{\"no\":1,\"prompt\":\"x\"}]}")));
        assertEquals("AI_BAD_OUTPUT",e.getCode());
    }

    @Test
    void aFirstFrameOnlyModelCannotRemake() {
        var only=new VideoStudioContract(List.of(new VideoStudioModeSpec("first_frame",true,false,null,null)),h3().tiers(),4,15,2000,1);
        var e=assertThrows(BusinessException.class,()->StudioRecreationTaskPlan.prepare(film(),materials(),"m",only,"768p","9:16",null));
        assertEquals("STUDIO_VIDEO_MODE_UNAVAILABLE",e.getCode());
    }

    /** 2026-11-09 真实出片：H3 带上原片片段就照抄原商品和水印。没有替换素材时也不拿原片顶，按文字出片。 */
    @Test
    void withoutMaterialsTheTextModeIsUsedAndNoOriginalClipIsSent() throws Exception {
        var task=StudioRecreationTaskPlan.prepare(film(),List.of(),"ai-h3",h3(),"768p","9:16",null);
        assertEquals("text_to_video",task.path("mode").asText());
        for(JsonNode u:task.path("units"))assertEquals(0,u.path("refs").size());
    }

    static com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules rules() throws Exception {
        try(var in=StudioRecreationTaskPlanTest.class.getResourceAsStream("/studio/skills/reference-video-recreation.md")) {
            return StudioSkillRules.rules(StudioSkillCatalog.parse(new String(in.readAllBytes(),StandardCharsets.UTF_8)));
        }
    }
}
