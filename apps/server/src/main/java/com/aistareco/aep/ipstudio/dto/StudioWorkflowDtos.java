package com.aistareco.aep.ipstudio.dto;

import java.util.List;
import java.util.Map;

/** Wire names mirror packages/types/src/ip-studio-workflow.ts. */
public final class StudioWorkflowDtos {
    private StudioWorkflowDtos() {}
    public record Reference(String ipId, String avatarId, Integer version, String storageKey, String role, String lookId) {}
    /** Skill / dialogue additions (docs/ip-studio-conversational-video-recreation-plan.md): recreation segment cap, native check target, skill planning binding, dialogue parent binding. */
    public record RecreationSettings(String maxSegmentSec, String videoModel) {}
    public record CheckSettings(String targetRunId, String targetStorageKey, List<String> checkIds) {}
    public record DialogueBinding(String threadId, String messageId) {}
    public record RunRequest(String clientRequestId, String nodeId, String operation, String prompt,
                             List<Reference> references, String model, String size, Integer durationSec,
                             String aspectRatio, Integer count, ScriptSettings settings, Integer episodeNo,
                             String mode, List<String> contextNodeIds, List<Turn> history, Long maxCost, Packaging packaging, VideoSettings video, Boolean readVisuals, ScriptEdit scriptEdit, TextEdit textEdit, com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing,
                             RecreationSettings recreation, CheckSettings check, String skillKey, Integer skillVersion, String stage, String executionId, DialogueBinding dialogue,
                             EditTimeline edit,com.aistareco.aep.billing.service.ModelBillingApproval modelBilling) {
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
    public record VideoSettings(String mode,String resolutionTier,Long seed,String firstFrameKey,String lastFrameKey,
            List<com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput> references,Boolean optimizePrompt,String rewrite) {
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
            return rewrite==null?this:new VideoSettings(mode,resolutionTier,seed,firstFrameKey,lastFrameKey,references,Boolean.FALSE,null);
        }
    }
    public record Caption(Double start,Double end,String text) {}
    /**
     * 成片高级编辑的时间线（2026-10-19）：前端把编辑器里的工程压成这几样交给服务端用 FFmpeg 合成。
     * 时间都是成片里的秒；from 是素材里的起点（掐头）；x / y 是相对画面中心的像素偏移。
     */
    public record EditTimeline(Integer width, Integer height, List<EditMedia> clips, List<EditMedia> audios, List<EditText> texts, List<EditCaption> captions) {}
    public record EditMedia(String storageKey, Double start, Double end, Double from, Double volume) {}
    public record EditText(String text, Double start, Double end, Double x, Double y, Integer fontSize, String color) {}
    public record EditCaption(String text, Double start, Double end) {}
    public record Packaging(String brand,String title,String cta,List<Caption> captions,String voiceoverStorageKey) {
        public Packaging(String brand,String title,String cta,List<Caption> captions){this(brand,title,cta,captions,null);}
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
    public record Capabilities(boolean mock, List<String> operations, long imageCost, long textCost, Long videoCost,List<TextModel> textModels,String textModelMode,String imageModelMode) {}
    public record AdoptRequest(String nodeId, String storageKey, String name, String ipId, String avatarId,
                               String description, String intent, String assetRole) {
        public AdoptRequest(String nodeId,String storageKey,String name,String ipId,String avatarId,String description,String intent) {
            this(nodeId,storageKey,name,ipId,avatarId,description,intent,null);
        }
    }
    public record AdoptResult(String ipId, String avatarId, int version, String storageKey, String lookId) {}
    public record IpAsset(String ipId, String avatarId, int version, String storageKey, String name, String url, boolean current, String lookId,
                          String characterName,String path,String assetRole,String description,Map<String,String> attributes,String librarySource) {
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
