package com.aistareco.aep.ipstudio.dto;

import java.util.List;
import java.util.Map;

/** Wire names mirror packages/types/src/ip-studio-workflow.ts. */
public final class StudioWorkflowDtos {
    private StudioWorkflowDtos() {}
    public record Reference(String ipId, String avatarId, Integer version, String storageKey, String role, String lookId) {}
    /** Skill / dialogue additions (docs/ip-studio-conversational-video-recreation-plan.md): recreation segment cap, native check target, skill planning binding, dialogue parent binding. */
    public record RecreationSettings(String maxSegmentSec, String videoModel) {}
    /**
     * @param sampling   null：成片均匀抽 4 帧；"shots"：先在成片上找切镜点，每个镜头抽开头和结尾（14 秒 9 个镜头均匀抽 4 帧，多数镜头一帧都看不到）
     * @param references 和成片一起交给检查模型的参考图（这一步交给生成模型的那几张：用户素材、改好的开场画面、原片截图），逐张核对归属
     */
    public record CheckSettings(String targetRunId, String targetStorageKey, List<String> checkIds, String sampling, List<CheckReference> references) {}
    public record CheckReference(String label, String storageKey) {}
    public record DialogueBinding(String threadId, String messageId) {}
    /**
     * 长视频的分段脚本 / 审稿（docs/studio-segmented-video.md）。只由连续制作提交，客户端直接发一律拒绝。
     * kind：script | review；issues：程序查出的硬问题，只有审稿用；refCount：这次有几张编号的参考图。
     */
    public record SegmentedText(String kind, com.aistareco.aep.ipstudio.scene.StudioSceneCatalog.ComposeRequest scene,
                                List<com.aistareco.aep.ipstudio.segmented.SegmentedPlan.Segment> segments, boolean hasScript, boolean singleShot,
                                List<String> issues, int refCount) {}
    public record RunRequest(String clientRequestId, String nodeId, String operation, String prompt,
                             List<Reference> references, String model, String size, Integer durationSec,
                             String aspectRatio, Integer count, ScriptSettings settings, Integer episodeNo,
                             String mode, List<String> contextNodeIds, List<Turn> history, Long maxCost, Packaging packaging, VideoSettings video, Boolean readVisuals, ScriptEdit scriptEdit, TextEdit textEdit, com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing,
                             RecreationSettings recreation, CheckSettings check, String skillKey, Integer skillVersion, String stage, String executionId, DialogueBinding dialogue,
                             EditTimeline edit,com.aistareco.aep.billing.service.ModelBillingApproval modelBilling,
                             com.aistareco.aep.ipstudio.scene.StudioSceneCatalog.ComposeRequest scene,
                             SegmentedText segmented) {
        /** Before the long-video script input (docs/studio-segmented-video.md). */
        public RunRequest(String clientRequestId, String nodeId, String operation, String prompt,
                             List<Reference> references, String model, String size, Integer durationSec,
                             String aspectRatio, Integer count, ScriptSettings settings, Integer episodeNo,
                             String mode, List<String> contextNodeIds, List<Turn> history, Long maxCost, Packaging packaging, VideoSettings video, Boolean readVisuals, ScriptEdit scriptEdit, TextEdit textEdit, com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing,
                             RecreationSettings recreation, CheckSettings check, String skillKey, Integer skillVersion, String stage, String executionId, DialogueBinding dialogue,
                             EditTimeline edit,com.aistareco.aep.billing.service.ModelBillingApproval modelBilling,
                             com.aistareco.aep.ipstudio.scene.StudioSceneCatalog.ComposeRequest scene) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,video,readVisuals,scriptEdit,textEdit,billing,recreation,check,skillKey,skillVersion,stage,executionId,dialogue,edit,modelBilling,scene,null);
        }
        /** The same request as a long-video script step of an execution. */
        public RunRequest withSegmented(SegmentedText input,Boolean visuals) {
            return new RunRequest(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,video,visuals,scriptEdit,textEdit,billing,recreation,check,skillKey,skillVersion,stage,executionId,dialogue,edit,modelBilling,scene,input);
        }
        /** 31-arg shape before the AI 视频编导 scene input (docs/studio-prompt-architecture.md §5.1, 2026-11-01). */
        public RunRequest(String clientRequestId, String nodeId, String operation, String prompt,
                             List<Reference> references, String model, String size, Integer durationSec,
                             String aspectRatio, Integer count, ScriptSettings settings, Integer episodeNo,
                             String mode, List<String> contextNodeIds, List<Turn> history, Long maxCost, Packaging packaging, VideoSettings video, Boolean readVisuals, ScriptEdit scriptEdit, TextEdit textEdit, com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing,
                             RecreationSettings recreation, CheckSettings check, String skillKey, Integer skillVersion, String stage, String executionId, DialogueBinding dialogue,
                             EditTimeline edit,com.aistareco.aep.billing.service.ModelBillingApproval modelBilling) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,video,readVisuals,scriptEdit,textEdit,billing,recreation,check,skillKey,skillVersion,stage,executionId,dialogue,edit,modelBilling,null);
        }
        public RunRequest(String clientRequestId, String nodeId, String operation, String prompt,
                             List<Reference> references, String model, String size, Integer durationSec,
                             String aspectRatio, Integer count, ScriptSettings settings, Integer episodeNo,
                             String mode, List<String> contextNodeIds, List<Turn> history, Long maxCost, Packaging packaging, VideoSettings video, Boolean readVisuals, ScriptEdit scriptEdit, TextEdit textEdit, com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing,
                             RecreationSettings recreation, CheckSettings check, String skillKey, Integer skillVersion, String stage, String executionId, DialogueBinding dialogue,
                             EditTimeline edit) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,video,readVisuals,scriptEdit,textEdit,billing,recreation,check,skillKey,skillVersion,stage,executionId,dialogue,edit,null);
        }

        /** 29-arg shape before 成片高级编辑 (2026-10-19). */
        public RunRequest(String clientRequestId, String nodeId, String operation, String prompt,
                          List<Reference> references, String model, String size, Integer durationSec,
                          String aspectRatio, Integer count, ScriptSettings settings, Integer episodeNo,
                          String mode, List<String> contextNodeIds, List<Turn> history, Long maxCost, Packaging packaging, VideoSettings video, Boolean readVisuals, ScriptEdit scriptEdit, TextEdit textEdit, com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing,
                          RecreationSettings recreation, CheckSettings check, String skillKey, Integer skillVersion, String stage, String executionId, DialogueBinding dialogue) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,video,readVisuals,scriptEdit,textEdit,billing,recreation,check,skillKey,skillVersion,stage,executionId,dialogue,null);
        }
        /** Legacy 22-arg canonical shape (all requests before the skill additions). */
        public RunRequest(String clientRequestId, String nodeId, String operation, String prompt,
                          List<Reference> references, String model, String size, Integer durationSec,
                          String aspectRatio, Integer count, ScriptSettings settings, Integer episodeNo,
                          String mode, List<String> contextNodeIds, List<Turn> history, Long maxCost, Packaging packaging, VideoSettings video, Boolean readVisuals, ScriptEdit scriptEdit, TextEdit textEdit, com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,video,readVisuals,scriptEdit,textEdit,billing,null,null,null,null,null,null,null);
        }
        public RunRequest(String clientRequestId,String nodeId,String operation,String prompt,List<Reference> references,String model,
                          String size,Integer durationSec,String aspectRatio,Integer count,ScriptSettings settings,Integer episodeNo,
                          String mode,List<String> contextNodeIds,List<Turn> history,Long maxCost,Packaging packaging,VideoSettings video,Boolean readVisuals,ScriptEdit scriptEdit,TextEdit textEdit) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,video,readVisuals,scriptEdit,textEdit,null);
        }
        public RunRequest(String clientRequestId,String nodeId,String operation,String prompt,List<Reference> references,String model,
                          String size,Integer durationSec,String aspectRatio,Integer count,ScriptSettings settings,Integer episodeNo,
                          String mode,List<String> contextNodeIds,List<Turn> history,Long maxCost,Packaging packaging,VideoSettings video,Boolean readVisuals,ScriptEdit scriptEdit) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,video,readVisuals,scriptEdit,null);
        }
        public RunRequest(String clientRequestId,String nodeId,String operation,String prompt,List<Reference> references,String model,
                          String size,Integer durationSec,String aspectRatio,Integer count,ScriptSettings settings,Integer episodeNo,
                          String mode,List<String> contextNodeIds,List<Turn> history,Long maxCost,Packaging packaging,VideoSettings video,Boolean readVisuals) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,video,readVisuals,null);
        }
        public RunRequest(String clientRequestId,String nodeId,String operation,String prompt,List<Reference> references,String model,
                          String size,Integer durationSec,String aspectRatio,Integer count,ScriptSettings settings,Integer episodeNo,
                          String mode,List<String> contextNodeIds,List<Turn> history,Long maxCost,Packaging packaging,VideoSettings video) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,video,null);
        }
        public RunRequest(String clientRequestId,String nodeId,String operation,String prompt,List<Reference> references,String model,
                          String size,Integer durationSec,String aspectRatio,Integer count,ScriptSettings settings,Integer episodeNo,
                          String mode,List<String> contextNodeIds,List<Turn> history,Long maxCost,Packaging packaging) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,settings,episodeNo,mode,contextNodeIds,history,maxCost,packaging,null);
        }
        public RunRequest(String clientRequestId,String nodeId,String operation,String prompt,List<Reference> references,String model,
                          String size,Integer durationSec,String aspectRatio,Integer count) {
            this(clientRequestId,nodeId,operation,prompt,references,model,size,durationSec,aspectRatio,count,null,null,null,null,null,null,null);
        }
    }
    public record ScriptEdit(String markdown) {}
    public record TextEdit(String content) {}
    /** optimizePrompt：false = 「按原文生成」，不让厂商在出片前改写描述；null = 模型默认（H3 默认改写）。 */
    /**
     * rewrite（2026-10-27，只对出片前能改写描述的模型，即 H3）：提交前先按 H3 官方写法把提示词改写成英文。
     * auto = 改写完直接出片（创作助手）；review = 没有提示就直接出片，有提示停下来让用户选用优化稿还是原文（画布）。
     * 带 rewrite 时厂商自己的改写一律关掉（optimizePrompt=false）。
     */
    /** {@code edit}：编辑参考视频而不是照它重新生成（元素替换）；只有所选模式配了 edit 的模型能用，见 VideoStudioEditSpec。 */
    public record VideoSettings(String mode,String resolutionTier,Long seed,String firstFrameKey,String lastFrameKey,
            List<com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput> references,Boolean optimizePrompt,String rewrite,Boolean edit) {
        public VideoSettings(String mode,String resolutionTier,Long seed,String firstFrameKey,String lastFrameKey,
                List<com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput> references,Boolean optimizePrompt,String rewrite) {
            this(mode,resolutionTier,seed,firstFrameKey,lastFrameKey,references,optimizePrompt,rewrite,null);
        }
        public VideoSettings(String mode,String resolutionTier,Long seed,String firstFrameKey,String lastFrameKey,
                List<com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput> references,Boolean optimizePrompt) {
            this(mode,resolutionTier,seed,firstFrameKey,lastFrameKey,references,optimizePrompt,null);
        }
        public VideoSettings(String mode,String resolutionTier,Long seed,String firstFrameKey,String lastFrameKey,
                List<com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput> references) {
            this(mode,resolutionTier,seed,firstFrameKey,lastFrameKey,references,null,null);
        }
        /** 交给视频模型时的设置：改写已做完，厂商不再改写。 */
        public VideoSettings submitted() {
            return rewrite==null?this:new VideoSettings(mode,resolutionTier,seed,firstFrameKey,lastFrameKey,references,Boolean.FALSE,null,edit);
        }
        public boolean edits() {
            return Boolean.TRUE.equals(edit);
        }
    }
    public record Caption(Double start,Double end,String text) {}
    /**
     * 成片高级编辑的时间线（2026-10-19）：前端把编辑器里的工程压成这几样交给服务端用 FFmpeg 合成。
     * 时间都是成片里的秒；from 是素材里的起点（掐头）；x / y 是相对画面中心的像素偏移。
     */
    public record EditTimeline(Integer width, Integer height, List<EditMedia> clips, List<EditMedia> audios, List<EditText> texts, List<EditCaption> captions,
                               List<EditOverlay> overlays, Boolean autoCaptions, String musicStorageKey) {
        public EditTimeline(Integer width, Integer height, List<EditMedia> clips, List<EditMedia> audios, List<EditText> texts, List<EditCaption> captions) {
            this(width, height, clips, audios, texts, captions, null, null, null);
        }
        public EditTimeline(Integer width, Integer height, List<EditMedia> clips, List<EditMedia> audios, List<EditText> texts, List<EditCaption> captions, List<EditOverlay> overlays, Boolean autoCaptions) {
            this(width, height, clips, audios, texts, captions, overlays, autoCaptions, null);
        }
    }
    /** speed：播放速度（0.5–2，缺省 1）；fadeIn / fadeOut：开头、结尾淡入淡出的秒数；look：调色预设（见 StudioEditGraph.LOOKS）。 */
    public record EditMedia(String storageKey, Double start, Double end, Double from, Double volume, Double speed, Double fadeIn, Double fadeOut, String look) {
        public EditMedia(String storageKey, Double start, Double end, Double from, Double volume) { this(storageKey, start, end, from, volume, null, null, null, null); }
    }
    /** 画中画或贴图：kind = video | image；x / y 是相对画面中心的偏移（像素），width / height 是显示尺寸。 */
    public record EditOverlay(String kind, String storageKey, Double start, Double end, Double from, Double x, Double y, Double width, Double height, Double volume, Double speed) {}
    public record EditText(String text, Double start, Double end, Double x, Double y, Integer fontSize, String color) {}
    public record EditCaption(String text, Double start, Double end) {}
    /** 已知台词（导演台等）：start / end 是这句话在片段里的预计时间（秒），实际时间由语音识别校正。 */
    public record KnownLine(String text,Double start,Double end) {}
    public record KnownClip(Double plannedSec,List<KnownLine> lines) {}
    /**
     * 成片包装。autoCaptions = true 且没有手写 captions 时，合成阶段自动生成字幕（有 knownClips 用已知台词，否则从声音识别）；
     * musicStorageKey：背景音乐，说话时自动压低；quality：720p | 1080p，缺省跟随片段。
     */
    public record Packaging(String brand,String title,String cta,List<Caption> captions,String voiceoverStorageKey,
                            Boolean autoCaptions,List<KnownClip> knownClips,String musicStorageKey,String quality) {
        public Packaging(String brand,String title,String cta,List<Caption> captions){this(brand,title,cta,captions,null);}
        public Packaging(String brand,String title,String cta,List<Caption> captions,String voiceoverStorageKey){this(brand,title,cta,captions,voiceoverStorageKey,null,null,null,null);}
    }
    public record ScriptSettings(String genre,String audience,String era,String core,String style,Integer episodeCount,Integer episodeDurationSec,
                                 List<String> fusionGenres,String characterBrief,String structure) {}
    public record Turn(String role,String content) {}
    public record ProductAsset(String id,String name,String description,String storageKey,String url,String status) {}
    public record VoiceAsset(String id,String name,String avatarId,String status,String demoUrl) {}
    public record PerformerAsset(String avatarId,String ipId,String name,boolean imageReady,String driverStatus,String voiceId) {}
    public record AssetCatalog(List<ProductAsset> products,List<PerformerAsset> performers,List<VoiceAsset> voices,boolean voiceEngineReady,boolean videoLipSyncReady) {}
    public record TextModel(String endpointId,String name,boolean isDefault,boolean supportsVision,Long creditCost, com.aistareco.aep.service.AiChatTokenPricing.Rate tokenPricing,
                            boolean supportsTools,boolean supportsStreaming,com.aistareco.aep.service.AiChatTokenPricing.Rate dialogueTokenPricing) {
        public TextModel(String endpointId,String name,boolean isDefault,boolean supportsVision,Long creditCost,com.aistareco.aep.service.AiChatTokenPricing.Rate tokenPricing){
            this(endpointId,name,isDefault,supportsVision,creditCost,tokenPricing,false,false,null);
        }
        public TextModel(String endpointId,String name,boolean isDefault,boolean supportsVision,Long creditCost){this(endpointId,name,isDefault,supportsVision,creditCost,null);}
    }
    public record Capabilities(boolean mock, List<String> operations, long imageCost, long textCost, Long videoCost,List<TextModel> textModels,String textModelMode,String imageModelMode,boolean captionRecognition) {
        public Capabilities(boolean mock, List<String> operations, long imageCost, long textCost, Long videoCost,List<TextModel> textModels,String textModelMode,String imageModelMode) {
            this(mock,operations,imageCost,textCost,videoCost,textModels,textModelMode,imageModelMode,false);
        }
    }
    public record AdoptRequest(String nodeId, String storageKey, String name, String ipId, String avatarId,
                               String description, String intent, String assetRole) {
        public AdoptRequest(String nodeId,String storageKey,String name,String ipId,String avatarId,String description,String intent) {
            this(nodeId,storageKey,name,ipId,avatarId,description,intent,null);
        }
    }
    public record AdoptResult(String ipId, String avatarId, int version, String storageKey, String lookId) {}
    public record IpAsset(String ipId, String avatarId, int version, String storageKey, String name, String url, boolean current, String lookId,
                          String characterName,String path,String assetRole,String description,Map<String,String> attributes,String librarySource,
                          /** 官方形象的使用方式：free 免费可用于生成 / license 需授权（不能选）；我的 IP 为 null。 */
                          String access,
                          /** 官方形象分类（pro / life / ugc / community），供选择框筛选；其余为 null。 */
                          String category) {
        public IpAsset(String ipId,String avatarId,int version,String storageKey,String name,String url,boolean current,String lookId,
                       String characterName,String path,String assetRole,String description,Map<String,String> attributes,String librarySource) {
            this(ipId,avatarId,version,storageKey,name,url,current,lookId,characterName,path,assetRole,description,attributes,librarySource,null,null);
        }
        public IpAsset(String ipId,String avatarId,int version,String storageKey,String name,String url,boolean current,String lookId,
                       String characterName,String path,String assetRole,String description,Map<String,String> attributes) {
            this(ipId,avatarId,version,storageKey,name,url,current,lookId,characterName,path,assetRole,description,attributes,"mine");
        }
        public IpAsset(String ipId,String avatarId,int version,String storageKey,String name,String url,boolean current,String lookId) {
            this(ipId,avatarId,version,storageKey,name,url,current,lookId,name,null,null,null,Map.of());
        }
    }
    public record AssetRoleRequest(String assetRole) {}
}
