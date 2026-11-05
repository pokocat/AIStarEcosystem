package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 成片质量建议：记录亮度与响度指标，不拒收已经生成的成片。 */
@Service
public class ClipMediaQualityGate {
    private static final Logger log = LoggerFactory.getLogger(ClipMediaQualityGate.class);
    private static final Pattern LUMA = Pattern.compile("lavfi\\.signalstats\\.YAVG=([0-9]+(?:\\.[0-9]+)?)");
    private static final Pattern INPUT_I = Pattern.compile("\\\"input_i\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final Pattern INPUT_TP = Pattern.compile("\\\"input_tp\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

    private final FfmpegRunner ffmpeg;
    private final ClipProperties props;

    public ClipMediaQualityGate(FfmpegRunner ffmpeg, ClipProperties props) {
        this.ffmpeg = ffmpeg;
        this.props = props;
    }

    public record Metrics(double averageLuma, double integratedLufs, double truePeakDb) {}

    public Metrics assertAcceptable(Path video) {
        double luma;
        double loudness;
        double peak;
        try {
            String visual = ffmpeg.runFfmpeg(List.of(
                    "-hide_banner", "-nostats", "-i", video.toString(), "-vf",
                    "fps=1,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-an", "-f", "null", "-"));
            luma = averageLuma(visual);
            String audio = ffmpeg.runFfmpeg(List.of(
                    "-hide_banner", "-nostats", "-i", video.toString(), "-af",
                    "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-vn", "-f", "null", "-"));
            loudness = number(audio, INPUT_I, "综合响度");
            peak = number(audio, INPUT_TP, "真峰值");
        } catch (BusinessException e) {
            log.warn("[clip-quality] metrics unavailable; retaining output: {}",e.getMessage());
            return new Metrics(Double.NaN,Double.NaN,Double.NaN);
        } catch (Exception e) {
            log.warn("[clip-quality] metrics unavailable; retaining output",e);
            return new Metrics(Double.NaN,Double.NaN,Double.NaN);
        }

        log.info("[clip-quality] file={} averageLuma={} integratedLufs={} truePeakDb={} maxTruePeakDb={}",
                video.getFileName(), luma, loudness, peak, props.getMaxTruePeakDb());

        if (luma < props.getMinAverageLuma()) {
            log.warn("[clip-quality] 成片画面过暗; retaining output: {}",metric("averageLuma", luma, props.getMinAverageLuma()));
        }
        if (luma > props.getMaxAverageLuma()) {
            log.warn("[clip-quality] 成片画面过亮; retaining output: {}",metric("averageLuma", luma, props.getMaxAverageLuma()));
        }
        if (loudness < props.getMinIntegratedLufs()) {
            log.warn("[clip-quality] 成片声音过轻; retaining output: {}",metric("integratedLufs", loudness, props.getMinIntegratedLufs()));
        }
        if (loudness > props.getMaxIntegratedLufs()) {
            log.warn("[clip-quality] 成片声音过响; retaining output: {}",metric("integratedLufs", loudness, props.getMaxIntegratedLufs()));
        }
        if (peak > props.getMaxTruePeakDb()) {
            log.warn("[clip-quality] 成片音频存在爆音风险; retaining output: {}",metric("truePeakDb", peak, props.getMaxTruePeakDb()));
        }
        return new Metrics(luma, loudness, peak);
    }

    static double averageLuma(String output) {
        Matcher matcher = LUMA.matcher(output == null ? "" : output);
        List<Double> samples = new ArrayList<>();
        while (matcher.find()) samples.add(Double.parseDouble(matcher.group(1)));
        if (samples.isEmpty()) throw qualityFailure("成片亮度结果缺失", "signalstats returned no YAVG samples");
        return samples.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
    }

    static double number(String output, Pattern pattern, String label) {
        Matcher matcher = pattern.matcher(output == null ? "" : output);
        if (!matcher.find()) throw qualityFailure("成片" + label + "结果缺失", "loudnorm output is incomplete");
        String raw = matcher.group(1).trim();
        if ("-inf".equalsIgnoreCase(raw) || "+inf".equalsIgnoreCase(raw) || "inf".equalsIgnoreCase(raw)) {
            throw qualityFailure("成片没有可用声音", label + "=" + raw);
        }
        try {
            double value = Double.parseDouble(raw);
            if (!Double.isFinite(value)) throw new NumberFormatException(raw);
            return value;
        } catch (NumberFormatException e) {
            throw qualityFailure("成片" + label + "结果非法", label + "=" + raw);
        }
    }

    private static String metric(String name, double actual, double threshold) {
        return String.format(Locale.ROOT, "%s=%.2f threshold=%.2f", name, actual, threshold);
    }

    private static BusinessException qualityFailure(String message, String detail) {
        return BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "CLIP_OUTPUT_QUALITY_FAILED", message, detail);
    }
}
