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

/** A film-study cut is one video reference; illegal plans must be refused before submission. */
class StudioPlanReferenceLimitsTest {
    final ObjectMapper om=new ObjectMapper();
    StudioSkillRules.Rules rules;
    StudioPlanQuoter quoter;
    MaterialVideoJobService jobs;
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
        var route=new AiModelInvocationService.ResolvedEndpoint(h3,
                AiAppEndpointCandidate.builder().endpointId(h3.getId()).enabled(true).creditCostOverride(40L).build(),true);
        when(invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION,"studio")).thenReturn(List.of(route));
        when(client.isEndpointReady(any())).thenReturn(true);
        when(client.isJusuanMedia(h3)).thenReturn(true);
        when(client.protocolDurationBounds(any())).thenReturn(new MaterialVideoModelClient.DurationBounds(4,15));
        var storage=mock(FileStorageService.class);var ffmpeg=mock(FfmpegRunner.class);
        var nativeVideos=new VideoStudioService(invocation,client,jobs,mock(MaterialVideoJobRepository.class),storage,
                mock(CdnUrlSigner.class),ffmpeg,om,prices,mock(VideoStudioTemplateService.class),mock(StudioPromptOptimizationRepository.class));
        var scenes=mock(AiAppSceneModelPolicyService.class);
        when(scenes.studioVideoCandidates()).thenReturn(List.of(route));
        when(scenes.resolveStudioVideo(nullable(String.class))).thenReturn(route);
        var videos=new StudioVideoService(scenes,nativeVideos,mock(IpProjectService.class),storage,ffmpeg);
        var workflow=mock(StudioWorkflowService.class);
        when(workflow.quote(eq("u"),any())).thenAnswer(i->{
            RunRequest r=i.getArgument(1);
            return videos.planPrice(r.model(),r.video(),r.aspectRatio(),r.durationSec())*r.count();
        });
        @SuppressWarnings("unchecked") ObjectProvider<StudioVideoService> provider=mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(videos);
        quoter=new StudioPlanQuoter(workflow,provider);
    }
    ObjectNode raw() throws Exception {
        return (ObjectNode)om.readTree("""
            {"summary":"制作视频","recommendedApproachId":"make","approaches":[{"id":"make","title":"制作","summary":"生成片段","rationale":"按素材制作","preserve":[],"change":[],"tradeoffs":[],"requiredCapabilities":["video"]}],
             "steps":[{"id":"v","operation":"video","title":"片段","prompt":"人物挥手",
              "settings":{"video":{"mode":"universal_reference_video","resolutionTier":"544p"},"durationSec":5,"aspectRatio":"9:16","count":1,"referenceBindings":[]}}],"questions":[]}
            """);
    }
    @Test void twoFilmStudyCutsAreRefusedAtPlanQuoteBeforeVideoSubmission() throws Exception {
        var raw=raw();
        var settings=(ObjectNode)raw.at("/steps/0/settings");
        ((ObjectNode)settings.path("video")).put("mode","universal_reference_video");
        var refs=settings.putArray("referenceBindings");
        refs.addObject().put("nodeId","character").put("role","character").put("order",0);
        refs.addObject().put("nodeId","study-s1").put("role","reference-video").put("order",1);
        refs.addObject().put("nodeId","study-s2").put("role","reference-video").put("order",2);
        var plan=StudioPlanValidator.validateSkillPlan(raw,rules,"production",List.of("character","study-s1","study-s2"));
        var error=assertThrows(BusinessException.class,()->quoter.quote("u",plan));
        assertEquals("VIDEO_STUDIO_INPUT_INVALID",error.getCode());
        assertFalse(plan.has("budget"));
        refs.remove(2);
        var valid=StudioPlanValidator.validateSkillPlan(raw,rules,"production",List.of("character","study-s1","study-s2"));
        quoter.quote("u",valid);
        assertTrue(valid.path("budget").path("estimated").asLong()>0);
        verifyNoInteractions(jobs);
    }

}
