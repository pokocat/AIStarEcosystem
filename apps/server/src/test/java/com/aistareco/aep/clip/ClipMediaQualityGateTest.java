package com.aistareco.aep.clip;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.service.ClipMediaQualityGate;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

class ClipMediaQualityGateTest {
    @Test
    void acceptsReadablePictureAndSpeechLoudness() {
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        when(ffmpeg.runFfmpeg(anyList())).thenAnswer(inv -> output(inv.getArgument(0),
                "lavfi.signalstats.YAVG=42.0\nlavfi.signalstats.YAVG=86.0\n",
                "{\n\"input_i\" : \"-18.4\",\n\"input_tp\" : \"-1.2\"\n}"));
        ClipMediaQualityGate gate = new ClipMediaQualityGate(ffmpeg, properties());

        ClipMediaQualityGate.Metrics metrics = gate.assertAcceptable(Path.of("final.mp4"));

        assertEquals(64.0, metrics.averageLuma(), 0.01);
        assertEquals(-18.4, metrics.integratedLufs(), 0.01);
        assertEquals(-1.2, metrics.truePeakDb(), 0.01);
        verify(ffmpeg, times(2)).runFfmpeg(anyList());
    }

    @Test
    void rejectsBlackOrBlownOutPictureBeforeDelivery() {
        FfmpegRunner darkFfmpeg = mock(FfmpegRunner.class);
        when(darkFfmpeg.runFfmpeg(anyList())).thenAnswer(inv -> output(inv.getArgument(0),
                "lavfi.signalstats.YAVG=4.0\n", loudnorm(-18, -2)));
        BusinessException dark = assertThrows(BusinessException.class,
                () -> new ClipMediaQualityGate(darkFfmpeg, properties()).assertAcceptable(Path.of("dark.mp4")));
        assertEquals("CLIP_OUTPUT_QUALITY_FAILED", dark.getCode());
        assertTrue(dark.getMessage().contains("过暗"));

        FfmpegRunner brightFfmpeg = mock(FfmpegRunner.class);
        when(brightFfmpeg.runFfmpeg(anyList())).thenAnswer(inv -> output(inv.getArgument(0),
                "lavfi.signalstats.YAVG=251.0\n", loudnorm(-18, -2)));
        BusinessException bright = assertThrows(BusinessException.class,
                () -> new ClipMediaQualityGate(brightFfmpeg, properties()).assertAcceptable(Path.of("bright.mp4")));
        assertTrue(bright.getMessage().contains("过亮"));
    }

    @Test
    void rejectsSilenceQuietAudioAndClipping() {
        assertAudioRejected("-inf", "-inf", "没有可用声音");
        assertAudioRejected("-40.0", "-6.0", "过轻");
        assertAudioRejected("-18.0", "0.7", "爆音");
    }

    private static void assertAudioRejected(String loudness, String peak, String message) {
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        when(ffmpeg.runFfmpeg(anyList())).thenAnswer(inv -> output(inv.getArgument(0),
                "lavfi.signalstats.YAVG=80.0\n", loudnorm(loudness, peak)));
        BusinessException error = assertThrows(BusinessException.class,
                () -> new ClipMediaQualityGate(ffmpeg, properties()).assertAcceptable(Path.of("audio.mp4")));
        assertEquals("CLIP_OUTPUT_QUALITY_FAILED", error.getCode());
        assertTrue(error.getMessage().contains(message));
    }

    private static String output(List<String> args, String visual, String audio) {
        return args.stream().anyMatch(value -> value.contains("signalstats")) ? visual : audio;
    }

    private static String loudnorm(double loudness, double peak) {
        return loudnorm(String.valueOf(loudness), String.valueOf(peak));
    }

    private static String loudnorm(String loudness, String peak) {
        return "{\n\"input_i\" : \"" + loudness + "\",\n\"input_tp\" : \"" + peak + "\"\n}";
    }

    private static ClipProperties properties() {
        ClipProperties props = new ClipProperties();
        props.setMinAverageLuma(18);
        props.setMaxAverageLuma(245);
        props.setMinIntegratedLufs(-24);
        props.setMaxIntegratedLufs(-12);
        props.setMaxTruePeakDb(-1);
        return props;
    }
}
