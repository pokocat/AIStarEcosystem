package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.materialvideo.VideoGenSpec;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioPricing;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 「按原文生成」：只对出片前会改写描述的模型开放，开放时原样写进出片规格；价格不变。 */
class StudioVideoPromptRewriteTest {

    private StudioVideoService service(boolean rewrites) {
        var scenes = mock(AiAppSceneModelPolicyService.class);
        var endpoint = AiModelEndpoint.builder().id("ep-h3").name("H3").build();
        var resolved = new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true);
        when(scenes.studioVideoCandidates()).thenReturn(List.of(resolved));
        when(scenes.resolveStudioVideo(any())).thenReturn(resolved);
        var videos = mock(VideoStudioService.class);
        when(videos.listModels("studio")).thenReturn(List.of(new VideoStudioModel("ep-h3", "H3", true, true, rewrites,
                VideoStudioService.contract(5, 15), new VideoStudioPricing(Map.of(), 0, 0, 0), List.of(1))));
        when(videos.prepareCanvas(eq("u"), any(), any(VideoStudioService.CanvasAssetValidator.class), eq("studio")))
                .thenReturn(new VideoStudioService.CanvasPreparation(
                        new VideoGenSpec("t2v", "768p", null, null, null, List.of()), 320, 99));
        return new StudioVideoService(scenes, videos, mock(IpProjectService.class), mock(FileStorageService.class), mock(FfmpegRunner.class));
    }

    private IpRunService.IpVideoRequest request(Boolean optimizePrompt) {
        return new IpRunService.IpVideoRequest("老周：等等？你说这片地要拆了。", null, 8, "16:9", "ep-h3", null,
                new VideoSettings("t2v", "768p", null, null, null, List.of(), optimizePrompt));
    }

    @Test
    void originalPromptIsWrittenIntoTheSpecWithoutChangingThePrice() {
        var prepared = service(true).prepare("u", request(false));
        assertEquals(Boolean.FALSE, prepared.spec().optimizePrompt());
        assertEquals(320, prepared.credits());
        assertEquals(99, prepared.seedMax());
        assertNull(service(true).prepare("u", request(null)).spec().optimizePrompt());
    }

    @Test
    void modelsThatDoNotRewriteRejectTheSwitchInsteadOfIgnoringIt() {
        var error = assertThrows(BusinessException.class, () -> service(false).prepare("u", request(false)));
        assertEquals("STUDIO_VIDEO_OPTION_UNSUPPORTED", error.getCode());
        assertNull(service(false).prepare("u", request(null)).spec().optimizePrompt());
    }
}
