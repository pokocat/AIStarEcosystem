package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Caption;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.KnownClip;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.KnownLine;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Packaging;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 合成阶段决定字幕从哪来（2026-11-07）：手写的优先；要自动字幕时，有已知台词用台词，没有就从声音识别。
 * 这一步的失败不影响出片：成片照常合成，结果里如实带上 status，界面照此说明。
 */
@Service
public class StudioCaptionService {
    private static final Logger log = LoggerFactory.getLogger(StudioCaptionService.class);
    /** 手写字幕。 */
    public static final String MANUAL = "manual";
    /** 时间来自语音识别。 */
    public static final String RECOGNIZED = "recognized";
    /** 有台词，语音识别没配置或没对上，时间按镜头估算。 */
    public static final String ESTIMATED = "estimated";
    /** 本集没有台词。 */
    public static final String NO_LINES = "no_lines";
    /** 识别过了，没听到人声。 */
    public static final String NO_SPEECH = "no_speech";
    /** 语音识别不可用，又没有已知台词，这次没加字幕。 */
    public static final String UNAVAILABLE = "unavailable";

    public record Outcome(List<Caption> captions, String status) {}

    private static final String LANGUAGE_PROMPT = "以下是普通话的句子，使用简体中文。";

    private final StudioTranscriber transcriber;
    private final FfmpegRunner ffmpeg;

    public StudioCaptionService(StudioTranscriber transcriber, FfmpegRunner ffmpeg) {
        this.transcriber = transcriber;
        this.ffmpeg = ffmpeg;
    }

    /**
     * @param heard   成片里真正能听到的声音（配音或片段原声），可空
     * @param seconds 每个片段实际的秒数
     * @return 不要字幕时 null
     */
    public Outcome resolve(Packaging p, Path heard, List<Double> seconds, double total, int width, int height, Path work, String owner, String refId) {
        if (p == null) return null;
        if (p.captions() != null && !p.captions().isEmpty()) return new Outcome(p.captions(), MANUAL);
        if (!Boolean.TRUE.equals(p.autoCaptions())) return null;
        int maxChars = StudioCaptionAligner.maxChars(width, height);
        if (p.knownClips() != null && !p.knownClips().isEmpty()) return known(p.knownClips(), heard, seconds, maxChars, work, owner, refId);
        return recognize(heard, total, width, height, work, owner, refId);
    }

    /** 没有已知台词：字幕内容来自识别结果。 */
    public Outcome recognize(Path heard, double total, int width, int height, Path work, String owner, String refId) {
        Optional<List<StudioCaptionAligner.Segment>> found = heard == null ? Optional.empty() : hear(work.resolve("caption-all.wav"), heard, 0, -1, owner, refId);
        if (found.isEmpty()) return new Outcome(List.of(), UNAVAILABLE);
        List<Caption> captions = StudioCaptionAligner.fromHeard(found.get(), StudioCaptionAligner.maxChars(width, height), total);
        return new Outcome(captions, captions.isEmpty() ? NO_SPEECH : RECOGNIZED);
    }

    private Outcome known(List<KnownClip> clips, Path heard, List<Double> seconds, int maxChars, Path work, String owner, String refId) {
        boolean anyLine = clips.stream().anyMatch(c -> c.lines() != null && c.lines().stream().anyMatch(l -> l.text() != null && !l.text().isBlank()));
        if (!anyLine) return new Outcome(List.of(), NO_LINES);
        StudioCaptionAligner.Aligned aligned = StudioCaptionAligner.fromKnown(clips, seconds, hearEachClip(clips, heard, seconds, work, owner, refId), maxChars);
        return new Outcome(aligned.captions(), aligned.recognized() ? RECOGNIZED : ESTIMATED);
    }

    /**
     * 有已知台词时一段一段地识别：错了也只影响这一段，时间不会跨段（2026-11-07 用真 Whisper 实测：两段连着交过去，第一段的话整句丢了）。
     * 没台词的片段不识别，省一次调用。第一次调用就失败时不再往下试。不把台词当提示词传：模型会以为已经说过，反而不再转写（同一次实测）。
     *
     * @return 整条成片时间线上的识别结果；一段都没识别成就是 null
     */
    private List<StudioCaptionAligner.Segment> hearEachClip(List<KnownClip> clips, Path heard, List<Double> seconds, Path work, String owner, String refId) {
        if (heard == null) return null;
        List<StudioCaptionAligner.Segment> out = new ArrayList<>();
        boolean any = false;
        double offset = 0;
        for (int i = 0; i < clips.size(); i++) {
            double length = i < seconds.size() ? seconds.get(i) : 0;
            KnownClip clip = clips.get(i);
            if (length > 0 && clip.lines() != null && !clip.lines().isEmpty()) {
                Path piece = work.resolve("caption-clip-" + i + ".wav");
                Optional<List<StudioCaptionAligner.Segment>> found = hear(piece, heard, offset, length, owner, refId);
                if (found.isEmpty()) break;
                any = true;
                for (var s : found.get()) out.add(shift(s, offset));
            }
            offset += length;
        }
        return any ? out : null;
    }

    private static StudioCaptionAligner.Segment shift(StudioCaptionAligner.Segment s, double by) {
        List<StudioCaptionAligner.Segment> words = s.words() == null ? null : s.words().stream().map(w -> shift(w, by)).toList();
        return new StudioCaptionAligner.Segment(s.start() + by, s.end() + by, s.text(), words);
    }

    /** 取 media 里 [from, from + length) 的声音（length < 0 表示到结尾）转成 16 kHz 单声道去识别。 */
    private Optional<List<StudioCaptionAligner.Segment>> hear(Path wav, Path media, double from, double length, String owner, String refId) {
        List<String> args = new ArrayList<>(List.of("-y", "-v", "error", "-ss", String.valueOf(from), "-i", media.toString()));
        if (length >= 0) args.addAll(List.of("-t", String.valueOf(length)));
        args.addAll(List.of("-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav.toString()));
        try {
            ffmpeg.runFfmpeg(args);
        } catch (RuntimeException e) {
            // 比如片段本身没有音轨：说明听不到东西，不算语音识别坏了。
            return Optional.empty();
        }
        return transcriber.transcribe(wav, LANGUAGE_PROMPT, owner, refId).map(segments -> StudioCaptionAligner.fitToVoice(segments, silences(wav)));
    }

    private static final Pattern SILENCE = Pattern.compile("silence_(start|end): (-?[0-9.]+)");

    /** 静音区间；检测失败就当没有，只是时间少校正一步。 */
    private List<double[]> silences(Path wav) {
        List<double[]> out = new ArrayList<>();
        try {
            parseSilences(ffmpeg.runFfmpeg(List.of("-hide_banner", "-nostats", "-i", wav.toString(), "-af", "silencedetect=noise=-35dB:d=0.3", "-f", "null", "-")), out);
        } catch (RuntimeException e) {
            log.warn("[studio-caption] 静音检测失败: {}", e.toString());
        }
        return out;
    }

    static void parseSilences(String log, List<double[]> out) {
        Matcher m = SILENCE.matcher(log);
        double started = -1;
        while (m.find()) {
            double t = Double.parseDouble(m.group(2));
            if ("start".equals(m.group(1))) started = Math.max(0, t);
            else if (started >= 0) { out.add(new double[]{started, t}); started = -1; }
        }
    }
}
