package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.aep.videostudio.repository.StudioPromptOptimizationRepository;
import com.aistareco.aep.videostudio.service.*;
import com.aistareco.aep.videostudio.service.VideoStudioPricing;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Production regression: Seedance + 720p must not become the default H3 + 720p during plan normalization.
 * Uses the real normalizer, plan compiler, quoter and native contract/price/preflight services; no supplier calls. */
class StudioPlanModelSelectionTest {
    final ObjectMapper om=new ObjectMapper();
    final StudioPlanSteps.Keys keys=new StudioPlanSteps.Keys() {
        public String binding(JsonNode b){return "owned/reference.png";}
        public String clip(JsonNode c){return "owned/clip.mp4";}
        public String sourceAudio(){return null;}
    };
    StudioSkillRules.Rules rules;
    StudioWorkflowService workflow;
    StudioVideoService videos;
    VideoStudioService nativeVideos;
    StudioPlanQuoter quoter;
    MaterialVideoJobService jobs;
    AiModelEndpoint seedance;

    @BeforeEach void setup() throws Exception {
        try(var in=getClass().getResourceAsStream("/studio/skills/reference-video-recreation.md")) {
            rules=StudioSkillRules.rules(StudioSkillCatalog.parse(new String(in.readAllBytes(),StandardCharsets.UTF_8)));
        }
        var invocation=mock(AiModelInvocationService.class);
        var client=mock(MaterialVideoModelClient.class);
        jobs=mock(MaterialVideoJobService.class);
        var prices=mock(VideoStudioPricingService.class);
        when(prices.current()).thenReturn(VideoStudioPricing.defaults());
        var h3=AiModelEndpoint.builder().id("ai-jusuan-minimax-h3").name("H3").model("minimax-h3")
                .billingMode(AiModelBillingMode.PER_SECOND).enabled(true).build();
        seedance=AiModelEndpoint.builder().id("ai-1fb0d9ce-d74").name("Seedance Fast").model("doubao-seedance-fast")
                .billingMode(AiModelBillingMode.PER_SECOND).enabled(true).build();
        configureSeedance("720p",720,1280);
        var h3Route=new AiModelInvocationService.ResolvedEndpoint(h3,
                AiAppEndpointCandidate.builder().endpointId(h3.getId()).enabled(true).creditCostOverride(40L).build(),true);
        var sdRoute=new AiModelInvocationService.ResolvedEndpoint(seedance,
                AiAppEndpointCandidate.builder().endpointId(seedance.getId()).enabled(true).creditCostOverride(30L).build(),false);
        when(invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION,"studio")).thenReturn(List.of(h3Route,sdRoute));
        when(client.isEndpointReady(any())).thenReturn(true);
        when(client.isJusuanMedia(h3)).thenReturn(true);
        when(client.protocolDurationBounds(any())).thenReturn(new MaterialVideoModelClient.DurationBounds(4,15));
        var storage=mock(FileStorageService.class);var ffmpeg=mock(FfmpegRunner.class);
        nativeVideos=new VideoStudioService(invocation,client,jobs,mock(MaterialVideoJobRepository.class),storage,
                mock(CdnUrlSigner.class),ffmpeg,om,prices,mock(VideoStudioTemplateService.class),mock(StudioPromptOptimizationRepository.class));
        var scenes=mock(AiAppSceneModelPolicyService.class);
        when(scenes.studioVideoCandidates()).thenReturn(List.of(h3Route,sdRoute));
        when(scenes.resolveStudioVideo(nullable(String.class))).thenAnswer(i->{
            String id=i.getArgument(0);
            if(id==null||id.equals(h3.getId()))return h3Route;
            if(id.equals(seedance.getId()))return sdRoute;
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","请选择 Studio 开放的视频模型");
        });
        videos=new StudioVideoService(scenes,nativeVideos,mock(IpProjectService.class),storage,ffmpeg);
        workflow=mock(StudioWorkflowService.class);
        when(workflow.quote(eq("u"),any())).thenAnswer(i->{
            RunRequest r=i.getArgument(1);
            return videos.planPrice(r.model(),r.video(),r.aspectRatio(),r.durationSec())*r.count();
        });
        @SuppressWarnings("unchecked") ObjectProvider<StudioVideoService> provider=mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(videos);
        quoter=new StudioPlanQuoter(workflow,provider);
    }

    void configureSeedance(String tier,int width,int height) {
        var contract=new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v",false,false,null,null)),
                List.of(new VideoStudioTier(tier,List.of(new VideoStudioCanvas("9:16",width,height)))),4,15,5000,4294967295L);
        seedance.setVideoRequestSpecJson(new AiVideoRequestSpec("seedance",contract,"/tasks","/tasks/{id}",Map.of()).json());
    }
    ObjectNode raw(String model,String tier,boolean nested) throws Exception {
        var raw=(ObjectNode)om.readTree("""
            {"summary":"制作视频","recommendedApproachId":"make","approaches":[{"id":"make","title":"制作","summary":"生成片段","rationale":"按素材制作","preserve":[],"change":[],"tradeoffs":[],"requiredCapabilities":["video"]}],
             "steps":[{"id":"v","operation":"video","title":"片段","prompt":"人物挥手",
              "settings":{"video":{"mode":"t2v","resolutionTier":"720p"},"durationSec":5,"aspectRatio":"9:16","count":1,"referenceBindings":[]}}],"questions":[]}
            """);
        var settings=(ObjectNode)raw.at("/steps/0/settings");
        ((ObjectNode)settings.path("video")).put("resolutionTier",tier);
        if(model!=null)((ObjectNode)(nested?settings.path("video"):settings)).put("model",model);
        return raw;
    }
    ObjectNode normalize(ObjectNode raw) {return StudioPlanValidator.validateSkillPlan(raw,rules,"production",List.of());}
    RunRequest compile(ObjectNode plan) {
        var step=plan.path("steps").get(0);
        return StudioPlanSteps.request(step,keys,quoter.modes(step.at("/settings/model").asText(null)),null);
    }
    void assertQuoteAndPreflight(ObjectNode plan,String endpoint,String tier,long expected) {
        quoter.quote("u",plan);
        var request=compile(plan);
        assertEquals(endpoint,request.model());assertEquals(tier,request.video().resolutionTier());
        assertEquals(expected,plan.at("/steps/0/quotedCost").asLong());
        var prepared=nativeVideos.prepareCanvas("u",new VideoStudioJobRequest(request.model(),request.video().mode(),request.prompt(),
                request.video().resolutionTier(),request.aspectRatio(),request.durationSec(),null,null,null,List.of(),null,null,null,null),
                (VideoStudioService.CanvasAssetValidator)(type,key,frame)->{},"studio");
        assertEquals(expected,prepared.credits());assertEquals(tier,prepared.spec().resolutionTier());
        verifyNoInteractions(jobs);
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void explicitSeedanceSurvivesNormalizationQuoteAndSubmissionPreflight(boolean nested) throws Exception {
        var plan=normalize(raw(seedance.getId(),"720p",nested));
        assertFalse(plan.at("/steps/0/settings/video").has("model"));
        assertQuoteAndPreflight(plan,seedance.getId(),"720p",150);
    }
    @Test void omittedModelKeepsDefaultH3AndItsOwnTiers() throws Exception {
        assertQuoteAndPreflight(normalize(raw(null,"544p",false)),null,"544p",200);
        var wrong=normalize(raw(null,"720p",false));
        assertEquals("VIDEO_STUDIO_SPEC_INVALID",assertThrows(BusinessException.class,()->quoter.quote("u",wrong)).getCode());
        verifyNoInteractions(jobs);
    }
    @Test void changingOneEndpointContractChangesCapabilitiesQuoteAndPreflightTogether() throws Exception {
        configureSeedance("1080p",1080,1920);
        assertEquals("1080p",videos.models().stream().filter(m->m.endpointId().equals(seedance.getId())).findFirst().orElseThrow().contract().tiers().get(0).tier());
        assertQuoteAndPreflight(normalize(raw(seedance.getId(),"1080p",true)),seedance.getId(),"1080p",150);
        var old=normalize(raw(seedance.getId(),"720p",true));
        assertEquals("VIDEO_STUDIO_SPEC_INVALID",assertThrows(BusinessException.class,()->quoter.quote("u",old)).getCode());
    }
    @Test void conflictingOrMalformedChoicesAreRefusedInsteadOfUsingTheDefault() throws Exception {
        var conflict=raw(seedance.getId(),"720p",true);
        ((ObjectNode)conflict.at("/steps/0/settings")).put("model","ai-jusuan-minimax-h3");
        assertThrows(BusinessException.class,()->normalize(conflict));
        for(JsonNode bad:List.of(om.getNodeFactory().numberNode(7),om.createObjectNode(),om.getNodeFactory().textNode(" "))) {
            var raw=raw(null,"768p",false);((ObjectNode)raw.at("/steps/0/settings")).set("model",bad);
            assertThrows(BusinessException.class,()->normalize(raw));
        }
        var unknown=normalize(raw("disabled-endpoint","768p",true));
        assertThrows(BusinessException.class,()->quoter.quote("u",unknown));
        verifyNoInteractions(jobs);
    }
    @Test void imageModelIsPreservedAndAffectsTheApprovedPlanFingerprint() throws Exception {
        var raw=raw(null,"768p",false);var step=(ObjectNode)raw.at("/steps/0");step.put("operation","image");
        var settings=om.createObjectNode().put("model","image-a").put("count",1);settings.putArray("referenceBindings");
        step.set("settings",settings);
        var first=normalize(raw);
        assertEquals("image-a",StudioPlanSteps.request(first.path("steps").get(0),keys,quoter.modes(),null).model());
        ((ObjectNode)raw.at("/steps/0/settings")).put("model","image-b");
        assertNotEquals(StudioPlanValidator.fingerprint(first),StudioPlanValidator.fingerprint(normalize(raw)));
    }
}
