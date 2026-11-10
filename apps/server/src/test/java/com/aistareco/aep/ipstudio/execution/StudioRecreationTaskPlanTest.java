package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints;
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
import java.util.stream.StreamSupport;
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
        assertEquals(5,validated.path("steps").size(),"每段一个视频加一个检查，最后合成");
        var v1=validated.path("steps").get(0).path("settings");
        assertEquals("ai-h3",v1.path("model").asText());
        assertEquals("768p",v1.path("video").path("resolutionTier").asText());
        assertEquals("check",validated.path("steps").get(1).path("operation").asText());
        assertEquals("v1",validated.path("steps").get(1).path("settings").path("targetStepId").asText());
        var final_=validated.path("steps").get(4);
        assertEquals(List.of("v1","c1","v2","c2"),StreamSupport.stream(final_.path("dependsOn").spliterator(),false).map(JsonNode::asText).toList(),"合成等每段的视频和检查都结束");
        var assemble=final_.path("settings");
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
        var captions=finalStep(StudioRecreationTaskPlan.build(task,answer)).path("settings").path("captions");
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

    /**
     * 2026-11-10 美食那条：「手指捏住远处很小的人、再一下冲到眼前」靠文字写不出来。每个镜头的开场截图先改成用户的人和物，
     * 视频模型从这张图开始拍；开场画面排在参考图最前面，素材接在后面，账号片尾不做。
     */
    @Test
    void eachShotGetsARebuiltOpeningFrameBeforeTheVideo() throws Exception {
        ObjectNode film=(ObjectNode)film();
        var shots=(com.fasterxml.jackson.databind.node.ArrayNode)film.path("breakdown").path("shots");
        ((ObjectNode)shots.get(0)).putObject("detail").put("layout","女生在远处，只有手指大小").put("trick","手指捏住远处的女生").put("frameAt",.2);
        ((ObjectNode)shots.get(2)).put("visual","抖音号 78699247005 的账号页");
        var frames=film.putArray("frames");
        for(int n=1;n<=3;n++)frames.addObject().put("shot",n).put("at",n).put("storageKey","ipstudio_gen/u/frame-"+n+".jpg");
        var task=StudioRecreationTaskPlan.prepare(film,materials(),"ai-h3",h3(),"768p","9:16",null,"PEX-a-study-f",20,"人物换成小美，杯子换成保温杯");
        var first=task.path("units").get(0);
        assertEquals(2,first.path("keyframes").size(),"第 1、2 镜做开场画面");
        assertEquals("k1",first.path("refs").get(0).path("stepId").asText());
        assertEquals("图1",first.path("refs").get(0).path("label").asText(),"开场画面排在最前面");
        assertEquals("girl",first.path("refs").get(2).path("nodeId").asText(),"素材接在开场画面后面");
        assertEquals("图3",first.path("refs").get(2).path("label").asText());
        assertEquals(0,task.path("units").get(1).path("keyframes").size(),"原作者的账号页不做开场画面");

        JsonNode answer=om.readTree("""
            {"units":[{"no":1,"prompt":"第1镜：从图1开始拍","keyframes":[{"shot":1,"materials":["「小美」","不存在的素材"],"instruction":"只换人，保持很小"}]},
                      {"no":2,"prompt":"第1镜：收尾画面"}]}""");
        List<Map<String,Object>> asked=new ArrayList<>();
        var plan=StudioRecreationTaskPlan.build(task,answer,(stage,vars)->{
            if(!StudioPromptCallPoints.RECREATION_KEYFRAME.equals(stage))return StudioRecreationTaskPlan.LIBRARY.render(stage,vars);
            asked.add(vars);return "开场画面："+vars.get("instruction");});
        List<String> ids=new ArrayList<>();plan.path("steps").forEach(st->ids.add(st.path("id").asText()));
        assertEquals(List.of("k1","k2","v1","c1","v2","c2","final"),ids);
        var k1=plan.path("steps").get(0);
        assertEquals("image",k1.path("operation").asText());
        assertEquals("PEX-a-study-f1",k1.path("settings").path("referenceBindings").get(0).path("nodeId").asText(),"以原片截图为构图基准");
        assertEquals("girl",k1.path("settings").path("referenceBindings").get(1).path("nodeId").asText(),"按名称找到了素材，不存在的不算");
        assertEquals(2,k1.path("settings").path("referenceBindings").size());
        assertEquals("女生在远处，只有手指大小",asked.get(0).get("layout"));
        assertEquals("开场画面：只换人，保持很小",k1.path("prompt").asText());
        assertEquals(1,plan.path("steps").get(1).path("settings").path("referenceBindings").size(),"没写要求的镜头只带原片截图");
        assertEquals("开场画面：人物换成小美，杯子换成保温杯",plan.path("steps").get(1).path("prompt").asText(),"没写要求时用用户的原话");
        var v1=plan.path("steps").get(2);
        assertEquals(List.of("k1","k2"),StreamSupport.stream(v1.path("dependsOn").spliterator(),false).map(JsonNode::asText).toList());
        assertEquals("k1",v1.path("settings").path("referenceBindings").get(0).path("stepId").asText());
        assertEquals("keyframe-rebuild",v1.path("strategy").path("method").asText());

        Set<String> allowed=new HashSet<>(List.of("cup","girl","PEX-a-study-f1","PEX-a-study-f2"));
        var validated=StudioPlanValidator.validateSkillPlan(plan,rules(),"production",allowed);
        assertEquals(7,validated.path("steps").size(),"出图、视频、检查、合成都在复刻方法允许的范围里");
        // 成片的检查按镜头抽帧、带上这段的参考图，要点是逐镜的是非题
        var c1=validated.path("steps").get(3);
        assertEquals("shots",c1.path("settings").path("sampling").asText());
        assertTrue(c1.path("settings").path("compareReferences").asBoolean());
        assertTrue(plan.path("steps").get(3).path("prompt").asText().contains("第 1 镜"),"每张开场画面一条是非题");

        // 记了步数上限：开场画面出完先检查，视频等检查结束；步数不够时有视觉把戏的镜头优先
        task.put("maxSteps",8);
        var checked=StudioRecreationTaskPlan.build(task,answer,(stage,vars)->StudioPromptCallPoints.RECREATION_KEYFRAME.equals(stage)?"开场画面":StudioRecreationTaskPlan.LIBRARY.render(stage,vars));
        List<String> withChecks=new ArrayList<>();checked.path("steps").forEach(st->withChecks.add(st.path("id").asText()));
        assertEquals(List.of("k1","ck1","k2","v1","c1","v2","c2","final"),withChecks,"只剩一步，给有视觉把戏的第 1 镜");
        var ck1=checked.path("steps").get(1);
        assertEquals("k1",ck1.path("settings").path("targetStepId").asText());
        assertTrue(ck1.path("settings").path("compareReferences").asBoolean());
        assertFalse(ck1.path("settings").has("sampling"),"图片不用抽帧");
        assertEquals(List.of("k1","ck1","k2"),StreamSupport.stream(checked.path("steps").get(3).path("dependsOn").spliterator(),false).map(JsonNode::asText).toList(),"视频等开场画面的检查");
        var validatedChecks=StudioPlanValidator.validateSkillPlan(checked,rules(),"production",allowed);
        assertEquals(8,validatedChecks.path("steps").size(),"图片步骤也能检查");
        assertTrue(validatedChecks.path("steps").get(1).path("settings").path("compareReferences").asBoolean());
        assertEquals(1,validatedChecks.path("steps").get(1).path("settings").path("optionalRank").asInt(),"开场画面的检查可省，名次随方案保留");
        assertFalse(validatedChecks.path("steps").get(4).path("settings").has("optionalRank"),"每段成片的检查不可省");

        // 两步都够：有视觉把戏的第 1 镜名次 1（最后省），第 2 镜名次 2（先省）
        task.put("maxSteps",9);
        var both=StudioRecreationTaskPlan.build(task,answer,(stage,vars)->StudioPromptCallPoints.RECREATION_KEYFRAME.equals(stage)?"开场画面":StudioRecreationTaskPlan.LIBRARY.render(stage,vars));
        assertEquals("ck2",StudioRecreationTaskPlan.dropOptionalCheck(both));
        assertEquals("ck1",StudioRecreationTaskPlan.dropOptionalCheck(both));
        assertNull(StudioRecreationTaskPlan.dropOptionalCheck(both),"每段成片的检查不省");
        for(JsonNode st:both.path("steps"))assertFalse(st.path("dependsOn").toString().contains("ck"),"没人再等省掉的检查");
    }

    /**
     * 检查要点和重出说明从代码挪进提示词库（2026-11-10 审查）。和挪之前代码里写的逐字一致。
     */
    @Test void checkTextsComeFromThePromptLibraryUnchanged() {
        assertEquals("要检查的是一张改好的镜头开场画面。图1 是原片这一镜的截图，其余的图是用户的素材。逐项看："
                +"要换的人和物有没有换成素材里的样子，脸、发型、衣服照素材（subject-replaced）；"
                +"有没有留着原片人物的帽子、衣服、配饰，画面上有没有水印、账号和文字（old-subject-residue）；"
                +"人和物的位置、离镜头的远近、在画面里的大小是不是和图1 一致，远处的人没有被画大、拉近，前景的手和手势还在（scene-and-action）。"
                +"目标说明里写了保持原样的人和物不算残留。不对的地方在 suggestion 里写清这张图要怎么改。",
                StudioRecreationTaskPlan.LIBRARY.render(StudioPromptCallPoints.RECREATION_KEYFRAME_CHECK,Map.of()).strip());
        String rest="- 每个镜头里要换的人和商品，是不是提示词这一镜点名的那张图里的样子；镜头推近或切近后手里拿的、桌上摆的，是不是这一镜点名的那一件，不能是别的镜头的那一件（subject-replaced）。\n"
                +"- 同一个人在各个镜头里是不是同一张脸、同一个发型、同一身衣服，有没有留着原片人物的帽子、衣服和配饰，画面里有没有水印和多余的文字（character-consistency、old-subject-residue）。\n"
                +"- 提示词每一镜写的动作、镜头运动和结束画面有没有做出来，镜头的先后顺序对不对（scene-and-action）。\n"
                +"哪一镜不对，suggestion 里一行写一镜，直接写这一镜应该是什么画面，格式「第N镜：……」（例如「第3镜：推近后女生手里端的是图3 的炒饭」），不写「建议」「请修改」「重新生成」这类话。";
        var unit=om.createObjectNode();unit.putArray("refs").addObject().put("label","图1");
        unit.putArray("keyframes").addObject().put("shot",2).put("atSec",1.8).put("label","图1");
        assertEquals("对照上面的提示词，逐个镜头检查成片，人和物对照参考图：\n- 第 2 镜（约 1.8 秒起）：开头的画面是不是和图1一致（人和物的位置、远近、大小，前景的手）。\n"+rest,
                StudioRecreationTaskPlan.videoCheck(StudioRecreationTaskPlan.LIBRARY,unit,true));
        assertEquals("对照上面的提示词，逐个镜头检查成片：\n"+rest,StudioRecreationTaskPlan.videoCheck(StudioRecreationTaskPlan.LIBRARY,om.createObjectNode(),false));
        assertEquals("上一版没有做到的，这一版改掉：人物还戴着原片的贝雷帽",
                StudioRecreationTaskPlan.LIBRARY.render(StudioPromptCallPoints.RECREATION_REDO_NOTE,Map.of("fix","人物还戴着原片的贝雷帽")).strip());
    }

    static com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules rules() throws Exception {
        try(var in=StudioRecreationTaskPlanTest.class.getResourceAsStream("/studio/skills/reference-video-recreation.md")) {
            return StudioSkillRules.rules(StudioSkillCatalog.parse(new String(in.readAllBytes(),StandardCharsets.UTF_8)));
        }
    }

    private static JsonNode finalStep(JsonNode plan) {
        for(JsonNode step:plan.path("steps"))if("final".equals(step.path("id").asText()))return step;
        throw new AssertionError("no final step: "+plan);
    }
}
