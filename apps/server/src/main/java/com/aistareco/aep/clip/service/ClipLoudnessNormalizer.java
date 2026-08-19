package com.aistareco.aep.clip.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;

import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 成片两遍响度归一化。
 *
 * <p>AAC 是有损编码：滤镜阶段即使把 true peak 目标设为 -1.5 dBTP，编码后仍可能产生
 * 0.5~1 dB 的峰值回弹。质量门验的是编码后的文件，因此处理目标必须比最终 -1 dBTP
 * 门槛保留足够余量。第一遍只测量，第二遍带 measured_* 参数做确定性归一化并以
 * -2.5 dBTP 为编码前目标；最终文件仍由 {@link ClipMediaQualityGate} 实测把关。
 */
final class ClipLoudnessNormalizer {
    static final double TARGET_INTEGRATED_LUFS = -16.0;
    static final double TARGET_TRUE_PEAK_DB = -2.5;
    static final double TARGET_LRA = 11.0;

    private static final Pattern INPUT_I = field("input_i");
    private static final Pattern INPUT_TP = field("input_tp");
    private static final Pattern INPUT_LRA = field("input_lra");
    private static final Pattern INPUT_THRESH = field("input_thresh");
    private static final Pattern TARGET_OFFSET = field("target_offset");

    private final FfmpegRunner ffmpeg;

    ClipLoudnessNormalizer(FfmpegRunner ffmpeg) {
        this.ffmpeg = ffmpeg;
    }

    record Measurement(double inputI, double inputTp, double inputLra, double inputThresh, double targetOffset) {}

    void normalize(Path input, Path output) {
        String analysis = ffmpeg.runFfmpeg(List.of(
                "-hide_banner", "-nostats", "-i", input.toString(), "-af",
                firstPassFilter(), "-vn", "-f", "null", "-"));
        Measurement measured = parse(analysis);
        ffmpeg.runFfmpeg(List.of(
                "-y", "-i", input.toString(), "-map", "0:v:0", "-map", "0:a:0",
                "-c:v", "copy", "-af", secondPassFilter(measured),
                "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", output.toString()));
    }

    static String firstPassFilter() {
        return "loudnorm=I=-16:TP=-2.5:LRA=11:print_format=json";
    }

    static String secondPassFilter(Measurement measured) {
        return String.format(Locale.ROOT,
                "loudnorm=I=-16:TP=-2.5:LRA=11:measured_I=%.2f:measured_TP=%.2f:"
                        + "measured_LRA=%.2f:measured_thresh=%.2f:offset=%.2f:linear=true:print_format=summary",
                measured.inputI(), measured.inputTp(), measured.inputLra(), measured.inputThresh(), measured.targetOffset());
    }

    static Measurement parse(String output) {
        return new Measurement(
                number(output, INPUT_I, "input_i"),
                number(output, INPUT_TP, "input_tp"),
                number(output, INPUT_LRA, "input_lra"),
                number(output, INPUT_THRESH, "input_thresh"),
                number(output, TARGET_OFFSET, "target_offset"));
    }

    private static Pattern field(String name) {
        return Pattern.compile("\\\"" + name + "\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    }

    private static double number(String output, Pattern pattern, String field) {
        Matcher matcher = pattern.matcher(output == null ? "" : output);
        if (!matcher.find()) throw failure("成片响度分析结果缺失", field + " is missing");
        String raw = matcher.group(1).trim();
        if (raw.equalsIgnoreCase("-inf") || raw.equalsIgnoreCase("+inf") || raw.equalsIgnoreCase("inf")) {
            throw failure("成片没有可用声音", field + "=" + raw);
        }
        try {
            double value = Double.parseDouble(raw);
            if (!Double.isFinite(value)) throw new NumberFormatException(raw);
            return value;
        } catch (NumberFormatException e) {
            throw failure("成片响度分析结果非法", field + "=" + raw);
        }
    }

    private static BusinessException failure(String message, String detail) {
        return BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "CLIP_OUTPUT_QUALITY_FAILED", message, detail);
    }
}
