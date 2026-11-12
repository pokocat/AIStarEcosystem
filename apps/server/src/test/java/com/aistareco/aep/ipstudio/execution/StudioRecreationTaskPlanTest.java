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

    @Test
    void eighteenImagesRemainInScopeAndOneVoiceFitsWithinEachSegmentsLimit() throws Exception {
        var materials=new ArrayList<StudioRecreationTaskPlan.Material>();
        for(int i=1;i<=18;i++)materials.add(new StudioRecreationTaskPlan.Material("image-"+i,"商品图 "+i,"image"));
        materials.add(new StudioRecreationTaskPlan.Material("voice","参考声音","voice"));
        var task=StudioRecreationTaskPlan.prepare(film(),materials,"ai-h3",h3(),"768p","9:16",null);
        for(JsonNode unit:task.path("units")) {
            var refs=unit.path("refs");
            assertEquals(9,refs.size(),"当前模型总量上限包括音频");
            assertEquals("reference-audio",refs.get(8).path("role").asText());
        }
        var plan=StudioRecreationTaskPlan.build(task,om.readTree("""
            {"units":[{"no":1,"prompt":"第一段"},{"no":2,"prompt":"第二段"}]}"""));
        var allowed=materials.stream().map(StudioRecreationTaskPlan.Material::nodeId).toList();
        assertEquals(19,StudioPlanValidator.validateSkillPlan(plan,rules(),"production",allowed,
                StudioRecreationTaskPlan.MAX_MATERIALS).path("materialNodeIds").size());
        assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(plan,rules(),"production",allowed));
    }

    /** 2026-11-09 真跑：原作者的抖音号被写进字幕；原片一条字幕挂满全片时被拆成几条一样的。 */
    @Test
    void theOriginalCreatorsAccountNeverReachesTheCaptionsAndRepeatsAreJoined() throws Exception {
        var task=StudioRecreationTaskPlan.prepare(film(),materials(),"ai-h3",h3(),"768p","9:16",null);
        JsonNode answer=om.readTree("""
            {"units":[{"no":1,"prompt":"第1镜","captions":[{"start":0,"end":12,"text":"我刷到的带货直播"}]},
                      {"no":2,"prompt":"第1镜","captions":[{"start":0,"end":4,"text":"我刷到的带货直播"},
                        {"start":4,"end":7,"text":"抖音号:78699247005\\n抖音搜索 小尼的奇妙日记"},{"start":5,"end":7,"text":"来抖音 发现更多创作者"}]}]}""");
        var settings=finalStep(StudioRecreationTaskPlan.build(task,answer)).path("settings");
        // 2026-11-11 真跑：这句其实是原片顶部一直挂着的标题，当字幕放在底部盖住了台词字幕。挂满大半条片子的一句改放顶部
        assertFalse(settings.has("captions"),settings.toString());
        assertEquals("我刷到的带货直播",settings.path("title").asText());
    }

    /** 拉片认出原片的固定标题（screenTitle）：成片放顶部，模型照抄进字幕的同一句去掉，逐句的台词字幕照常。 */
    @Test
    void theOriginalsFixedTitleGoesOnTopAndLineCaptionsStay() throws Exception {
        ObjectNode film=(ObjectNode)film();
        ((ObjectNode)film.path("breakdown")).put("screenTitle","我刷到的带货直播");
        var task=StudioRecreationTaskPlan.prepare(film,materials(),"ai-h3",h3(),"768p","9:16",null);
        JsonNode answer=om.readTree("""
            {"units":[{"no":1,"prompt":"第1镜","captions":[{"start":0,"end":2,"text":"我刷到的带货直播"},{"start":2,"end":4,"text":"抹上去三二一来"}]},
                      {"no":2,"prompt":"第1镜","captions":[{"start":0,"end":2,"text":"吸收了"}]}]}""");
        var settings=finalStep(StudioRecreationTaskPlan.build(task,answer)).path("settings");
        assertEquals("我刷到的带货直播",settings.path("title").asText());
        assertEquals(2,settings.path("captions").size(),settings.toString());
        assertEquals("抹上去三二一来",settings.path("captions").get(0).path("text").asText());
        assertEquals("吸收了",settings.path("captions").get(1).path("text").asText());
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
     * 原片里重复用的画面（美食那条第 4～6 镜就是第 1、3、2 镜推到头时的近景）：那张开场画面在这段的参考图里，
     * 写提示词和检查时都告诉模型「第 1 镜推到这里就是图2」；指向别的段、没做开场画面的不提。
     */
    @Test
    void aShotThatPushesIntoAnotherShotsOpeningIsToldWhichImageItBecomes() throws Exception {
        ObjectNode film=(ObjectNode)film();
        var shots=(com.fasterxml.jackson.databind.node.ArrayNode)film.path("breakdown").path("shots");
        ((ObjectNode)shots.get(2)).put("visual","抖音号 78699247005 的账号页");
        var same=((ObjectNode)shots.get(0)).putArray("sameFrames");
        same.addObject().put("at",3.4).put("shot",2);
        same.addObject().put("at",4.0).put("shot",3);
        var frames=film.putArray("frames");
        for(int n=1;n<=3;n++)frames.addObject().put("shot",n).put("at",n).put("storageKey","ipstudio_gen/u/frame-"+n+".jpg");
        var task=StudioRecreationTaskPlan.prepare(film,materials(),"ai-h3",h3(),"768p","9:16",null,"PEX-a-study-f",20,"人物换成小美");
        var unit=task.path("units").get(0);
        assertEquals(1,unit.path("sameFrames").size(),"第 3 镜是账号页、在另一段，不提");
        assertEquals(1,unit.path("sameFrames").get(0).path("shot").asInt());
        assertEquals(2,unit.path("sameFrames").get(0).path("of").asInt());
        assertEquals("图2",unit.path("sameFrames").get(0).path("label").asText(),"第 2 镜的开场画面在这段排第二");
        assertEquals(3.4,unit.path("sameFrames").get(0).path("atSec").asDouble(),1e-9);
        String compile=StudioRecreationTaskPlan.LIBRARY.render(StudioPromptCallPoints.RECREATION_COMPILE,
                StudioRecreationTaskPlan.variables(task,film.path("breakdown"),"人物换成小美"));
        assertTrue(compile.contains("同一段画面：第1镜约 3.4 秒时的画面，就是第2镜的开场画面图2"),compile);
        assertTrue(StudioRecreationTaskPlan.videoCheck(StudioRecreationTaskPlan.LIBRARY,unit,true).contains("第 1 镜（约 3.4 秒）：推到的画面是不是和图2一致"));
        assertTrue(task.path("units").get(1).path("sameFrames").isEmpty());
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
     * 每段成片的检查要点和重出说明从代码挪进提示词库（2026-11-10 审查），和挪之前代码里写的逐字一致。
     */
    @Test void checkTextsComeFromThePromptLibraryUnchanged() {
        // 开场画面的检查要点 2026-11-10 真跑后改过（第 2 版：静止画面不判镜头运动、图1 里没有的不要求），不再和挪之前的一样
        String rest="- 每个镜头里要换的人和商品，是不是提示词这一镜点名的那张图里的样子；镜头推近或切近后手里拿的、桌上摆的，是不是这一镜点名的那一件，不能是别的镜头的那一件（subject-replaced）。\n"
                +"- 同一个人在各个镜头里是不是同一张脸、同一个发型、同一身衣服，有没有留着原片人物的帽子、衣服和配饰，画面里有没有水印和多余的文字（character-consistency、old-subject-residue）。\n"
                +"- 提示词每一镜写的动作、镜头运动和结束画面有没有做出来，镜头的先后顺序对不对（scene-and-action）。\n"
                +"哪一镜不对，suggestion 里一行写一镜，直接写这一镜应该是什么画面，格式「第N镜：……」（例如「第3镜：推近后女生手里端的是图3 的炒饭」），不写「建议」「请修改」「重新生成」这类话。";
        var unit=om.createObjectNode();var unitRefs=unit.putArray("refs");
        unitRefs.addObject().put("label","图1").put("stepId","k2").put("role","reference-image").put("what","第 2 镜改好的开场画面（这一镜从这张图开始拍）");
        unitRefs.addObject().put("label","图2").put("nodeId","m1").put("role","reference-image").put("what","替换素材 1（替换素材）");
        unitRefs.addObject().put("label","音频1").put("nodeId","v").put("role","reference-audio").put("what","声音（说话的声音）");
        unit.putArray("keyframes").addObject().put("shot",2).put("atSec",1.8).put("label","图1");
        // 2026-11-10 真跑后加了「参考图分别是」：只给编号时检查模型对不上「替换素材 1」是图几，把换对了的菜也判成没换
        String detailed=StudioRecreationTaskPlan.videoCheck(StudioRecreationTaskPlan.LIBRARY,unit,true);
        assertTrue(detailed.contains("- 图1：第 2 镜改好的开场画面（这一镜从这张图开始拍）\n- 图2：替换素材 1（替换素材）\n"),detailed);
        assertFalse(detailed.contains("音频1"),"声音不是图，不列");
        assertTrue(detailed.contains("- 第 2 镜（约 1.8 秒起）：开头的画面是不是和图1一致（人和物的位置、远近、大小，前景的手）。\n"+rest),detailed);
        assertEquals("对照上面的提示词，逐个镜头检查成片：\n"+rest,StudioRecreationTaskPlan.videoCheck(StudioRecreationTaskPlan.LIBRARY,om.createObjectNode(),false),"没有参考图时和挪之前一样");
        assertEquals("上一版没有做到的，这一版改掉：人物还戴着原片的贝雷帽",
                StudioRecreationTaskPlan.LIBRARY.render(StudioPromptCallPoints.RECREATION_REDO_NOTE,Map.of("fix","人物还戴着原片的贝雷帽")).strip());
    }

    // ── 三种复刻方式（StudioCloneVideoPlan）：深度复刻和元素替换每段把原片片段交给视频模型 ──────────────

    static final String FRAMES="PEX-a-a-study-f",SEGMENTS="PEX-a-a-study-s";
    JsonNode answer() throws Exception {
        return om.readTree("""
            {"summary":"换成小美和保温杯","keep":["原片动作"],"change":["女老板 → 小美"],
             "units":[{"no":1,"title":"门店爆满","prompt":"参考视频1的动作与运镜……第1镜（0–6 秒）：图1 的女生……","captions":[{"start":0,"end":3,"text":"开店18年"}],"keyframes":[]},
                      {"no":2,"title":"不推销","prompt":"第1镜（0–7 秒）：图1 的女生说：「我们不推销」","captions":[{"start":1,"end":2,"text":"不推销"}],"keyframes":[]}]}""");
    }
    static JsonNode step(JsonNode plan,String id) {
        for(JsonNode s:plan.path("steps"))if(id.equals(s.path("id").asText()))return s;
        throw new AssertionError("no step "+id+": "+plan);
    }

    @Test
    void depthTurnsEachOriginalSegmentIntoAMotionReferenceBeforeTheVideo() throws Exception {
        var task=StudioRecreationTaskPlan.prepare(film(),materials(),"ai-h3",h3(),"768p","9:16",true,FRAMES,6,"换成小美和保温杯","depth",SEGMENTS);
        assertEquals("depth",task.path("method").asText());
        assertEquals("universal_reference_video",task.path("mode").asText());
        var first=task.path("units").get(0);
        assertEquals(SEGMENTS+"1",first.path("clipNodeId").asText());
        assertEquals(0,first.path("keyframes").size(),"深度复刻不做开场画面");
        assertEquals("d1",first.path("refs").get(0).path("stepId").asText());
        assertEquals("reference-video",first.path("refs").get(0).path("role").asText());
        assertEquals("视频1",first.path("refs").get(0).path("label").asText());
        assertEquals("girl",first.path("refs").get(1).path("nodeId").asText());assertEquals("图1",first.path("refs").get(1).path("label").asText());

        var plan=StudioRecreationTaskPlan.build(task,answer());
        var validated=StudioPlanValidator.validateSkillPlan(plan,rules(),"production",Set.of(SEGMENTS+"1",SEGMENTS+"2","cup","girl"));
        var d1=step(validated,"d1");
        assertEquals("video-control",d1.path("operation").asText());
        assertEquals(SEGMENTS+"1",d1.path("settings").path("referenceBindings").get(0).path("nodeId").asText());
        assertEquals("clip",d1.path("settings").path("referenceBindings").get(0).path("role").asText());
        var v1=step(validated,"v1");
        assertTrue(StreamSupport.stream(v1.path("dependsOn").spliterator(),false).anyMatch(d->"d1".equals(d.asText())));
        assertEquals("d1",v1.path("settings").path("referenceBindings").get(0).path("stepId").asText());
        assertTrue(step(validated,"final").path("settings").has("captions"),"深度复刻照样把原片字幕加回成片");
    }

    /** 2026-11-11 真跑：深度复刻三段分开生成，第三段换了个房间。第一段的开场截图换好人和商品做一张场景图，每段都带上它。 */
    @Test
    void depthMakesOneSceneImageAndEverySegmentUsesIt() throws Exception {
        ObjectNode film=(ObjectNode)film();
        var frames=film.putArray("frames");
        for(int n=1;n<=3;n++)frames.addObject().put("shot",n).put("at",n).put("storageKey","ipstudio_gen/u/frame-"+n+".jpg");
        var task=StudioRecreationTaskPlan.prepare(film,materials(),"ai-h3",h3(),"768p","9:16",true,FRAMES,6,"换成小美和保温杯","depth",SEGMENTS);
        var first=task.path("units").get(0);var second=task.path("units").get(1);
        assertEquals(1,first.path("keyframes").size(),"只做一张场景图");
        assertEquals(1,first.path("keyframes").get(0).path("shot").asInt(),"取第一段最开头那一镜");
        assertEquals("k1",first.path("refs").get(1).path("stepId").asText());assertEquals("图1",first.path("refs").get(1).path("label").asText());
        assertEquals(0,second.path("keyframes").size());
        assertEquals("k1",second.path("sceneStepId").asText());
        assertEquals("k1",second.path("refs").get(1).path("stepId").asText(),"后面几段带上同一张场景图");
        assertEquals("girl",second.path("refs").get(2).path("nodeId").asText());

        var plan=StudioRecreationTaskPlan.build(task,answer(),(stage,vars)->StudioPromptCallPoints.RECREATION_KEYFRAME.equals(stage)?"场景图":StudioRecreationTaskPlan.LIBRARY.render(stage,vars));
        List<String> ids=new ArrayList<>();plan.path("steps").forEach(st->ids.add(st.path("id").asText()));
        assertEquals(List.of("k1","d1","v1","c1","d2","v2","c2","final"),ids);
        assertEquals(3,step(plan,"k1").path("settings").path("referenceBindings").size(),"原片截图加两份素材（写提示词的模型没点名时全带上）");
        var validated=StudioPlanValidator.validateSkillPlan(plan,rules(),"production",Set.of(SEGMENTS+"1",SEGMENTS+"2","cup","girl",FRAMES+"1"));
        var v2=step(validated,"v2");
        assertTrue(StreamSupport.stream(v2.path("dependsOn").spliterator(),false).anyMatch(d->"k1".equals(d.asText())),"第二段等场景图做完");
        assertTrue(StreamSupport.stream(v2.path("settings").path("referenceBindings").spliterator(),false).anyMatch(r->"k1".equals(r.path("stepId").asText())));
        assertEquals("depth-control",v2.path("strategy").path("method").asText());
    }

    /** 页面上关了「自动检查」（2026-11-11 用户要求做成开关）：开场画面、场景图和每段视频都不检查，也就不会自动重出。 */
    @Test
    void turningAutoCheckOffLeavesNoCheckSteps() throws Exception {
        ObjectNode film=(ObjectNode)film();
        var frames=film.putArray("frames");
        for(int n=1;n<=3;n++)frames.addObject().put("shot",n).put("at",n).put("storageKey","ipstudio_gen/u/frame-"+n+".jpg");
        for(String method:List.of("recreation","depth")) {
            var task=StudioRecreationTaskPlan.prepare(film,materials(),"ai-h3",h3(),"768p","9:16",null,FRAMES,6,"换成小美",method,SEGMENTS);
            task.put("maxSteps",28);
            StudioRecreationTaskPlan.Texts texts=(stage,vars)->StudioPromptCallPoints.RECREATION_KEYFRAME.equals(stage)?"图":StudioRecreationTaskPlan.LIBRARY.render(stage,vars);
            assertTrue(StreamSupport.stream(StudioRecreationTaskPlan.build(task,answer(),texts).path("steps").spliterator(),false)
                    .anyMatch(st->"check".equals(st.path("operation").asText())),method+"：默认有检查");
            task.put("autoCheck",false);
            var plan=StudioRecreationTaskPlan.build(task,answer(),texts);
            assertTrue(StreamSupport.stream(plan.path("steps").spliterator(),false).noneMatch(st->"check".equals(st.path("operation").asText())),method+"：关掉后没有检查");
            assertTrue(StreamSupport.stream(plan.path("steps").spliterator(),false).anyMatch(st->"assemble".equals(st.path("operation").asText())));
        }
    }

    @Test
    void replacementGivesTheOriginalSegmentToTheVideoModelAndAddsNoCaptions() throws Exception {
        var task=StudioRecreationTaskPlan.prepare(film(),materials(),"ai-h3",h3(),"768p","9:16",null,FRAMES,6,"","replacement",SEGMENTS);
        var plan=StudioRecreationTaskPlan.build(task,answer());
        var validated=StudioPlanValidator.validateSkillPlan(plan,rules(),"production",Set.of(SEGMENTS+"1",SEGMENTS+"2","cup","girl"));
        for(JsonNode s:validated.path("steps"))assertNotEquals("video-control",s.path("operation").asText());
        var v2=step(validated,"v2").path("settings").path("referenceBindings");
        assertEquals(SEGMENTS+"2",v2.get(0).path("nodeId").asText());assertEquals("reference-video",v2.get(0).path("role").asText());
        assertFalse(step(validated,"final").path("settings").has("captions"),"原片画面里已有字幕，不再叠一层");
    }

    @Test
    void clipMethodsDropAnEndCardOnlySegmentButStoryboardKeepsIt() throws Exception {
        var b=StudioVideoBreakdown.normalize(om.readTree("""
            {"summary":"门店","shots":[{"start":0,"end":7,"visual":"排队"},{"start":7,"end":13,"visual":"老板说话"},{"start":13,"end":17,"visual":"账号片尾","caption":"抖音号 123456789"}]}"""),17,List.of(7.0,13.0));
        ObjectNode film=om.createObjectNode();film.set("breakdown",b);
        // 整理拆解时长镜头会按节拍再切开，片尾那一镜的序号按内容找
        int card=0,last=b.path("shots").size()-1;
        while(card<=last&&!"账号片尾".equals(b.path("shots").get(card).path("visual").asText()))card++;
        assertTrue(card>0&&card<=last,b.toString());
        var segments=film.putArray("segments");
        segments.addObject().put("no",1).put("startSec",0).put("endSec",13).put("firstShot",0).put("lastShot",card-1);
        segments.addObject().put("no",2).put("startSec",13).put("endSec",17).put("firstShot",card).put("lastShot",last);
        assertEquals(1,StudioRecreationTaskPlan.prepare(film,materials(),"ai-h3",h3(),"768p","9:16",null,FRAMES,6,"","replacement",SEGMENTS).path("units").size());
        assertEquals(2,StudioRecreationTaskPlan.prepare(film,materials(),"ai-h3",h3(),"768p","9:16",null,FRAMES,6,"").path("units").size());
    }

    @Test
    void eachMethodHasItsOwnPromptStageAndItRendersTheSegmentFootage() throws Exception {
        assertEquals(StudioPromptCallPoints.RECREATION_COMPILE,StudioPromptCallPoints.recreationCompile("recreation"));
        assertEquals(StudioPromptCallPoints.RECREATION_COMPILE_DEPTH,StudioPromptCallPoints.recreationCompile("depth"));
        assertEquals(StudioPromptCallPoints.RECREATION_COMPILE_REPLACE,StudioPromptCallPoints.recreationCompile("replacement"));
        for(String method:List.of("depth","replacement")) {
            var task=StudioRecreationTaskPlan.prepare(film(),materials(),"ai-h3",h3(),"768p","9:16",null,FRAMES,6,"",method,SEGMENTS);
            String text=StudioRecreationTaskPlan.LIBRARY.render(StudioPromptCallPoints.recreationCompile(method),
                    StudioRecreationTaskPlan.variables(task,film().path("breakdown"),""));
            assertTrue(text.contains("### 第 1 段"),text);
            assertTrue(text.contains("- 视频1："),"每段的视频1 列在素材里："+text);
        }
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
