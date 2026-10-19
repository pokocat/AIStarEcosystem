package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.Step;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import java.util.List;

/** Template adapter: native video contracts/prices stay in the existing video services. */
@Service
public class StudioTemplateVideoService {
    private final AiAppSceneModelPolicyService scenePolicies;
    private final MaterialVideoJobService jobs;
    private final StudioVideoService nativeVideos;
    public StudioTemplateVideoService(AiAppSceneModelPolicyService scenePolicies,MaterialVideoJobService jobs,StudioVideoService nativeVideos) {
        this.scenePolicies=scenePolicies;this.jobs=jobs;this.nativeVideos=nativeVideos;
    }
    public record Quote(String model,long cost,boolean nativeMode) {}
    public Quote quote(String owner,Step step,String requestedModel,String prompt) {
        var endpoint=scenePolicies.resolveStudioVideo(requestedModel);
        String model=endpoint.endpoint().getId();
        VideoStudioModel nativeModel=nativeVideos.models().stream().filter(m->m.endpointId().equals(model)).findFirst().orElse(null);
        boolean nativeMode=nativeModel!=null;
        long cost;
        if(nativeMode) {
            // The keys here are recipe IDs for count/slot validation, never a media-access claim.
            var video=settings(step,step.references(),nativeModel);
            cost=nativeVideos.quote(owner,new IpRunService.IpVideoRequest(prompt,null,step.durationSec(),step.aspectRatio(),model,null,video));
        } else {
            if(step.video()!=null || step.references().size()>1)throw BusinessException.badRequest("STUDIO_TEMPLATE_VIDEO_MODE_UNAVAILABLE","所选模型只支持文生或一张首帧图，请更换模型或调整模板的视频模式");
            if(!List.of("9:16","16:9","1:1").contains(step.aspectRatio()))throw BusinessException.badRequest("STUDIO_RATIO_INVALID","所选视频模型仅支持竖屏、横屏或方形");
            cost=jobs.quote(model,step.durationSec(),"studio");
        }
        return new Quote(model,cost,nativeMode);
    }
    public VideoSettings settings(Step step,List<String> keys,String modelId) {
        VideoStudioModel model=nativeVideos.models().stream().filter(m->m.endpointId().equals(modelId)).findFirst()
                .orElseThrow(()->BusinessException.badRequest("STUDIO_TEMPLATE_VIDEO_MODE_INVALID","所选视频模型已不可用"));
        return settings(step,keys,model);
    }
    private VideoSettings settings(Step step,List<String> keys,VideoStudioModel model) {
        var contract=model.contract();
        var spec=step.video();
        VideoStudioModeSpec mode=spec==null?contract.modes().stream()
                .filter(m->{
                    int frames=(m.needsFirstFrame()?1:0)+(m.needsLastFrame()?1:0);
                    return m.references()==null?keys.size()==frames:keys.size()>=frames;
                }).findFirst().orElse(null):contract.modes().stream().filter(m->m.mode().equals(spec.mode())).findFirst().orElse(null);
        if(mode==null)throw BusinessException.badRequest("STUDIO_TEMPLATE_VIDEO_MODE_INVALID","所选模型不支持模板的视频模式或引用数量");
        String tier=spec==null?contract.tiers().get(0).tier():spec.resolutionTier();
        Long seed=spec==null?null:spec.seed();
        int index=0;
        String first=mode.needsFirstFrame()&&index<keys.size()?keys.get(index++):null;
        String last=mode.needsLastFrame()&&index<keys.size()?keys.get(index++):null;
        if(mode.references()==null&&index!=keys.size())throw BusinessException.badRequest("STUDIO_TEMPLATE_VIDEO_MODE_INVALID","视频模式与引用数量不一致");
        List<VideoStudioReferenceInput> references=mode.references()==null?List.of():keys.subList(index,keys.size()).stream()
                .map(key->new VideoStudioReferenceInput("image",key)).toList();
        return new VideoSettings(mode.mode(),tier,seed,first,last,references);
    }
}
