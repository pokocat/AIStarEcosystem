package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.service.StudioVideoBreakdown;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;

/**
 * AI 视频页的爆款复刻，拉片之后的制作方案（docs/ip-studio-recreation.md「代码拼制作方案」）。
 *
 * <p>线上 2026-11-07 至 11-09 的 12 条复刻任务里，8 条停在「写分镜脚本 / 生成」：模型自己写整份方案，清晰度写成别的模型的、
 * 一步塞两三段原片、引用画布上不存在的素材、方案读不出来。现在分段、时长、模型、清晰度、画幅和每段用哪段原片、哪张图做什么，
 * 全部由这里按拉片结果和用户在页面上选的设置拼好；模型只写每段的提示词和字幕（提示词库 stage-recreation-compile）。
 * 拼出来的方案仍走 {@code StudioPlanValidator.validateSkillPlan}、报价和指纹，和模型写的方案同一条路。
 */
public final class StudioRecreationTaskPlan {
    private static final ObjectMapper OM=new ObjectMapper();
    private StudioRecreationTaskPlan() {}

    /** 用户在视频页上传的一份素材（SegmentedMaterial）。slot：image | character | voice。 */
    public record Material(String nodeId,String title,String slot) {}

    /**
     * 受理「写分镜脚本」那一步时冻结的事实（存进 {@code _exec.recreationTask}），worker 用它和模型写的提示词拼方案。
     *
     * <p>原片片段不交给视频模型（2026-11-09 真实出片：H3 全能参考带上原片这一段，就照着原片把原商品、平台水印和字幕全画出来，
     * 用户的杯子一次都没出现；提示词写了「不参考商品外观、文字和水印」也不管用）。原片的动作、景别、节奏、台词都写进逐镜提示词，
     * 片段只留在画布上给人看。
     *
     * @param film      拉片输出（filmStudy，带 breakdown）
     */
    public static ObjectNode prepare(JsonNode film,List<Material> materials,String model,
                                     VideoStudioContract contract,String tier,String ratio,Boolean optimize) {
        if(contract==null)throw unavailable("所选视频模型不可用，请换一个模型");
        VideoStudioModeSpec mode=mode(contract,materials!=null&&!materials.isEmpty());
        String chosenTier=contract.tiers().stream().anyMatch(t->t.tier().equals(tier))?tier:contract.tiers().get(0).tier();
        ObjectNode task=OM.createObjectNode().put("model",model).put("mode",mode.mode()).put("tier",chosenTier).put("ratio",ratio==null?"9:16":ratio);
        if(optimize!=null)task.put("optimize",optimize);
        var refs=mode.references();
        // 素材顺序：人物在前（同一个人的图集中在一起），再商品 / 场景图，最后声音。
        List<Material> people=new ArrayList<>(),images=new ArrayList<>(),voices=new ArrayList<>();
        for(Material m:materials){switch(m.slot()==null?"image":m.slot()){case "character" -> people.add(m);case "voice" -> voices.add(m);default -> images.add(m);}}
        List<Material> pictures=new ArrayList<>(people);pictures.addAll(images);
        var materialArray=task.putArray("materials");
        for(Material m:materials)materialArray.addObject().put("nodeId",m.nodeId()).put("title",blank(m.title())?"素材":m.title()).put("slot",slotLabel(m.slot()));
        var units=task.putArray("units");
        double offset=0;
        for(JsonNode segment:film.path("segments")) {
            int no=segment.path("no").asInt();
            double start=segment.path("startSec").asDouble(),end=segment.path("endSec").asDouble(),length=end-start;
            int seconds=(int)Math.max(contract.minSeconds(),Math.min(contract.maxSeconds(),Math.round(length)));
            ObjectNode unit=units.addObject().put("no",no).put("title",segment.path("title").asText("第 "+no+" 段")).put("startSec",start).put("endSec",end)
                    .put("seconds",seconds).put("offsetSec",offset).put("firstShot",segment.path("firstShot").asInt()).put("lastShot",segment.path("lastShot").asInt());
            offset+=seconds;
            var bindings=unit.putArray("refs");int order=0;
            if(refs!=null) {
                int imageLimit=refs.image()==null?0:refs.image().maxCount();
                int total=refs.maxTotal()>0?refs.maxTotal():Integer.MAX_VALUE;
                int n=1;
                for(Material m:pictures) {
                    if(n>imageLimit||order>=total)break;
                    bindings.addObject().put("nodeId",m.nodeId()).put("role","character".equals(m.slot())?"character":"reference-image").put("order",order++)
                            .put("label","图"+n).put("what",(blank(m.title())?"素材":m.title())+"（"+slotLabel(m.slot())+"）");
                    n++;
                }
                int audioLimit=refs.audio()==null?0:refs.audio().maxCount();n=1;
                for(Material m:voices) {
                    if(n>audioLimit||order>=total)break;
                    bindings.addObject().put("nodeId",m.nodeId()).put("role","reference-audio").put("order",order++)
                            .put("label","音频"+n).put("what",(blank(m.title())?"声音":m.title())+"（说话的声音）");
                    n++;
                }
            }
        }
        if(units.isEmpty())throw BusinessException.badRequest("STUDIO_RECREATION_NO_SEGMENTS","拉片没有得到可用的分段，请重新开始");
        return task;
    }

    /** 交给模型（stage-recreation-compile）的变量。 */
    public static Map<String,Object> variables(JsonNode task,JsonNode breakdown,String requirement) {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("requirement",blank(requirement)?"把原片的人物和商品换成我的素材，其它照原片。":requirement.strip());
        List<Map<String,Object>> materials=new ArrayList<>();
        // 素材编号只在每段里出现（每段的图1 可能不同）；这里列素材本身，不编号。
        for(JsonNode m:task.path("materials"))materials.add(Map.of("label","「"+m.path("title").asText()+"」","title",slotName(m.path("slot").asText()),"slot","用户上传的替换素材"));
        out.put("materials",materials);
        String report=StudioVideoBreakdown.report(breakdown);
        out.put("breakdown",report.length()>20000?report.substring(0,20000):report);
        List<Map<String,Object>> units=new ArrayList<>();
        for(JsonNode u:task.path("units")) {
            List<Map<String,Object>> refs=new ArrayList<>();
            for(JsonNode r:u.path("refs"))refs.add(Map.of("label",r.path("label").asText(),"what",r.path("what").asText()));
            if(refs.isEmpty())refs.add(Map.of("label","（无）","what","这段没有参考素材，只按文字描述拍"));
            units.add(Map.of("no",u.path("no").asInt(),"range",StudioVideoBreakdown.range(u.path("startSec").asDouble(),u.path("endSec").asDouble()),
                    "seconds",u.path("seconds").asInt(),"refs",refs,
                    "shots",StudioVideoBreakdown.shotTable(breakdown,u.path("firstShot").asInt(),u.path("lastShot").asInt(),u.path("startSec").asDouble(),
                            u.path("startSec").asDouble(),u.path("endSec").asDouble())));
        }
        out.put("units",units);
        return out;
    }

    /**
     * 模型写的每段提示词 + 冻结的事实 → 方案（和模型写方案时同一种结构，随后照常校验、报价）。
     * 缺了哪一段的提示词就整份判失败（AI_BAD_OUTPUT，按实际用量结算、可以重试），不拿拉片原文顶替。
     */
    private static String slotName(String slot) {
        return switch(slot==null?"":slot){case "character"->"人物照片";case "voice","audio"->"声音";case "video"->"视频";default->"图片";};
    }

    /** 原片作者的账号、平台号和平台片尾：不进用户的成片（2026-11-09 真跑：美食那条把原作者的抖音号写进了字幕）。 */
    static final java.util.regex.Pattern ORIGINAL_ACCOUNT=java.util.regex.Pattern.compile(
            "(抖音|快手|小红书|视频号|B站|b站|微博|微信)\\s*(号|搜索|ID|id)|来(抖音|快手|小红书)|[0-9]{7,}|@\\S");

    public static ObjectNode build(JsonNode task,JsonNode answer) {
        Map<Integer,JsonNode> written=new HashMap<>();
        for(JsonNode u:answer.path("units"))if(u.path("prompt").isTextual()&&!u.path("prompt").asText().isBlank())written.putIfAbsent(u.path("no").asInt(),u);
        ObjectNode plan=OM.createObjectNode();
        plan.put("summary",text(answer.path("summary"),"按原片的分段和节奏复刻，换成你的素材",1000));
        var approach=plan.putArray("approaches").addObject().put("id","remake").put("title","照原片分段复刻")
                .put("summary","按拉片的真实镜头分段，每段带上原片这一段做动作和节奏参考，换成你的素材。")
                .put("rationale","分段、时长和每段用哪些素材由系统按拉片结果定，模型只写每段的提示词。");
        approach.set("preserve",strings(answer.path("keep")));approach.set("change",strings(answer.path("change")));
        plan.put("recommendedApproachId","remake");
        var materialIds=plan.putArray("materialNodeIds");
        for(JsonNode m:task.path("materials"))materialIds.add(m.path("nodeId").asText());
        var steps=plan.putArray("steps");
        var clipOrder=OM.createArrayNode();
        var captions=OM.createArrayNode();
        double last=0;
        for(JsonNode u:task.path("units")) {
            int no=u.path("no").asInt();
            JsonNode w=written.get(no);
            if(w==null)throw BusinessException.wrapped(org.springframework.http.HttpStatus.BAD_GATEWAY,"AI_BAD_OUTPUT","模型没有写完每一段的提示词，这次没有完成。请重试",
                    "missing unit "+no+" of "+task.path("units").size());
            String id="v"+no;
            ObjectNode step=steps.addObject().put("id",id).put("operation","video").put("title",text(w.path("title"),u.path("title").asText("第 "+no+" 段"),60))
                    .put("prompt",w.path("prompt").asText().strip()).put("execution","auto");
            step.putObject("strategy").put("approachId","remake").put("method","remake-subject").put("reason","原片第 "+no+" 段");
            step.putArray("dependsOn");step.putArray("referenceNodeIds");
            ObjectNode settings=step.putObject("settings").put("operation","video").put("model",task.path("model").asText());
            settings.putObject("video").put("mode",task.path("mode").asText()).put("resolutionTier",task.path("tier").asText());
            settings.put("durationSec",u.path("seconds").asInt()).put("aspectRatio",task.path("ratio").asText()).put("count",1);
            var bindings=settings.putArray("referenceBindings");
            for(JsonNode r:u.path("refs"))bindings.addObject().put("nodeId",r.path("nodeId").asText()).put("role",r.path("role").asText()).put("order",r.path("order").asInt());
            clipOrder.addObject().put("stepId",id);
            // 字幕：这段生成的秒数内、时间按成片算；越界的截掉，重叠的顺延。
            double offset=u.path("offsetSec").asDouble(),seconds=u.path("seconds").asDouble();
            for(JsonNode c:w.path("captions")) {
                String line=c.path("text").asText("").strip();
                double start=c.path("start").asDouble(Double.NaN),end=c.path("end").asDouble(Double.NaN);
                if(line.isEmpty()||!Double.isFinite(start)||!Double.isFinite(end))continue;
                start=Math.max(0,Math.min(seconds,start))+offset;end=Math.max(0,Math.min(seconds,end))+offset;
                start=Math.max(start,last);
                if(end-start<.3||captions.size()>=60||ORIGINAL_ACCOUNT.matcher(line).find())continue;
                line=line.length()>40?line.substring(0,40):line;
                // 同一句字幕跨段（原片一条字幕挂满全片）：接上一条，不拆成几条一样的
                ObjectNode previous=captions.isEmpty()?null:(ObjectNode)captions.get(captions.size()-1);
                if(previous!=null&&previous.path("text").asText().equals(line)&&start-previous.path("end").asDouble()<=.05)previous.put("end",round(end));
                else captions.addObject().put("start",round(start)).put("end",round(end)).put("text",line);
                last=end;
            }
        }
        if(steps.size()>1||!captions.isEmpty()) {
            ObjectNode assemble=steps.addObject().put("id","final").put("operation","assemble").put("title","合成成片").put("prompt","按原片顺序合成").put("execution","auto");
            assemble.putArray("dependsOn");assemble.putArray("referenceNodeIds");
            ObjectNode settings=assemble.putObject("settings").put("operation","assemble").put("audioStrategy","generated");
            settings.set("clipOrder",clipOrder);
            if(!captions.isEmpty())settings.set("captions",captions);
        }
        plan.putArray("questions");
        return plan;
    }

    /** 有参考的模式优先（全能参考）；没有就用不需要首尾帧的模式，只按文字出片。 */
    static VideoStudioModeSpec mode(VideoStudioContract contract,boolean hasMaterials) {
        if(!hasMaterials)for(var m:contract.modes())if(m.references()==null&&!m.needsFirstFrame()&&!m.needsLastFrame())return m;
        for(var m:contract.modes())if(m.references()!=null&&!m.needsFirstFrame()&&!m.needsLastFrame())return m;
        for(var m:contract.modes())if(!m.needsFirstFrame()&&!m.needsLastFrame())return m;
        throw unavailable("所选视频模型只能按首帧出片，做不了复刻，请换一个支持参考素材的模型");
    }

    private static String slotLabel(String slot) {
        return switch(slot==null?"image":slot){case "character" -> "出镜人物";case "voice" -> "声音";default -> "替换素材";};
    }
    private static ArrayNode strings(JsonNode array) {
        ArrayNode out=OM.createArrayNode();
        if(array.isArray())for(JsonNode v:array)if(v.isTextual()&&!v.asText().isBlank()&&out.size()<12)out.add(v.asText().length()>500?v.asText().substring(0,500):v.asText());
        return out;
    }
    private static String text(JsonNode value,String fallback,int max) {
        String v=value!=null&&value.isTextual()&&!value.asText().isBlank()?value.asText().strip():fallback;
        return v.length()>max?v.substring(0,max):v;
    }
    private static boolean blank(String v){return v==null||v.isBlank();}
    private static double round(double v){return Math.round(v*100)/100.0;}
    private static BusinessException unavailable(String text){return BusinessException.badRequest("STUDIO_VIDEO_MODE_UNAVAILABLE",text);}
}
