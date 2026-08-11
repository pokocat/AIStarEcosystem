package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipCapturePolicy;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ClipCapturePolicyTest {
    private FileStorageService storage;
    private FfmpegRunner ffmpeg;
    private ClipCapturePolicy policy;

    @BeforeEach
    void setUp() throws Exception {
        storage = mock(FileStorageService.class);
        ffmpeg = mock(FfmpegRunner.class);
        policy = new ClipCapturePolicy(storage, ffmpeg);
        when(storage.openForRead("capture-key")).thenReturn(Path.of("/tmp/capture"));
    }

    @Test
    void requirementsSeparateVendorLimitsFromQualityRecommendations() {
        var requirements = policy.requirements();
        assertEquals(5, requirements.avatar().vendorMinDurationSec());
        assertEquals(300, requirements.avatar().vendorMaxDurationSec());
        assertEquals(5, requirements.avatar().minDurationSec());
        assertEquals(10, requirements.avatar().recommendedMinDurationSec());
        assertEquals(2, requirements.voice().vendorMinDurationSec());
        assertEquals(3, requirements.voice().minDurationSec());
        assertEquals(8, requirements.voice().recommendedMinDurationSec());
        assertTrue(requirements.voice().vendorFormats().contains("pcm"));
        assertFalse(requirements.voice().formats().contains("pcm"));
        assertTrue(requirements.consentText().contains("授权军师参谋部"));
    }

    @Test
    void rejectsNonH264AndTooShortVoiceBeforeCallingVendor() {
        MockMultipartFile video = new MockMultipartFile("file", "me.mp4", "video/mp4", new byte[]{1});
        var storedVideo = new FileStorageService.StoredFile("capture-key", null, null, null, 1, "video/mp4");
        when(ffmpeg.probeMedia(any())).thenReturn(new FfmpegRunner.MediaProbe(30, "mov,mp4", "hevc", "aac", 720, 1280, 48000, 2, true));
        BusinessException codec = assertThrows(BusinessException.class, () -> policy.validate("avatar", video, storedVideo));
        assertEquals("CLIP_VIDEO_CODEC_INVALID", codec.getCode());

        MockMultipartFile audio = new MockMultipartFile("file", "me.mp3", "audio/mpeg", new byte[]{1});
        var storedAudio = new FileStorageService.StoredFile("capture-key", null, null, null, 1, "audio/mpeg");
        when(ffmpeg.probeMedia(any())).thenReturn(new FfmpegRunner.MediaProbe(1.5, "mp3", null, "mp3", 0, 0, 44100, 1, true));
        BusinessException shortAudio = assertThrows(BusinessException.class, () -> policy.validate("voice", audio, storedAudio));
        assertEquals("CLIP_VOICE_TOO_SHORT", shortAudio.getCode());
    }

    @Test
    void acceptsOfficialVideoAndAudioShapes() {
        MockMultipartFile video = new MockMultipartFile("file", "me.mov", "video/quicktime", new byte[]{1});
        var storedVideo = new FileStorageService.StoredFile("capture-key", null, null, null, 1, "video/quicktime");
        when(ffmpeg.probeMedia(any())).thenReturn(new FfmpegRunner.MediaProbe(5, "mov,mp4", "h264", "aac", 1080, 1920, 48000, 1, true));
        assertEquals(5, policy.validate("avatar", video, storedVideo).durationSec());

        MockMultipartFile audio = new MockMultipartFile("file", "me.m4a", "audio/mp4", new byte[]{1});
        var storedAudio = new FileStorageService.StoredFile("capture-key", null, null, null, 1, "audio/mp4");
        when(ffmpeg.probeMedia(any())).thenReturn(new FfmpegRunner.MediaProbe(2.1, "mov,mp4", null, "aac", 0, 0, 44100, 1, true));
        assertEquals(2.1, policy.validate("voice", audio, storedAudio).durationSec());
    }

    @Test
    void rejectsMissingExtensionAndContainerMismatch() {
        MockMultipartFile noExtension = new MockMultipartFile("file", "capture", "audio/mpeg", new byte[]{1});
        var stored = new FileStorageService.StoredFile("capture-key", null, null, null, 1, "audio/mpeg");
        BusinessException extension = assertThrows(BusinessException.class, () -> policy.validate("voice", noExtension, stored));
        assertEquals("CLIP_CAPTURE_EXTENSION_INVALID", extension.getCode());

        MockMultipartFile disguised = new MockMultipartFile("file", "capture.mp4", "video/mp4", new byte[]{1});
        when(ffmpeg.probeMedia(any())).thenReturn(new FfmpegRunner.MediaProbe(30, "matroska,webm", "h264", "aac", 720, 1280, 48000, 1, true));
        BusinessException mismatch = assertThrows(BusinessException.class, () -> policy.validate("avatar", disguised, stored));
        assertEquals("CLIP_CAPTURE_CONTAINER_MISMATCH", mismatch.getCode());
    }
}
