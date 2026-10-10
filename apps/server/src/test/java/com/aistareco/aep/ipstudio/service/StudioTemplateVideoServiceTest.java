package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioTemplateVideoServiceTest {
    final AiModelInvocationService models=mock(AiModelInvocationService.class);
    final MaterialVideoJobService jobs=mock(MaterialVideoJobService.class);
    final StudioVideoService nativeVideos=mock(StudioVideoService.class);
    final StudioTemplateVideoService service=new StudioTemplateVideoService(models,jobs,nativeVideos);
    Step step(List<String> refs,Video video) {return new Step("v","node","video","video","prompt",refs,null,"video",true,5,"9:16",video);}
    void model(String id,boolean nativeMode) {
        when(models.resolveEndpoint(eq(AiModelPurpose.VIDEO_GENERATION),any())).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(AiModelEndpoint.builder().id(id).build(),null,true)));
        when(nativeVideos.models()).thenReturn(nativeMode?List.of(new VideoStudioModel(id,"H3",true,true,null,null)):List.of());
    }
    @Test void legacyQuoteUsesTheExactSubmitPriceAndDoesNotCreateJobs() {
        model("legacy",false);when(jobs.quote("legacy",5)).thenReturn(40L);
        var quote=service.quote("owner",step(List.of("frame"),null),"legacy","prompt");assertEquals(40,quote.cost());assertFalse(quote.nativeMode());
        verify(jobs).quote("legacy",5);verify(jobs,never()).submit(any(),any(),any());
        assertThrows(BusinessException.class,()->service.quote("owner",step(List.of("first","last"),new Video("first_last_frame_video","768p",null)),"legacy","prompt"));
    }
    @Test void nativeQuoteAndSubmissionSettingsPreserveOrderedFramesTierAndSeed() {
        model("native",true);when(nativeVideos.quote(eq("owner"),any())).thenReturn(25L);
        var step=step(List.of("first","last"),new Video("first_last_frame_video","544p",42L));var quote=service.quote("owner",step,"native","prompt");assertEquals(25,quote.cost());assertTrue(quote.nativeMode());
        var settings=service.settings(step,List.of("own/first.png","own/last.png"));assertEquals("own/first.png",settings.firstFrameKey());assertEquals("own/last.png",settings.lastFrameKey());assertEquals("544p",settings.resolutionTier());assertEquals(42L,settings.seed());verifyNoInteractions(jobs);
    }
    @Test void officialPresetsAreValidMediaFreeRecipesWithAnExplicitImageToVideoDependency() {
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        for(var preset:StudioTemplatePresets.definitions()) {
            var source=StudioTemplatePresets.source(preset,mapper);var recipe=StudioTemplateService.validateRecipe(preset.recipe(),source);var clean=StudioTemplateService.cleanDoc(source,recipe);
            assertEquals(List.of("image","video"),recipe.steps().stream().map(Step::operation).toList());assertEquals(List.of("frame"),recipe.steps().get(1).references());assertTrue(recipe.steps().get(0).requiresAdoption());assertFalse(clean.toString().contains("storageKey"));
        }
    }
}
