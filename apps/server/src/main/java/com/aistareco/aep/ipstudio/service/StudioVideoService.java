package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.MediaBytes;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import java.nio.file.Files;
import java.util.List;

/** Native video inputs on the canvas. Preparation never calls a provider or freezes credits. */
@Service
public class StudioVideoService {
    private final com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies;
    private final VideoStudioService videos;
    private final IpProjectService projects;
    private final FileStorageService storage;
    private final FfmpegRunner ffmpeg;
    public StudioVideoService(com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies,VideoStudioService videos,IpProjectService projects,FileStorageService storage,FfmpegRunner ffmpeg) {
        this.scenePolicies=scenePolicies;this.videos=videos;this.projects=projects;this.storage=storage;this.ffmpeg=ffmpeg;
    }
    public List<VideoStudioModel> models() {
        var allowed=scenePolicies.studioVideoCandidates().stream()
                .collect(java.util.stream.Collectors.toMap(r->r.endpoint().getId(),r->r));
        return videos.listModels("studio").stream().filter(m->allowed.containsKey(m.endpointId()))
                .map(m->new VideoStudioModel(m.endpointId(),m.name(),allowed.get(m.endpointId()).isDefault(),
                        m.selectableById(),m.supportsPromptOptimization(),m.contract(),m.pricing(),m.batchCounts())).toList();
    }
    private String model(String requested) {return scenePolicies.resolveStudioVideo(requested).endpoint().getId();}
    public VideoStudioService.CanvasPreparation prepare(String userId,IpRunService.IpVideoRequest request) {
        var v=request.video();
        String endpointId=model(request.model());
        var nativeRequest=new VideoStudioJobRequest(endpointId,v.mode(),request.prompt(),v.resolutionTier(),
                request.aspectRatio(),request.durationSec(),v.seed(),v.firstFrameKey(),v.lastFrameKey(),v.references(),null,null);
        VideoStudioModel model=models().stream().filter(m->endpointId.equals(m.endpointId())).findFirst()
                .orElseThrow(()->invalid("所选模型不支持该视频模式"));
        VideoStudioModeSpec modeSpec=model.contract().modes().stream().filter(m->m.mode().equals(v.mode()))
                .findFirst().orElseThrow(()->invalid("所选模型不支持该视频模式"));
        // 「按原文生成」只对出片前会改写描述的模型有意义（同视频生成区的「智能优化」能力判定）；别的模型带着它就明确拒绝。
        if(v.optimizePrompt()!=null && !model.supportsPromptOptimization())
            throw BusinessException.badRequest("STUDIO_VIDEO_OPTION_UNSUPPORTED","所选视频模型不会改写描述，不需要选择「按原文生成」");
        var prepared=videos.prepareCanvas(userId,nativeRequest,
                (type,key,frame)->requireMedia(userId,type,key,frame,modeSpec),"studio");
        return v.optimizePrompt()==null?prepared
                :new VideoStudioService.CanvasPreparation(prepared.spec().withOptimizePrompt(v.optimizePrompt()),prepared.credits(),prepared.seedMax());
    }
    /** Quote a recipe's declared geometry/mode/count before dependency outputs exist.
     * Asset bytes and ownership are verified by prepare() at actual submission, never bypassed there. */
    public long quote(String userId,IpRunService.IpVideoRequest request) {
        var v=request.video();
        var nativeRequest=new VideoStudioJobRequest(model(request.model()),v.mode(),request.prompt(),v.resolutionTier(),
                request.aspectRatio(),request.durationSec(),v.seed(),v.firstFrameKey(),v.lastFrameKey(),v.references(),null,null);
        return videos.prepareCanvas(userId,nativeRequest,(type,key,frame)->{},"studio").credits();
    }
    void requireMedia(String userId,String type,String key,boolean frame,VideoStudioModeSpec mode) {
        projects.requireOwnedAssetKey(userId,key);
        try {
            var path=storage.openForRead(key);
            VideoStudioMediaLimit media=frame?mode.frameImage():mode.references()==null?null:switch(type){
                case "image" -> mode.references().image();
                case "video" -> mode.references().video();
                case "audio" -> mode.references().audio();
                default -> null;
            };
            if(media==null || !type.equals(media.mediaType()))throw invalid("所选模式不支持该素材类型");
            long bytes=Files.size(path);
            if(bytes<=0 || bytes>media.maxBytes())throw invalid("参考素材为空或超过该模式的文件大小限制");
            byte[] header;
            try(var in=Files.newInputStream(path)){header=in.readNBytes(4096);}
            var format=MediaBytes.sniffConfigured(type,header);
            if(!MediaBytes.allowed(format,media.formats()))
                throw invalid("参考素材的实际格式不符合所选用途，请选择正确的图片、视频或音频");
            if(!"image".equals(type)) {
                var probe=ffmpeg.probeMedia(path.toFile());
                if(!probe.readable() || "video".equals(type)&&!probe.hasVideo() || "audio".equals(type)&&!probe.hasAudio())
                    throw invalid("有一份参考素材读不出来，请重新选择");
                if((media.minDurationSec()!=null || media.maxDurationSec()!=null)
                        && (probe.durationSec()<=0
                        || media.minDurationSec()!=null && probe.durationSec()<media.minDurationSec()
                        || media.maxDurationSec()!=null && probe.durationSec()>media.maxDurationSec()))
                    throw invalid("参考"+("video".equals(type)?"视频":"音频")+"时长不符合所选模型要求");
            }
        } catch(BusinessException e){throw e;} catch(Exception e){throw invalid("参考素材已不可用，请重新上传或选择");}
    }
    private static BusinessException invalid(String message){return BusinessException.badRequest("STUDIO_VIDEO_ASSET_INVALID",message);}
}
