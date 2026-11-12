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
 * 爆款复刻的三种方式（docs/ip-studio-recreation.md「三种复刻方式」）。三种都先拉片（看视频，写逐镜台词和动作），由代码按拉片结果分段，
 * 模型只写每段的提示词；不同的是每段交给视频模型什么：
 * <ul>
 *   <li>分镜复刻（recreation）：按原片每个镜头的开场画面重新出图，视频模型从图开始拍。原片不交给视频模型。适合剪辑多、换镜频繁的片子。</li>
 *   <li>深度复刻（depth）：把原片这一段转成深度图或骨骼图（不带原片的人、商品和字），作为动作参考交给视频模型。适合镜头少、动作连贯的片子（口播、单人展示、跳舞）。</li>
 *   <li>元素替换（replacement）：原片这一段直接交给视频模型，只换用户点名的东西。适合原片拍得好、只想换掉其中一样。</li>
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

    /** 每段原片能有多长：不超过模型单段上限，也不超过参考视频的时长上限；不短于两者的下限。 */
    public record Clip(int minSec,int maxSec) {}
    public static Clip clip(VideoStudioModel model) {
        var contract=model.contract();var reference=referenceMode(model).references().video();
        int max=contract.maxSeconds(),min=Math.max(1,contract.minSeconds());
        if(reference.maxDurationSec()!=null&&reference.maxDurationSec()>0)max=Math.min(max,reference.maxDurationSec());
        if(reference.minDurationSec()!=null)min=Math.max(min,reference.minDurationSec());
        if(min>max)throw BusinessException.badRequest("STUDIO_CLONE_REFERENCE_UNSUPPORTED","当前模型的参考视频时长限制不能分段，请更换模型或使用分镜复刻。");
        return new Clip(min,max);
    }

    /** 分析之前做得了吗：所选模型能带参考视频；深度复刻还要有动作提取服务。 */
    public VideoStudioModel require(String kind,String modelId) {
        if("depth".equals(kind))depth.requireConfigured();
        var selected=model(modelId);clip(selected);
        return selected;
    }

    /**
     * 制作部分（不含拉片和写提示词）的报价：按页面时长和参考视频的分段上限切段，每段一条带参考视频的视频和一次检查，
     * 和拉片后代码拼出的方案同一种步骤（{@link StudioRecreationTaskPlan#build}），所以分析后的报价不会比这里高。
     */
    public StudioVideoTaskService.Quote price(String user,String kind,String modelId,String tier,int duration,String ratio,int images,boolean character,boolean voice,boolean optimize) {
        if(images<0||images>StudioRecreationTaskPlan.MAX_IMAGES-(character?1:0))throw bad("最多添加 "+StudioRecreationTaskPlan.MAX_IMAGES+" 张替换图片");
        var selected=require(kind,modelId);var mode=referenceMode(selected);var bounds=clip(selected);
        List<Integer> segments;
        try {segments=SegmentedPlan.split(Math.max(1,duration),bounds.minSec(),bounds.maxSec());}
        catch(IllegalArgumentException e){throw bad("请选择可用的视频模型");}
        if(segments.size()>SegmentedPlan.MAX_SEGMENTS)throw BusinessException.badRequest("STUDIO_SEGMENTS_TOO_MANY",
                "「"+selected.name()+"」每段参考视频最长 "+bounds.maxSec()+" 秒，"+duration+" 秒需要分 "+segments.size()+" 段，超出上限。请缩短参考视频或更换模型");
        var refs=mode.references();
        int imageLimit=Math.min(refs.image()==null?0:refs.image().maxCount(),refs.maxImagesWithVideo()>0?refs.maxImagesWithVideo():Integer.MAX_VALUE);
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
            settings.putObject("video").put("mode",mode.mode()).put("resolutionTier",tier).put("optimize",optimize(kind,optimize));
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
