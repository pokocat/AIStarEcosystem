package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint;
import com.aistareco.aep.service.cdn.CdnUploader.ObjectInfo;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.FileStorageService.StoredFile;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.aistareco.common.BusinessException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StudioSeedanceControlVideoTest {
    @TempDir Path directory;

    @ParameterizedTest
    @CsvSource({"160,320", "320,160", "320,320", "128,320", "320,128", "100,320", "320,100"})
    void controlDimensionsMeetArkLimits(int width, int height) {
        var size = StudioSeedanceControlVideo.inputSize(width, height);
        assertTrue(size.width() >= 300 && size.height() >= 300);
        assertTrue(size.width() * size.height() >= 407_696);
        assertTrue(size.width() / (double) size.height() >= 0.4 && size.width() / (double) size.height() <= 2.5);
        assertEquals(0, size.width() % 2);
        assertEquals(0, size.height() % 2);
    }

    @Test
    void compatibleControlDimensionsAreKept() {
        assertEquals(new StudioSeedanceControlVideo.Size(480, 854), StudioSeedanceControlVideo.inputSize(480, 854));
        assertEquals(new StudioSeedanceControlVideo.Size(452, 904), StudioSeedanceControlVideo.inputSize(160, 320));
    }

    @Test
    void submitsAnAdaptedCopyOfTheStoredControlAndKeepsOtherReferences() throws Exception {
        var ffmpeg = new FfmpegRunner(new MixcutProperties());
        try {
            ffmpeg.runFfmpeg(List.of("-version"));
            ffmpeg.runFfprobe(List.of("-version"));
        } catch (Exception unavailable) {
            assumeTrue(false, "ffmpeg and ffprobe are required");
        }
        Path control = directory.resolve("stored-control.mp4");
        Path adapted = directory.resolve("adapted.mp4");
        ffmpeg.runFfmpeg(List.of("-v", "error", "-f", "lavfi", "-i", "testsrc2=s=160x320:r=24:d=4.666667",
                "-c:v", "libx264", "-threads", "2", control.toString()), 30_000);
        byte[] original = Files.readAllBytes(control);
        var storage = mock(FileStorageService.class);
        var projects = mock(IpProjectService.class);
        var scenePolicies = mock(AiAppSceneModelPolicyService.class);
        var service = new StudioVideoService(scenePolicies, null, projects, storage, ffmpeg);
        var endpoint = AiModelEndpoint.builder().id("configured-endpoint").model("seedance-2.0").build();
        when(scenePolicies.resolveStudioVideo("configured-endpoint")).thenReturn(new ResolvedEndpoint(endpoint, null, true));
        when(projects.requireOwnedAssetKey("owner", "control.mp4")).thenReturn("control.mp4");
        when(storage.openForRead("control.mp4")).thenReturn(control);
        var storedObject = new AtomicReference<ObjectInfo>();
        when(storage.stat(anyString())).thenAnswer(call -> storedObject.get());
        when(storage.storeAllocated(any(), eq(IpProjectService.CATEGORY_GEN), eq("owner"), anyString(), eq("video/mp4")))
                .thenAnswer(call -> {
                    Files.copy(call.<Path>getArgument(0), adapted);
                    String key = call.getArgument(3);
                    long bytes = Files.size(adapted);
                    storedObject.set(new ObjectInfo(bytes, "video/mp4", null));
                    return new StoredFile(key, null, null, null, bytes, "video/mp4");
                });
        var otherVideo = new VideoStudioReferenceInput("video", "original.mp4");
        var image = new VideoStudioReferenceInput("image", "scene.jpg");
        var settings = new VideoSettings("universal_reference_video", "720p", null, null, null,
                List.of(new VideoStudioReferenceInput("video", "control.mp4"), otherVideo, image));
        var request = new IpRunService.IpVideoRequest("镜头", null, 5, "9:16", endpoint.getId(), 400L, settings);
        var prepared = service.prepareControlReferences("owner", request, Set.of("control.mp4"));
        var references = prepared.video().references();
        assertTrue(references.get(0).key().startsWith("ipstudio_gen/owner/seedance-control-"));
        assertEquals(List.of(otherVideo, image), references.subList(1, references.size()));
        assertEquals("720p", prepared.video().resolutionTier());
        assertArrayEquals(original, Files.readAllBytes(control));
        var probe = ffmpeg.probeMedia(adapted.toFile());
        assertEquals(452, probe.width());
        assertEquals(904, probe.height());
        assertEquals(4.666667, probe.durationSec(), 0.001);
        assertEquals("h264", probe.videoCodec());
        assertFalse(probe.hasAudio());
        assertEquals("24/1", ffmpeg.runFfprobe(List.of("-v", "error", "-select_streams", "v:0", "-show_entries",
                "stream=avg_frame_rate", "-of", "csv=p=0", adapted.toString())).strip());
        assertEquals(prepared, service.prepareControlReferences("owner", request, Set.of("control.mp4")));
        verify(storage, times(1)).storeAllocated(any(), anyString(), anyString(), anyString(), anyString());
        verify(storage, never()).openForRead("original.mp4");
        verify(storage, never()).openForRead("scene.jpg");

        endpoint.setModel("minimax-h3");
        assertSame(request, service.prepareControlReferences("owner", request, Set.of("control.mp4")));
    }

    @Test
    void anUnreadableControlStopsBeforeSubmission() throws Exception {
        var storage = mock(FileStorageService.class);
        var ffmpeg = mock(FfmpegRunner.class);
        var path = directory.resolve("unreadable.mp4");
        when(storage.openForRead("control.mp4")).thenReturn(path);
        when(ffmpeg.probeMedia(path.toFile()))
                .thenReturn(new FfmpegRunner.MediaProbe(0, "", null, null, 0, 0, 0, 0, false));
        var service = new StudioSeedanceControlVideo(storage, ffmpeg);
        assertEquals("STUDIO_DEPTH_REFERENCE_PREPARE_FAILED",
                assertThrows(BusinessException.class, () -> service.prepare("owner", "control.mp4")).getCode());
        verify(storage, never()).storeAllocated(any(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void recognizesOneTokenAndArkModelIdentifiers() {
        assertTrue(StudioSeedanceControlVideo.appliesTo("seedance-2.0"));
        assertTrue(StudioSeedanceControlVideo.appliesTo("doubao-seedance-2-0-fast-260128"));
        assertTrue(StudioSeedanceControlVideo.appliesTo("doubao-seedance-2-0-mini-260615"));
        assertFalse(StudioSeedanceControlVideo.appliesTo("seedance-2.5"));
        assertFalse(StudioSeedanceControlVideo.appliesTo("minimax-h3"));
    }
}
