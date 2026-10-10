package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.materialvideo.JusuanH3Contract;
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
    @org.springframework.beans.factory.annotation.Autowired
    private com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies;
    private final VideoStudioService videos;
    private final IpProjectService projects;
    private final FileStorageService storage;
    private final FfmpegRunner ffmpeg;
    public StudioVideoService(VideoStudioService videos,IpProjectService projects,FileStorageService storage,FfmpegRunner ffmpeg) {
        this.videos=videos;this.projects=projects;this.storage=storage;this.ffmpeg=ffmpeg;
    }
    public List<VideoStudioModel> models() {
        if(scenePolicies==null)return videos.listModels();
        var allowed=scenePolicies.studioVideoCandidates().stream().map(r->r.endpoint().getId()).collect(java.util.stream.Collectors.toSet());
        return videos.listModels().stream().filter(m->allowed.contains(m.endpointId())).toList();
    }
    private String model(String requested) {return scenePolicies==null?requested:scenePolicies.resolveStudioVideo(requested).endpoint().getId();}
    public VideoStudioService.CanvasPreparation prepare(String userId,IpRunService.IpVideoRequest request) {
        var v=request.video();
        var nativeRequest=new VideoStudioJobRequest(model(request.model()),v.mode(),request.prompt(),v.resolutionTier(),
                request.aspectRatio(),request.durationSec(),v.seed(),v.firstFrameKey(),v.lastFrameKey(),v.references(),null,null);
        boolean reference=JusuanH3Contract.MODE_UNIVERSAL_REFERENCE.equals(v.mode());
        return videos.prepareCanvas(userId,nativeRequest,(type,key)->requireMedia(userId,type,key,reference));
    }
    /** Quote a recipe's declared geometry/mode/count before dependency outputs exist.
     * Asset bytes and ownership are verified by prepare() at actual submission, never bypassed there. */
    public long quote(String userId,IpRunService.IpVideoRequest request) {
        var v=request.video();
        var nativeRequest=new VideoStudioJobRequest(model(request.model()),v.mode(),request.prompt(),v.resolutionTier(),
                request.aspectRatio(),request.durationSec(),v.seed(),v.firstFrameKey(),v.lastFrameKey(),v.references(),null,null);
        return videos.prepareCanvas(userId,nativeRequest,(type,key)->{}).credits();
    }
    void requireMedia(String userId,String type,String key,boolean reference) {
        projects.requireOwnedAssetKey(userId,key);
        try {
            var path=storage.openForRead(key);
            long limit="image".equals(type)&&!reference?JusuanH3Contract.FRAME_IMAGE_MAX_BYTES:JusuanH3Contract.referenceMaxBytes(type);
            long bytes=Files.size(path);
            if(bytes<=0 || bytes>limit)throw invalid("参考素材为空或超过该模式的文件大小限制");
            byte[] header;
            try(var in=Files.newInputStream(path)){header=in.readNBytes(64);}
            if(MediaBytes.sniff(type,header)==null)throw invalid("参考素材的实际格式不符合所选用途，请选择正确的图片、视频或音频");
            if(!"image".equals(type)) {
                var probe=ffmpeg.probeMedia(path.toFile());
                if(!probe.readable() || "video".equals(type)&&!probe.hasVideo() || "audio".equals(type)&&!probe.hasAudio())
                    throw invalid("有一份参考素材读不出来，请重新选择");
                if("audio".equals(type) && (probe.durationSec()<JusuanH3Contract.AUDIO_MIN_SECONDS || probe.durationSec()>JusuanH3Contract.AUDIO_MAX_SECONDS))
                    throw invalid("每段参考音频需为 2 到 15 秒，请剪短或换一段音频");
            }
        } catch(BusinessException e){throw e;} catch(Exception e){throw invalid("参考素材已不可用，请重新上传或选择");}
    }
    private static BusinessException invalid(String message){return BusinessException.badRequest("STUDIO_VIDEO_ASSET_INVALID",message);}
}
