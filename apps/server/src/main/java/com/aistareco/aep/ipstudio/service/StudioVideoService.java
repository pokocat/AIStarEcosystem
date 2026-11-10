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
    private final StudioAudioReference audioReferences;
    public StudioVideoService(com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies,VideoStudioService videos,IpProjectService projects,FileStorageService storage,FfmpegRunner ffmpeg) {
        this.scenePolicies=scenePolicies;this.videos=videos;this.projects=projects;this.storage=storage;this.ffmpeg=ffmpeg;
        this.audioReferences=new StudioAudioReference(storage,ffmpeg);
    }
    public List<VideoStudioModel> models() {
        var allowed=scenePolicies.studioVideoCandidates().stream()
                .collect(java.util.stream.Collectors.toMap(r->r.endpoint().getId(),r->r));
        return videos.listModels("studio").stream().filter(m->allowed.containsKey(m.endpointId()))
                .map(m->new VideoStudioModel(m.endpointId(),m.name(),allowed.get(m.endpointId()).isDefault(),
                        m.selectableById(),m.supportsPromptOptimization(),m.contract(),m.pricing(),m.batchCounts())).toList();
    }
    private String model(String requested) {return scenePolicies.resolveStudioVideo(requested).endpoint().getId();}
    /** 所选模型出片前会不会改写描述（H3）：只有这种模型才走 H3 官方写法的提示词优化。 */
    public boolean rewritable(String requested) {
        String endpointId=model(requested);
        return models().stream().anyMatch(m->endpointId.equals(m.endpointId())&&m.supportsPromptOptimization());
    }
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
        VideoStudioModel model=videoModel(endpointId);
        VideoStudioModeSpec modeSpec=modeSpec(model,v.mode());
        // 「按原文生成」只对出片前会改写描述的模型有意义（同视频生成区的「智能优化」能力判定）；别的模型带着它就明确拒绝。
        if(v.optimizePrompt()!=null && !model.supportsPromptOptimization())
            throw BusinessException.badRequest("STUDIO_VIDEO_OPTION_UNSUPPORTED","所选视频模型不会改写描述，不需要选择「按原文生成」");
        var references=prepareAudioReferences(userId,v.references());
        var nativeRequest=new VideoStudioJobRequest(endpointId,v.mode(),request.prompt(),v.resolutionTier(),
                request.aspectRatio(),request.durationSec(),v.seed(),first.key(),last.key(),references,null,null,null,null);
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
                    "首帧图无法读取，无法按 "+aspectRatio.strip()+" 裁剪。请更换 PNG 或 JPG 图片，或将画幅改为与首帧图一致");
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
    /** AI 视频页按钮旁的价：和 {@link #quote} 同一张价表与合同校验，素材只给各类型的张数（见 {@link VideoStudioService#priceCanvas}）。 */
    public VideoStudioService.CanvasPreparation price(String endpointId,String mode,String tier,String aspectRatio,Integer seconds,int imageRefs,int videoRefs,int audioRefs) {
        return videos.priceCanvas(endpointId,mode,tier,aspectRatio,seconds,imageRefs,videoRefs,audioRefs,"studio");
    }
    /**
     * 制作计划的报价：这时素材还没有（占位 key，见 StudioPlanQuoter），按张数走同一张价表，不查文件。
     * 素材的归属和内容在真正提交时由 {@link #prepare} 查。此前也走 {@link #quote}，占位 key 过不了归属校验，带参考素材的计划报不出价（2026-11-05 本地真跑发现）。
     */
    public long planPrice(String requested,com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings video,String aspectRatio,Integer seconds) {
        int images=0,clips=0,audios=0;
        if(video.references()!=null)for(var ref:video.references())
            switch(ref.mediaType()==null?"image":ref.mediaType()){case "video" -> clips++;case "audio" -> audios++;default -> images++;}
        return price(model(requested),video.mode(),video.resolutionTier(),aspectRatio,seconds,images,clips,audios).credits();
    }
    public long quote(String userId,IpRunService.IpVideoRequest request) {return quotePreparation(userId,request).credits();}
    /**
     * 报价，同时按所选模型的规则核对每份素材（格式、大小、参考视频和声音的时长）—— 和出片时 {@link #prepare} 同一套 {@link #requireMedia}。
     * 先优化提示词再出片的那一行在受理时用它：素材不合规当场报错，不等优化做完、交给视频时才发现（参考视频超过 15 秒那次用户白等了约 30 秒）。
     */
    public long quoteChecked(String userId,IpRunService.IpVideoRequest request) {
        var v=request.video();
        String endpointId=model(request.model());
        VideoStudioModeSpec modeSpec=modeSpec(videoModel(endpointId),v.mode());
        var nativeRequest=new VideoStudioJobRequest(endpointId,v.mode(),request.prompt(),v.resolutionTier(),
                request.aspectRatio(),request.durationSec(),v.seed(),v.firstFrameKey(),v.lastFrameKey(),prepareAudioReferences(userId,v.references()),null,null,null,null);
        return videos.prepareCanvas(userId,nativeRequest,(type,key,frame)->requireMedia(userId,type,key,frame,modeSpec),"studio").credits();
    }
    private VideoStudioModel videoModel(String endpointId) {
        return models().stream().filter(m->endpointId.equals(m.endpointId())).findFirst()
                .orElseThrow(()->invalid("所选模型不支持该视频模式"));
    }
    private static VideoStudioModeSpec modeSpec(VideoStudioModel model,String mode) {
        return model.contract().modes().stream().filter(m->m.mode().equals(mode))
                .findFirst().orElseThrow(()->invalid("所选模型不支持该视频模式"));
    }
    public VideoStudioService.CanvasPreparation quotePreparation(String userId,IpRunService.IpVideoRequest request) {
        var v=request.video();
        var nativeRequest=new VideoStudioJobRequest(model(request.model()),v.mode(),request.prompt(),v.resolutionTier(),
                request.aspectRatio(),request.durationSec(),v.seed(),v.firstFrameKey(),v.lastFrameKey(),prepareAudioReferences(userId,v.references()),null,null,null,null);
        return videos.prepareCanvas(userId,nativeRequest,(type,key,frame)->projects.requireOwnedAssetKey(userId,key),"studio");
    }
    /** Quotes and submits share derived keys, so total-duration checks see the samples actually sent. */
    List<VideoStudioReferenceInput> prepareAudioReferences(String userId,List<VideoStudioReferenceInput> inputs) {
        if(inputs==null)return null;
        var samples=new java.util.HashMap<String,String>();
        return inputs.stream().map(ref->{
            if(ref==null || !"audio".equals(ref.mediaType()))return ref;
            String owned=projects.requireOwnedAssetKey(userId,ref.key());
            String key=samples.computeIfAbsent(owned,k->audioReferences.prepare(userId,k).key());
            return new VideoStudioReferenceInput("audio",key);
        }).toList();
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
            String label=com.aistareco.aep.videostudio.service.VideoMediaMessages.kind(type);
            if(media==null || !type.equals(media.mediaType()))throw invalid("当前模型的这种生成方式不能使用"+label+"，请移除后再试");
            long bytes=Files.size(path);
            if(bytes<=0)throw invalid(com.aistareco.aep.videostudio.service.VideoMediaMessages.empty(label));
            if(bytes>media.maxBytes())throw invalid(com.aistareco.aep.videostudio.service.VideoMediaMessages.tooLarge(label,media.maxBytes()));
            byte[] header;
            try(var in=Files.newInputStream(path)){header=in.readNBytes(4096);}
            var format=MediaBytes.sniffConfigured(type,header);
            if(!MediaBytes.allowed(format,media.formats()))
                throw invalid(com.aistareco.aep.videostudio.service.VideoMediaMessages.format(label,media.formats()));
            if(!"image".equals(type)) {
                var probe=ffmpeg.probeMedia(path.toFile());
                if(!probe.readable() || "video".equals(type)&&!probe.hasVideo() || "audio".equals(type)&&!probe.hasAudio())
                    throw invalid(label+"无法读取，请重新选择");
                if((media.minDurationSec()!=null || media.maxDurationSec()!=null)
                        && (probe.durationSec()<=0
                        || media.minDurationSec()!=null && probe.durationSec()<media.minDurationSec()
                        || media.maxDurationSec()!=null && probe.durationSec()>media.maxDurationSec()))
                    throw invalid(com.aistareco.aep.videostudio.service.VideoMediaMessages.duration(label,probe.durationSec(),media.minDurationSec(),media.maxDurationSec()));
            }
        } catch(BusinessException e){throw e;} catch(Exception e){throw invalid("参考素材已不可用，请重新上传或选择");}
    }
    private static BusinessException invalid(String message){return BusinessException.badRequest("STUDIO_VIDEO_ASSET_INVALID",message);}
}
