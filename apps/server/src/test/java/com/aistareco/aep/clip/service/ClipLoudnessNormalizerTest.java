package com.aistareco.aep.clip.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

class ClipLoudnessNormalizerTest {
    @Test
    void measuresThenNormalizesWithAacTruePeakHeadroom() {
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        when(ffmpeg.runFfmpeg(anyList())).thenReturn(analysis(), "encoded");
        ClipLoudnessNormalizer normalizer = new ClipLoudnessNormalizer(ffmpeg);

        normalizer.normalize(Path.of("joined.mp4"), Path.of("normalized.mp4"));

        ArgumentCaptor<List<String>> commands = ArgumentCaptor.forClass(List.class);
        verify(ffmpeg, times(2)).runFfmpeg(commands.capture());
        List<String> first = commands.getAllValues().get(0);
        List<String> second = commands.getAllValues().get(1);
        assertTrue(first.contains("loudnorm=I=-16:TP=-2.5:LRA=11:print_format=json"));
        String filter = second.get(second.indexOf("-af") + 1);
        assertTrue(filter.contains("TP=-2.5"), "编码前必须给 AAC 峰值回弹留余量");
        assertTrue(filter.contains("measured_I=-15.39"));
        assertTrue(filter.contains("measured_TP=-0.77"));
        assertTrue(filter.contains("measured_LRA=5.70"));
        assertTrue(filter.contains("measured_thresh=-25.69"));
        assertTrue(filter.contains("offset=-0.44"));
        assertTrue(filter.contains("linear=true"), "第二遍必须消费第一遍实测参数");
        assertTrue(second.containsAll(List.of("-c:a", "aac", "-b:a", "160k")));
    }

    @Test
    void rejectsMissingOrSilentMeasurementsInsteadOfProducingUncheckedAudio() {
        BusinessException missing = assertThrows(BusinessException.class,
                () -> ClipLoudnessNormalizer.parse("{}"));
        assertEquals("CLIP_OUTPUT_QUALITY_FAILED", missing.getCode());
        assertTrue(missing.getMessage().contains("缺失"));

        String silent = analysis().replace("\"-15.39\"", "\"-inf\"");
        BusinessException noAudio = assertThrows(BusinessException.class,
                () -> ClipLoudnessNormalizer.parse(silent));
        assertTrue(noAudio.getMessage().contains("没有可用声音"));
    }

    private static String analysis() {
        return """
                {
                  "input_i" : "-15.39",
                  "input_tp" : "-0.77",
                  "input_lra" : "5.70",
                  "input_thresh" : "-25.69",
                  "target_offset" : "-0.44"
                }
                """;
    }
}
