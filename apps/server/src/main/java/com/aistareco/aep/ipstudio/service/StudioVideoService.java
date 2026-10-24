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
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(StudioVideoService.class);
    private static final com.fasterxml.jackson.databind.ObjectMapper OM=new com.fasterxml.jackson.databind.ObjectMapper();
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
    /**
     * A prepared native submission plus what was done to its frames on the way ({@code firstFrameAdjusted} /
     * {@code lastFrameAdjusted}, empty when nothing): the caller records it in the run's {@code _exec}.
     */
    public record Prepared(VideoStudioService.CanvasPreparation canvas,com.fasterxml.jackson.databind.node.ObjectNode frameAdjustments) {}

    public Prepared prepare(String userId,IpRunService.IpVideoRequest request) {
        var v=request.video();
        String endpointId=model(request.model());
        var adjustments=OM.createObjectNode();
        // §6.2: a frame of another shape is cropped around its centre to the requested 画幅, never handed over to be stretched.
        var first=alignFrame(userId,v.firstFrameKey(),request.aspectRatio());
        var last=alignFrame(userId,v.lastFrameKey(),request.aspectRatio());
        if(first.adjusted()!=null)adjustments.set("firstFrameAdjusted",first.adjusted());
        if(last.adjusted()!=null)adjustments.set("lastFrameAdjusted",last.adjusted());
        var nativeRequest=new VideoStudioJobRequest(endpointId,v.mode(),request.prompt(),v.resolutionTier(),
                request.aspectRatio(),request.durationSec(),v.seed(),first.key(),last.key(),v.references(),null,null);
        VideoStudioModel model=models().stream().filter(m->endpointId.equals(m.endpointId())).findFirst()
                .orElseThrow(()->invalid("所选模型不支持该视频模式"));
        VideoStudioModeSpec modeSpec=model.contract().modes().stream().filter(m->m.mode().equals(v.mode()))
                .findFirst().orElseThrow(()->invalid("所选模型不支持该视频模式"));
        // 「按原文生成」只对出片前会改写描述的模型有意义（同视频生成区的「智能优化」能力判定）；别的模型带着它就明确拒绝。
        if(v.optimizePrompt()!=null && !model.supportsPromptOptimization())
            throw BusinessException.badRequest("STUDIO_VIDEO_OPTION_UNSUPPORTED","所选视频模型不会改写描述，不需要选择「按原文生成」");
        var prepared=videos.prepareCanvas(userId,nativeRequest,
                (type,key,frame)->requireMedia(userId,type,key,frame,modeSpec),"studio");
        return new Prepared(v.optimizePrompt()==null?prepared
                :new VideoStudioService.CanvasPreparation(prepared.spec().withOptimizePrompt(v.optimizePrompt()),prepared.credits(),prepared.seedMax()),adjustments);
    }

    /** The key a frame is sent as, and the record of the crop when one was made (null otherwise). */
    public record FrameAlignment(String key,com.fasterxml.jackson.databind.node.ObjectNode adjusted) {}

    /**
     * A frame whose shape is more than 2% off the requested 画幅 is cropped around its centre to it and stored as the
     * owner's own derived picture; that key goes to the provider. Same shape, no 画幅, or no frame: the key as it is.
     * The owner check comes first, so nobody else's file is ever read. A frame that cannot be read or cropped is a clear
     * error (§8.0), never a silent hand-over that the provider would stretch.
     */
    public FrameAlignment alignFrame(String userId,String key,String aspectRatio) {
        if(key==null||key.isBlank()||!Double.isFinite(StudioFrameCrop.ratio(aspectRatio)))return new FrameAlignment(key,null);
        String owned=projects.requireOwnedAssetKey(userId,key);
        try {
            var path=storage.openForRead(owned);
            int[] size=StudioFrameCrop.dimensions(path);
            byte[] bytes=null;
            if(size==null) {
                // A format the JDK cannot read (WebP): ffmpeg turns it into a PNG first; the provider still gets a crop.
                bytes=decodeWithFfmpeg(path);
                var image=javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(bytes));
                if(image==null)throw new java.io.IOException("unreadable after ffmpeg");
                size=new int[]{image.getWidth(),image.getHeight()};
            }
            if(!StudioFrameCrop.needsCrop(size[0],size[1],aspectRatio))return new FrameAlignment(owned,null);
            var cropped=StudioFrameCrop.crop(bytes!=null?bytes:Files.readAllBytes(path),aspectRatio);
            var stored=storage.store(cropped.bytes(),IpProjectService.CATEGORY_GEN,userId,cropped.ext(),cropped.contentType());
            var record=OM.createObjectNode().put("from",com.aistareco.aep.ipstudio.dialogue.DialogueCanvasDigest.ratioLabel(size[0],size[1]))
                    .put("to",aspectRatio.strip()).put("mode","crop").put("sourceKey",owned).put("croppedKey",stored.key())
                    .put("sourceSize",size[0]+"x"+size[1]).put("croppedSize",cropped.width()+"x"+cropped.height());
            log.info("[studio-video] frame cropped user={} from={} ({}x{}) to={} ({}x{}) source={} cropped={}",userId,record.path("from").asText(),
                    size[0],size[1],aspectRatio,cropped.width(),cropped.height(),owned,stored.key());
            return new FrameAlignment(stored.key(),record);
        } catch(BusinessException e){throw e;}
        catch(Exception e) {
            log.warn("[studio-video] frame crop failed user={} key={} ratio={} reason={}",userId,owned,aspectRatio,e.toString());
            throw BusinessException.badRequest("STUDIO_VIDEO_FRAME_CROP_FAILED",
                    "首帧图读不出来，没法按 "+aspectRatio.strip()+" 裁剪。请换一张 PNG 或 JPG 图片，或把画幅改成和首帧图一致");
        }
    }
    private byte[] decodeWithFfmpeg(java.nio.file.Path source) throws java.io.IOException {
        var out=Files.createTempFile("studio-frame-",".png");
        try {
            ffmpeg.runFfmpeg(List.of("-nostdin","-v","error","-y","-i",source.toString(),"-frames:v","1",out.toString()),30_000);
            return Files.readAllBytes(out);
        } finally {Files.deleteIfExists(out);}
    }
    /** Quote a recipe's declared geometry/mode/count before dependency outputs exist.
     * Asset bytes and ownership are verified by prepare() at actual submission, never bypassed there. */
    /** 没有素材时按模式、清晰度、时长和参考图张数估价，和 {@link #quote} 用同一张价表。 */
    public long estimate(String model,String mode,String tier,int seconds,int referenceImages) {
        return videos.estimateCanvas(model(model),mode,tier,seconds,referenceImages,"studio");
    }
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
