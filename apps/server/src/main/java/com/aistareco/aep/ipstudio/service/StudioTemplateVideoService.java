package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.Step;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.List;

/** Template adapter: native video contracts/prices stay in the existing video services. */
@Service
public class StudioTemplateVideoService {
    private final AiModelInvocationService models;
    private final MaterialVideoJobService jobs;
    private final StudioVideoService nativeVideos;
    public StudioTemplateVideoService(AiModelInvocationService models,MaterialVideoJobService jobs,StudioVideoService nativeVideos) {
        this.models=models;this.jobs=jobs;this.nativeVideos=nativeVideos;
    }
    public record Quote(String model,long cost,boolean nativeMode) {}
    public Quote quote(String owner,Step step,String requestedModel,String prompt) {
        var endpoint=models.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION,requestedModel).orElseThrow(()->
                new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","请选择可用的视频模型"));
        String model=endpoint.endpoint().getId();
        boolean nativeMode=nativeVideos.models().stream().anyMatch(m->m.endpointId().equals(model));
        long cost;
        if(nativeMode) {
            // The keys here are recipe IDs for count/slot validation, never a media-access claim.
            var video=settings(step,step.references());
            cost=nativeVideos.quote(owner,new IpRunService.IpVideoRequest(prompt,null,step.durationSec(),step.aspectRatio(),model,null,video));
        } else {
            if(step.video()!=null || step.references().size()>1)throw BusinessException.badRequest("STUDIO_TEMPLATE_VIDEO_MODE_UNAVAILABLE","所选模型只支持文生或一张首帧图，请更换模型或调整模板的视频模式");
            if(!List.of("9:16","16:9","1:1").contains(step.aspectRatio()))throw BusinessException.badRequest("STUDIO_RATIO_INVALID","所选视频模型仅支持竖屏、横屏或方形");
            cost=jobs.quote(model,step.durationSec());
        }
        return new Quote(model,cost,nativeMode);
    }
    public VideoSettings settings(Step step,List<String> keys) {
        var spec=step.video();String mode=spec==null?(keys.isEmpty()?"t2v":"i2v"):spec.mode();
        String tier=spec==null?"768p":spec.resolutionTier();Long seed=spec==null?null:spec.seed();
        return switch(mode) {
            case "t2v" -> new VideoSettings(mode,tier,seed,null,null,List.of());
            case "i2v" -> new VideoSettings(mode,tier,seed,keys.isEmpty()?null:keys.get(0),null,List.of());
            case "first_last_frame_video" -> new VideoSettings(mode,tier,seed,keys.isEmpty()?null:keys.get(0),keys.size()<2?null:keys.get(1),List.of());
            case "universal_reference_video" -> new VideoSettings(mode,tier,seed,null,null,keys.stream().map(k->new VideoStudioReferenceInput("image",k)).toList());
            default -> throw BusinessException.badRequest("STUDIO_TEMPLATE_VIDEO_MODE_INVALID","请选择模板的视频生成模式");
        };
    }
}
