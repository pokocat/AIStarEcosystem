package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.*;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/v1/ip-studio")
public class StudioWorkflowController {
    private final StudioWorkflowService workflow;
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.ipstudio.service.StudioVideoService video;
    @GetMapping("/studio/video-models")
    public ApiResponse<java.util.List<com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel>> videoModels() {return ApiResponse.of(video.models());}
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.ipstudio.service.StudioSpeechService speech;
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.ipstudio.service.StudioAssetCatalogService catalog;
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.ipstudio.service.StudioLipSyncService lipSync;
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.ipstudio.service.StudioVoiceService voices;
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.ipstudio.service.StudioIpAssetService ipLibrary;
    public StudioWorkflowController(StudioWorkflowService workflow) { this.workflow = workflow; }
    @GetMapping("/studio/voice-profiles")
    public ApiResponse<com.aistareco.aep.ipstudio.dto.StudioVoiceDtos.VoiceCatalog> voiceProfiles(Principal principal){return ApiResponse.of(voices.catalog(principal.getName()));}
    @PostMapping("/projects/{id}/adopt-voice")
    public ApiResponse<com.aistareco.aep.ipstudio.dto.StudioVoiceDtos.VoiceProfile> adoptVoice(Principal principal,@PathVariable String id,@RequestBody com.aistareco.aep.ipstudio.dto.StudioVoiceDtos.AdoptVoiceRequest request){return ApiResponse.of(voices.adopt(principal.getName(),id,request));}
    @PutMapping("/studio/performers/{avatarId}/voice")
    public ApiResponse<com.aistareco.aep.ipstudio.dto.StudioVoiceDtos.VoiceProfile> bindVoice(Principal principal,@PathVariable String avatarId,@RequestBody com.aistareco.aep.ipstudio.dto.StudioVoiceDtos.BindVoiceRequest request){return ApiResponse.of(voices.bindDefault(principal.getName(),avatarId,request));}
    @GetMapping("/studio/speech-catalog")
    public ApiResponse<com.aistareco.aep.ipstudio.dto.StudioSpeechDtos.SpeechCatalog> speechCatalog() {return ApiResponse.of(speech.catalog());}
    @PostMapping("/projects/{id}/speech-runs")
    public ApiResponse<IpRunDto> speechRun(Principal principal,@PathVariable String id,@RequestBody com.aistareco.aep.ipstudio.dto.StudioSpeechDtos.SpeechRequest request) {
        return ApiResponse.of(speech.submit(principal.getName(),id,request));
    }
    @GetMapping("/studio/lip-sync-catalog")
    public ApiResponse<com.aistareco.aep.ipstudio.dto.StudioLipSyncDtos.LipSyncCatalog> lipSyncCatalog(){return ApiResponse.of(lipSync.catalog());}
    @PostMapping("/projects/{id}/lip-sync-quote")
    public ApiResponse<com.aistareco.aep.ipstudio.dto.StudioLipSyncDtos.LipSyncQuote> lipSyncQuote(Principal principal,@PathVariable String id,@RequestBody com.aistareco.aep.ipstudio.dto.StudioLipSyncDtos.LipSyncInput request){return ApiResponse.of(lipSync.quote(principal.getName(),id,request));}
    @PostMapping("/projects/{id}/lip-sync-runs")
    public ApiResponse<IpRunDto> lipSyncRun(Principal principal,@PathVariable String id,@RequestBody com.aistareco.aep.ipstudio.dto.StudioLipSyncDtos.LipSyncRequest request){return ApiResponse.of(lipSync.submit(principal.getName(),id,request));}
    @PostMapping("/projects/{id}/lip-sync-runs/{runId}/extract")
    public ApiResponse<IpRunDto> extractLipSync(Principal principal,@PathVariable String id,@PathVariable String runId) throws Exception {return ApiResponse.of(lipSync.extract(principal.getName(),id,runId));}
    @GetMapping("/studio/capabilities")
    public ApiResponse<Capabilities> capabilities() { return ApiResponse.of(workflow.capabilities()); }
    @GetMapping("/studio/asset-catalog")
    public ApiResponse<AssetCatalog> assetCatalog(Principal principal) {return ApiResponse.of(catalog.list(principal.getName()));}
    @GetMapping("/studio/ip-assets")
    public ApiResponse<java.util.List<IpAsset>> ipAssets(Principal principal) {return ApiResponse.of(workflow.ipAssets(principal.getName()));}
    @PutMapping("/studio/performers/{avatarId}/looks/{lookId}/role")
    public ApiResponse<IpAsset> classifyLook(Principal principal,@PathVariable String avatarId,@PathVariable String lookId,@RequestBody AssetRoleRequest request) {
        return ApiResponse.of(ipLibrary.classify(principal.getName(),avatarId,lookId,request==null?null:request.assetRole()));
    }
    @PostMapping("/projects/{id}/studio-runs")
    public ApiResponse<IpRunDto> submit(Principal principal, @PathVariable String id, @RequestBody RunRequest request) {
        return ApiResponse.of(workflow.submit(principal.getName(), id, request));
    }
    @PostMapping("/projects/{id}/adopt")
    public ApiResponse<AdoptResult> adopt(Principal principal, @PathVariable String id, @RequestBody AdoptRequest request) {
        return ApiResponse.of(workflow.adopt(principal.getName(), id, request));
    }
}
