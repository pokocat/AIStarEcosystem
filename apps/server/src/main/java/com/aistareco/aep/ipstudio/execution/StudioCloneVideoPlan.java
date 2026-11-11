package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dto.StudioSegmentedDtos.SegmentedVideoRequest;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Component;
import java.util.*;

/** System-built canvas recipes. Native reference-video support is required on the actual selected channel. */
@Component
public class StudioCloneVideoPlan {
    private final StudioVideoService videos;
    private final StudioWorkflowService workflow;
    private final StudioDepthVideoService depth;
    private final IpProjectService projects;
    private final ObjectMapper mapper;
    public StudioCloneVideoPlan(StudioVideoService videos,StudioWorkflowService workflow,StudioDepthVideoService depth,IpProjectService projects,ObjectMapper mapper) {
        this.videos=videos;this.workflow=workflow;this.depth=depth;this.projects=projects;this.mapper=mapper;
    }
    public static boolean nativeClone(String kind){return Set.of("depth","replacement").contains(Objects.toString(kind,""));}
    /**
     * 深度复刻总是先整理成 H3 的六段式：ReShot 的实测结论是控制视频要在提示词里单独定义成「只迁移动作和机位、不迁移灰色画面」
     * 的主体，按原文直发时 H3 会把灰色画面或骨骼线条当成要画的东西。模型不支持优化时按原文（下面的中文说明）。
     */
    static boolean optimize(String kind,boolean chosen){return "depth".equals(kind)||chosen;}
    private VideoStudioModel model(String id) {
        return videos.models().stream().filter(m->id==null?m.isDefault():id.equals(m.endpointId())).findFirst()
                .orElseThrow(()->bad("请选择可用的视频模型"));
    }
    private VideoStudioModeSpec referenceMode(VideoStudioModel model) {
        return model.contract().modes().stream().filter(m->m.references()!=null&&m.references().video().maxCount()>0&&!m.needsFirstFrame()&&!m.needsLastFrame()).findFirst()
                .orElseThrow(()->BusinessException.badRequest("STUDIO_CLONE_REFERENCE_UNSUPPORTED","当前模型不支持视频参考，请更换模型或使用分镜复刻。"));
    }
    public StudioVideoTaskService.Quote price(String user,String kind,String modelId,String tier,int duration,String ratio,int images,boolean character,boolean voice,boolean optimize) {
        if(images<0||images>12)throw bad("替换图片数量不正确");
        if("depth".equals(kind))depth.requireConfigured();
        var selected=model(modelId);var mode=referenceMode(selected);
        ObjectNode request=mapper.createObjectNode().put("nodeId",StudioPlanSteps.QUOTE_NODE).put("operation","video").put("prompt","视频复刻")
                .put("model",selected.endpointId()).put("durationSec",duration).put("aspectRatio",ratio).put("count",1);
        ObjectNode settings=request.putObject("video").put("mode",mode.mode()).put("resolutionTier",tier);
        if(selected.supportsPromptOptimization()) {if(optimize(kind,optimize))settings.put("rewrite","auto");else settings.put("optimizePrompt",false);}
        ArrayNode refs=settings.putArray("references");refs.addObject().put("mediaType","video").put("key","quote/video");
        for(int n=0;n<images+(character?1:0);n++)refs.addObject().put("mediaType","image").put("key","quote/image-"+n);
        if(voice)refs.addObject().put("mediaType","audio").put("key","quote/voice");
        long cost=workflow.quote(user,mapper.convertValue(request,RunRequest.class));
        return new StudioVideoTaskService.Quote(cost,Math.multiplyExact(cost,3),List.of(duration),0);
    }
    /** Validate the whole original clip, ownership and roles before creating any execution or paid native request. */
    public List<String> build(String user,String projectId,String kind,String sourceNodeId,SegmentedVideoRequest cfg,ObjectNode plan) {
        if(sourceNodeId==null||sourceNodeId.isBlank())throw bad("请添加参考视频");
        if("depth".equals(kind))depth.requireConfigured();
        var selected=model(cfg.model());var mode=referenceMode(selected);
        JsonNode doc=projects.readDoc(projects.required(user,projectId)),source=IpDocs.node(doc,sourceNodeId);
        if(source==null||!"video".equals(source.path("type").asText())||IpDocs.primaryStorageKey(source)==null)throw bad("请添加参考视频");
        var media=depth.source(user,IpDocs.primaryStorageKey(source));
        Integer lower=mode.references().video().minDurationSec(),upper=mode.references().video().maxDurationSec();
        double max=upper==null?60:Math.min(60,upper);
        if(media.seconds()>max+0.05||lower!=null&&media.seconds()<lower-0.05)
            throw bad("参考视频时长不符合当前模式，最长 "+(int)max+" 秒，请先裁剪或使用分镜复刻。");
        if(cfg.text()==null||cfg.text().isBlank()||cfg.text().length()>4000)throw bad("请填写要替换的内容，最多 4000 字");
        if(cfg.materials()==null)throw bad("素材信息不完整，请重新选择");
        if(cfg.materials().size()>14)throw bad("替换素材过多，请减少后重试");
        var context=new ArrayList<String>();context.add(sourceNodeId);
        ArrayNode steps=(ArrayNode)plan.path("steps");
        if("depth".equals(kind)) {
            ObjectNode control=steps.addObject().put("id","depth").put("operation","video-control").put("title","提取动作与空间结构")
                    .put("prompt","从参考视频提取时序一致的深度视频").put("execution","auto");
            control.putArray("dependsOn");
            control.putObject("settings").put("operation","video-control").putArray("referenceBindings")
                    .addObject().put("nodeId",sourceNodeId).put("role","clip").put("order",0);
        }
        String instruction="depth".equals(kind)
                // ReShot 给 Seedance 的写法：指明视频1、动作与运镜按顺序照做、控制画面本身不出现。灰度深度图和彩色骨骼图都可能是视频1（服务端按原片自动选）。
                ?"视频1是从参考视频提取的动作参考：灰色深度图（近处白、远处黑）或黑底彩色火柴人骨骼图。参考视频1的动作与运镜，顺序与视频保持一致；只取人物位置、每个动作、时间节奏和机位，画面里不要出现灰色深度图或骨骼线条。新人物、商品和场景的外观按用户描述，附有图片时以图片为准。"
                :"视频1是原参考视频。按用户要求替换指定元素，新元素外观按用户描述，如附有图片则以图片为准，尽量保留其余画面、镜头运动、动作和节奏。仅修改明确指定的对象。";
        ObjectNode video=steps.addObject().put("id","video").put("operation","video").put("title","depth".equals(kind)?"深度复刻成片":"元素替换成片").put("execution","auto")
                .put("prompt",instruction+"\n用户要求："+cfg.text());
        ArrayNode dependencies=video.putArray("dependsOn");if("depth".equals(kind))dependencies.add("depth");
        ObjectNode settings=video.putObject("settings").put("operation","video").put("model",selected.endpointId()).put("durationSec",cfg.duration())
                .put("aspectRatio",cfg.ratio()).put("count",1);
        settings.putObject("video").put("mode",mode.mode()).put("resolutionTier",cfg.tier()).put("optimize",optimize(kind,!Boolean.FALSE.equals(cfg.optimize())));
        ArrayNode refs=settings.putArray("referenceBindings");
        refs.addObject().put("depth".equals(kind)?"stepId":"nodeId","depth".equals(kind)?"depth":sourceNodeId).put("role","reference-video").put("order",0);
        Set<String> seen=new HashSet<>(context);
        for(var material:cfg.materials()) {
            if(material==null||material.nodeId()==null||!seen.add(material.nodeId()))throw bad("替换素材重复或已变化，请重新选择");
            JsonNode node=IpDocs.node(doc,material.nodeId());String key=node==null?null:IpDocs.primaryStorageKey(node);
            boolean audio="voice".equals(material.slot());
            if(!Set.of("image","character","voice").contains(Objects.toString(material.slot(),""))||key==null||!(audio?"audio":"image").equals(node.path("type").asText()))throw bad("替换素材类型不正确，请重新选择");
            projects.requireOwnedAssetKey(user,key);context.add(material.nodeId());
            refs.addObject().put("nodeId",material.nodeId()).put("role",audio?"reference-audio":"reference-image").put("order",refs.size());
        }
        return context;
    }
    private static BusinessException bad(String message){return BusinessException.badRequest("STUDIO_INPUT_INVALID",message);}
}
