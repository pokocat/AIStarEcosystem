package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioTemplateVideoServiceTest {
    final AiAppSceneModelPolicyService scenePolicies=mock(AiAppSceneModelPolicyService.class);
    final MaterialVideoJobService jobs=mock(MaterialVideoJobService.class);
    final StudioVideoService nativeVideos=mock(StudioVideoService.class);
    final StudioTemplateVideoService service=new StudioTemplateVideoService(scenePolicies,jobs,nativeVideos);
    Step step(List<String> refs,Video video) {return new Step("v","node","video","video","prompt",refs,null,"video",true,5,"9:16",video);}
    void model(String id,boolean nativeMode) {
        when(scenePolicies.resolveStudioVideo(any())).thenReturn(new AiModelInvocationService.ResolvedEndpoint(AiModelEndpoint.builder().id(id).build(),null,true));
        var contract=new VideoStudioContract(List.of(
                new VideoStudioModeSpec("t2v",false,false,null,null),
                new VideoStudioModeSpec("first_last_frame_video",true,true,null,null),
                new VideoStudioModeSpec("product-shot",true,false,null,null)),
                List.of(new VideoStudioTier("544p",List.of()),new VideoStudioTier("portraitX",List.of())),1,30,7000,100);
        when(nativeVideos.models()).thenReturn(nativeMode?List.of(new VideoStudioModel(id,"H3",true,true,contract,null)):List.of());
    }
    @Test void legacyQuoteUsesTheExactSubmitPriceAndDoesNotCreateJobs() {
        model("legacy",false);when(jobs.quote("legacy",5,"studio")).thenReturn(40L);
        var quote=service.quote("owner",step(List.of("frame"),null),"legacy","prompt");assertEquals(40,quote.cost());assertFalse(quote.nativeMode());
        verify(jobs).quote("legacy",5,"studio");verify(jobs,never()).submit(any(),any(),any());
        assertThrows(BusinessException.class,()->service.quote("owner",step(List.of("first","last"),new Video("first_last_frame_video","768p",null)),"legacy","prompt"));
    }
    @Test void nativeQuoteAndSubmissionSettingsPreserveOrderedFramesTierAndSeed() {
        model("native",true);when(nativeVideos.quote(eq("owner"),any())).thenReturn(25L);
        var step=step(List.of("first","last"),new Video("first_last_frame_video","544p",42L));var quote=service.quote("owner",step,"native","prompt");assertEquals(25,quote.cost());assertTrue(quote.nativeMode());
        var settings=service.settings(step,List.of("own/first.png","own/last.png"),"native");assertEquals("own/first.png",settings.firstFrameKey());assertEquals("own/last.png",settings.lastFrameKey());assertEquals("544p",settings.resolutionTier());assertEquals(42L,settings.seed());verifyNoInteractions(jobs);
    }
    @Test void customModeUsesTheConfiguredFrameAndTier() {
        model("native",true);when(nativeVideos.quote(eq("owner"),any())).thenReturn(25L);
        var step=step(List.of("frame"),new Video("product-shot","portraitX",null));
        assertEquals(25,service.quote("owner",step,"native","prompt").cost());
        var settings=service.settings(step,List.of("own/frame.png"),"native");
        assertEquals("product-shot",settings.mode());assertEquals("portraitX",settings.resolutionTier());
        assertEquals("own/frame.png",settings.firstFrameKey());assertNull(settings.lastFrameKey());
    }
    @Test void selectedModelRejectsExtraReferencesBeforeSubmission() {
        model("native",true);
        var step=step(List.of("frame"),new Video("t2v","544p",null));
        assertEquals("STUDIO_TEMPLATE_VIDEO_MODE_INVALID",assertThrows(BusinessException.class,
                ()->service.settings(step,List.of("own/frame.png"),"native")).getCode());
    }
    @Test void officialPresetsAreValidMediaFreeRecipesWithAnExplicitImageToVideoDependency() {
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        for(var preset:StudioTemplatePresets.definitions()) {
            var source=StudioTemplatePresets.source(preset,mapper);var recipe=StudioTemplateService.validateRecipe(preset.recipe(),source);var clean=StudioTemplateService.cleanDoc(source,recipe);
            assertEquals(List.of("image","video"),recipe.steps().stream().map(Step::operation).toList());assertEquals(List.of("frame"),recipe.steps().get(1).references());assertTrue(recipe.steps().get(0).requiresAdoption());assertFalse(clean.toString().contains("storageKey"));
        }
    }
}
