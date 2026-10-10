package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.dap.repository.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

/** Read product/performer/voice truth from existing owned assets, not a second Studio inventory. */
@Service
public class StudioAssetCatalogService {
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.service.AiModelInvocationService models;
    @org.springframework.beans.factory.annotation.Autowired private StudioPointPricing pricing;
    private final DapProductRepository products;private final DapAvatarRepository avatars;private final DapVoiceRepository voices;
    private final FileStorageService storage;private final ClipProperties clip;
    public StudioAssetCatalogService(DapProductRepository products,DapAvatarRepository avatars,DapVoiceRepository voices,FileStorageService storage,ClipProperties clip) {
        this.products=products;this.avatars=avatars;this.voices=voices;this.storage=storage;this.clip=clip;
    }
    @Transactional(readOnly=true)
    public AssetCatalog list(String owner) {
        boolean engineReady=!clip.isForceMock()&&clip.getShiliuBaseUrl()!=null&&!clip.getShiliuBaseUrl().isBlank()&&clip.getShiliuToken()!=null&&!clip.getShiliuToken().isBlank();
        List<ProductAsset> productList=products.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(owner).stream()
                .map(p->new ProductAsset(p.getId(),p.getName(),p.getDescription(),p.getImageKey(),storage.signedUrl(p.getImageKey()),p.getStatus())).toList();
        List<VoiceAsset> voiceList=voices.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner).stream()
                .map(v->new VoiceAsset(v.getId(),v.getName(),v.getAvatarId(),("shiliu".equals(v.getEngine())||"qwen3-tts".equals(v.getEngine()))?state(v.getEngineRef()==null?null:v.getEngineStatus()):"not_created",
                        v.getDemoAudioCdnKey()==null?null:storage.signedUrl(v.getDemoAudioCdnKey()))).toList();
        List<PerformerAsset> performerList=avatars.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(owner).stream()
                .map(a->new PerformerAsset(a.getId(),a.getIpId(),a.getName(),a.getImageKey()!=null,
                        !engineReady?"unavailable":"shiliu".equals(a.getEngine())&&!a.isMock()?state(a.getEngineRef()==null?null:a.getEngineStatus()):"not_created",a.getVoiceId())).toList();
        boolean lipReady=models.listCandidates(com.aistareco.aep.model.AiModelPurpose.DAP_LIP_SYNC).stream().anyMatch(this::lipReady);
        return new AssetCatalog(productList,performerList,voiceList,engineReady,lipReady);
    }
    private boolean lipReady(com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint resolved) {
        var endpoint=resolved.endpoint();
        if(!JusuanLipSyncClient.supports(endpoint)||!endpoint.isEnabled()||!resolved.candidate().isEnabled()
                ||endpoint.getBillingMode()!=com.aistareco.aep.model.AiModelBillingMode.PER_SECOND)return false;
        // Match lip-sync preflight: a fixed customer rate takes precedence over a legacy candidate price.
        var rate=pricing.find(endpoint.getId());
        if(rate!=null)return rate.platformPointsPerSecond().signum()>=0;
        Long legacy=resolved.candidate().getCreditCostOverride();
        return !pricing.enabled()&&legacy!=null&&legacy>=0;
    }
    private static String state(String value) {return List.of("ready","training","failed").contains(value==null?"":value)?value:"not_created";}
}
