package com.aistareco.aep.ipstudio.dto;

import java.util.List;
import java.util.Map;

/** Wire names mirror packages/types/src/ip-studio-workflow.ts. */
public final class StudioWorkflowDtos {
    private StudioWorkflowDtos() {}
    public record Reference(String ipId, String avatarId, Integer version, String storageKey, String role, String lookId) {}
    public record RunRequest(String clientRequestId, String nodeId, String operation, String prompt,
                             List<Reference> references, String model, String size, Integer durationSec,
                             String aspectRatio, Integer count, ScriptSettings settings, Integer episodeNo,
                             String mode, List<String> contextNodeIds, List<Turn> history, Long maxCost, Packaging packaging, VideoSettings video, Boolean readVisuals, ScriptEdit scriptEdit) {
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
    public record VideoSettings(String mode,String resolutionTier,Long seed,String firstFrameKey,String lastFrameKey,
            List<com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput> references) {}
    public record Caption(Double start,Double end,String text) {}
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
    public record TextModel(String endpointId,String name,boolean isDefault,boolean supportsVision,Long creditCost) {}
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
