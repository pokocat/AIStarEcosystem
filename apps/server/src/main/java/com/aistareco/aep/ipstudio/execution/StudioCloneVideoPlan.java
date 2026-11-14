package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.segmented.SegmentedPlan;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * 爆款复刻的三种方式（docs/ip-studio-recreation.md「三种复刻方式」）。分镜复刻和深度复刻先拉片（看视频，写逐镜台词和动作），由代码按拉片结果分段，
 * 模型只写每段的提示词；元素替换不拉片、不写提示词，按真实切镜点切段，每段交给视频模型编辑。不同的是每段交给视频模型什么：
 * <ul>
 *   <li>分镜复刻（recreation）：按原片每个镜头的开场画面重新出图，视频模型从图开始拍。原片不交给视频模型。适合剪辑多、换镜频繁的片子。</li>
 *   <li>深度复刻（depth）：把原片这一段转成深度图或骨骼图（不带原片的人、商品和字），作为动作参考交给视频模型。适合镜头少、动作连贯的片子（口播、单人展示、跳舞）。</li>
 *   <li>元素替换（replacement）：原片这一段直接交给视频模型，只换用户点名的东西。适合原片拍得好、只想换掉其中一样。
 *       模型的全能参考模式配了「编辑原视频」（{@link VideoStudioEditSpec}，Seedance 2.5）就走厂商的编辑任务，每段按编辑的时长上限切；
 *       没配的（Seedance 2.0、H3）照常用全能参考，靠提示词编辑。</li>
 * </ul>
 * 深度复刻和元素替换要把原片片段作为参考视频交给模型，所以只开放声明了视频参考的模型，分段也受参考视频的时长限制。
 */
@Component
public class StudioCloneVideoPlan {
    /** 爆款复刻的三种方式，值就是任务的 kind。 */
    public static final Set<String> METHODS=Set.of("recreation","depth","replacement");
    private final StudioVideoService videos;
    private final StudioDepthVideoService depth;
    private final StudioPlanQuoter quoter;
    private final com.aistareco.aep.service.storage.FileStorageService storage;
    private final ObjectMapper mapper;
    public StudioCloneVideoPlan(StudioVideoService videos,StudioDepthVideoService depth,StudioPlanQuoter quoter,
                                com.aistareco.aep.service.storage.FileStorageService storage,ObjectMapper mapper) {
        this.videos=videos;this.depth=depth;this.quoter=quoter;this.storage=storage;this.mapper=mapper;
    }
    /** 原片片段要作为参考视频交给视频模型的方式。 */
    public static boolean nativeClone(String kind){return "depth".equals(kind)||"replacement".equals(kind);}
    public static boolean method(String kind){return METHODS.contains(Objects.toString(kind,""));}
    /**
     * 深度复刻总是先整理成 H3 的六段式：ReShot 的实测结论是控制视频要在提示词里单独定义成「只迁移动作和机位、不迁移灰色画面」
     * 的主体，按原文直发时 H3 会把灰色画面或骨骼线条当成要画的东西。模型不支持优化时按原文。
     */
    public static boolean optimize(String kind,boolean chosen){return "depth".equals(kind)||chosen;}

    public VideoStudioModel model(String id) {
        return videos.models().stream().filter(m->id==null?m.isDefault():id.equals(m.endpointId())).findFirst()
                .orElseThrow(()->bad("请选择可用的视频模型"));
    }
    /** 能带参考视频、不要首尾帧的模式。 */
    public static VideoStudioModeSpec referenceMode(VideoStudioModel model) {
        if(model.contract()==null)throw unsupported();
        return model.contract().modes().stream().filter(m->m.references()!=null&&m.references().video()!=null&&m.references().video().maxCount()>0
                        &&!m.needsFirstFrame()&&!m.needsLastFrame()).findFirst().orElseThrow(StudioCloneVideoPlan::unsupported);
    }
    private static BusinessException unsupported() {
        return BusinessException.badRequest("STUDIO_CLONE_REFERENCE_UNSUPPORTED","当前模型不支持视频参考，请更换模型或使用分镜复刻。");
    }

    /** 元素替换能不能走厂商的编辑任务：能带参考视频的模式配了 edit。没配返回 null（照常全能参考）。 */
    public static VideoStudioEditSpec edit(VideoStudioModel model) {return referenceMode(model).edit();}
    /** 这次的方式要不要编辑原视频：元素替换，且模型配了编辑。 */
    public static boolean edits(String kind,VideoStudioModel model) {return "replacement".equals(kind)&&edit(model)!=null;}

    /**
     * 原片画面最接近这档清晰度里的哪个画幅（编辑任务的输出跟原片画幅走，计划和合成要按它）。读不到尺寸、这档没有画布时用 {@code fallback}。
     */
    public static String closestRatio(VideoStudioModel model,String tier,int width,int height,String fallback) {
        if(width<=0||height<=0||model.contract()==null||model.contract().tiers()==null)return fallback;
        double target=Math.log((double)width/height);
        String best=null;double gap=Double.MAX_VALUE;
        for(var t:model.contract().tiers()) {
            if(tier!=null&&!tier.equals(t.tier()))continue;
            for(var c:t.canvases()) {
                String[] parts=c.aspectRatio().split(":");
                double d=Math.abs(Math.log(Double.parseDouble(parts[0])/Double.parseDouble(parts[1]))-target);
                if(d<gap){gap=d;best=c.aspectRatio();}
            }
        }
        return best==null?fallback:best;
    }

    /** 每段原片能有多长：不超过模型单段上限，也不超过参考视频的时长上限；不短于两者的下限。 */
    public record Clip(int minSec,int maxSec) {}
    public static Clip clip(VideoStudioModel model) {return clip(model,null);}
    /** 元素替换走编辑任务时，原片按编辑的时长上下限切（Seedance 2.5 编辑收 4–30 秒，普通参考只收 2–15 秒）。 */
    public static Clip clip(VideoStudioModel model,String kind) {
        var contract=model.contract();var reference=referenceMode(model).references().video();
        int max=contract.maxSeconds(),min=Math.max(1,contract.minSeconds());
        var edit=edits(kind,model)?edit(model):null;
        Integer upper=edit!=null?Integer.valueOf(edit.maxSourceSec()):reference.maxDurationSec(),lower=edit!=null?Integer.valueOf(edit.minSourceSec()):reference.minDurationSec();
        if(upper!=null&&upper>0)max=Math.min(max,upper);
        if(lower!=null)min=Math.max(min,lower);
        if(min>max)throw BusinessException.badRequest("STUDIO_CLONE_REFERENCE_UNSUPPORTED","当前模型的参考视频时长限制不能分段，请更换模型或使用分镜复刻。");
        return new Clip(min,max);
    }

    /**
     * 页面上能选的最短时长：分镜复刻是模型单段的下限；深度复刻和元素替换每段原片还要够参考视频（元素替换走编辑时按编辑）的下限。
     * 最长是原片本身（自定义时长只截原片的前 N 秒，见 StudioWorkflowService 的 limitSec）。
     */
    public int minimumSeconds(String kind,VideoStudioModel model) {
        return nativeClone(kind)?clip(model,kind).minSec():Math.max(1,model.contract().minSeconds());
    }

    /**
     * 元素替换能不能把原片直接交给视频模型、不切分（2026-11-12 用户：「不是直接参考吗」）：没有截短（页面时长不短于原片）、
     * 原片时长在每段的上下限之内、格式和大小也合这个模型参考视频的规则。能就返回原片信息，不能（要切分或转码）返回 null。
     */
    public StudioDepthVideoService.Source directSource(String user,String kind,VideoStudioModel model,String key,int duration) {
        if(!"replacement".equals(kind))return null;
        var source=depth.source(user,key);
        if(duration<Math.round(source.seconds()))return null;
        var bounds=clip(model,kind);
        if(source.seconds()>bounds.maxSec()+.05||source.seconds()<bounds.minSec())return null;
        var rule=referenceMode(model).references().video();
        try {
            var path=storage.openForRead(source.key());
            if(java.nio.file.Files.size(path)>rule.maxBytes())return null;
            byte[] header;
            try(var in=java.nio.file.Files.newInputStream(path)){header=in.readNBytes(4096);}
            if(!com.aistareco.aep.service.storage.MediaBytes.allowed(com.aistareco.aep.service.storage.MediaBytes.sniffConfigured("video",header),rule.formats()))return null;
        } catch(Exception e) {return null;}
        return source;
    }

    /** 分析之前做得了吗：所选模型能带参考视频；深度复刻还要有动作提取服务。 */
    public VideoStudioModel require(String kind,String modelId) {
        if("depth".equals(kind))depth.requireConfigured();
        var selected=model(modelId);clip(selected,kind);
        return selected;
    }

    /**
     * 制作部分（不含拉片和写提示词）的报价：按页面时长和参考视频的分段上限切段，每段一条带参考视频的视频和一次检查，
     * 和代码拼出的方案同一种步骤（{@link StudioRecreationTaskPlan#build}），所以分析后的报价不会比这里高。
     * 元素替换按真实切镜点切段，段数可能比这里按时长均分的多一两段；视频按秒计价，总价不变，只是检查多一两次。
     */
    public StudioVideoTaskService.Quote price(String user,String kind,String modelId,String tier,int duration,String ratio,int images,boolean character,boolean voice,boolean optimize) {
        if(images<0||images>StudioRecreationTaskPlan.MAX_IMAGES-(character?1:0))throw bad("最多添加 "+StudioRecreationTaskPlan.MAX_IMAGES+" 张替换图片");
        var selected=require(kind,modelId);var mode=referenceMode(selected);var bounds=clip(selected,kind);
        boolean edit=edits(kind,selected);
        List<Integer> segments;
        try {segments=SegmentedPlan.split(Math.max(1,duration),bounds.minSec(),bounds.maxSec());}
        catch(IllegalArgumentException e){throw bad("请选择可用的视频模型");}
        if(segments.size()>SegmentedPlan.MAX_SEGMENTS)throw BusinessException.badRequest("STUDIO_SEGMENTS_TOO_MANY",
                "「"+selected.name()+"」每段参考视频最长 "+bounds.maxSec()+" 秒，"+duration+" 秒需要分 "+segments.size()+" 段，超出上限。请缩短参考视频或更换模型");
        var refs=mode.references();
        int imageLimit=Math.min(refs.image()==null?0:refs.image().maxCount(),refs.maxImagesWithVideo()>0?refs.maxImagesWithVideo():Integer.MAX_VALUE);
        if(voice&&edit&&!mode.edit().acceptsReferenceAudio())
            throw bad("当前模型编辑原视频时无法添加独立参考声音，请移除参考声音或更换模型");
        if(voice&&!StudioRecreationTaskPlan.acceptsVoice(mode,true))throw bad("当前模型不支持参考声音，请更换模型或移除声音");
        if(refs.maxTotal()>0)imageLimit=Math.min(imageLimit,Math.max(0,refs.maxTotal()-1-(voice?1:0)));
        boolean scene="depth".equals(kind)&&imageLimit>0;
        int pictures=Math.min(images+(character?1:0)+(scene?1:0),imageLimit);
        ObjectNode plan=mapper.createObjectNode();
        ArrayNode steps=plan.putArray("steps");
        if(scene) {
            // 深度复刻的场景图（StudioRecreationTaskPlan）：一张图加一次检查
            ObjectNode image=steps.addObject().put("id","k1").put("operation","image").put("prompt","场景图");
            image.putObject("settings").put("operation","image").put("aspectRatio",ratio).put("count",1).putArray("referenceBindings")
                    .addObject().put("nodeId","quote-frame").put("role","reference-image").put("order",1);
            ObjectNode check=steps.addObject().put("id","ck1").put("operation","check").put("prompt","");
            var ids=check.putObject("settings").put("operation","check").put("targetStepId","k1").putArray("checkIds");
            StudioRecreationTaskPlan.KEYFRAME_CHECK_IDS.forEach(ids::add);
        }
        int no=0;
        for(int seconds:segments) {
            no++;
            ObjectNode video=steps.addObject().put("id","v"+no).put("operation","video").put("prompt","视频复刻");
            ObjectNode settings=video.putObject("settings").put("operation","video").put("model",selected.endpointId())
                    .put("durationSec",seconds).put("aspectRatio",ratio).put("count",1);
            var video2=settings.putObject("video").put("mode",mode.mode()).put("resolutionTier",tier).put("optimize",optimize(kind,optimize));
            if(edit)video2.put("edit",true);
            ArrayNode bindings=settings.putArray("referenceBindings");
            int order=0;
            bindings.addObject().put("nodeId","quote-video").put("role","reference-video").put("order",order++);
            for(int i=0;i<pictures;i++)bindings.addObject().put("nodeId","quote-image-"+i).put("role","reference-image").put("order",order++);
            if(voice)bindings.addObject().put("nodeId","quote-voice").put("role","reference-audio").put("order",order++);
            ObjectNode check=steps.addObject().put("id","c"+no).put("operation","check").put("prompt","");
            var checkSettings=check.putObject("settings").put("operation","check").put("targetStepId","v"+no);
            var ids=checkSettings.putArray("checkIds");StudioRecreationTaskPlan.CHECK_IDS.forEach(ids::add);
        }
        quoter.quote(user,plan);
        long cost=plan.path("budget").path("estimated").asLong();
        return new StudioVideoTaskService.Quote(cost,Math.multiplyExact(cost,3),segments,0);
    }

    /**
     * 参考视频适合哪种方式（页面上的「推荐」）：只按真实切镜数和平均镜头时长判断，不调模型、不扣积分。
     * 镜头少、每个镜头长（口播、单人展示、跳舞）照动作重拍最像，推荐深度复刻；换镜频繁的推荐分镜复刻。
     * 元素替换看的是用户想不想保留原片画面，看视频判断不了，不推荐。
     */
    public record Advice(double durationSec,int shots,double averageShotSec,String recommended,String reason) {}
    /** 深度复刻的门槛：最多 2 个镜头，或平均每个镜头至少这么多秒。 */
    static final double DEPTH_AVERAGE_SHOT_SEC=6;
    private final Map<String,Advice> advised=Collections.synchronizedMap(new LinkedHashMap<>(64,.75f,true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String,Advice> eldest){return size()>256;}
    });
    public Advice advise(String user,String key) {
        var source=depth.source(user,key);
        Advice cached=advised.get(source.key());
        if(cached!=null)return cached;
        List<Double> cuts;
        try {cuts=StudioVideoBreakdown.detectCuts(storage.openForRead(source.key()),source.seconds());}
        catch(Exception e){throw BusinessException.badRequest("STUDIO_CLONE_VIDEO_INVALID","参考视频无法读取，请更换可播放的视频。");}
        Advice advice=advice(source.seconds(),cuts.size()+1);
        advised.put(source.key(),advice);
        return advice;
    }
    static Advice advice(double seconds,int shots) {
        double average=Math.round(seconds/Math.max(1,shots)*10)/10.0;
        boolean depth=shots<=2||average>=DEPTH_AVERAGE_SHOT_SEC;
        // 页面接着写「，适合深度复刻。」或「，建议使用分镜复刻。」，这里只写看到了什么
        String reason=shots==1?"原片是一镜到底"
                :"原片有 "+shots+" 个镜头，平均每个约 "+fmt(average)+" 秒";
        return new Advice(Math.round(seconds*10)/10.0,shots,average,depth?"depth":"recreation",reason);
    }
    private static String fmt(double v){return v==Math.rint(v)?String.valueOf((long)v):String.valueOf(v);}

    private static BusinessException bad(String message){return BusinessException.badRequest("STUDIO_INPUT_INVALID",message);}
}
