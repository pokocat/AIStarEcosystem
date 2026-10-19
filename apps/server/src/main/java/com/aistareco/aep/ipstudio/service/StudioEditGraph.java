package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditCaption;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditMedia;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditText;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditTimeline;
import com.aistareco.common.BusinessException;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 成片高级编辑（2026-10-19）的 FFmpeg 合成图：纯函数，不碰文件系统，便于测试。
 *
 * <p>做法刻意简单，只覆盖基础剪辑：
 * <ul>
 *   <li>视频：所有视频片段按开始时间排成一条主轨，片段之间的空隙补黑；后开始的片段截断前一段（不做画中画）。
 *       每段按素材里的起点 from 截取，缩放加黑边到成片画幅，统一 30fps。</li>
 *   <li>声音：每段视频的原声（音量为 0 就不要）和每条音频按成片时间延后，补静音到成片总长，再一起混音。
 *       amix 会按路数平均，所以混完乘回路数（不用 4.4 才有的 normalize=0，线上 ffmpeg 版本不保证）。</li>
 *   <li>文字、字幕：由调用方画成整幅透明 PNG，按出现时间叠上去（用户文字不进滤镜语法）。</li>
 * </ul>
 */
public final class StudioEditGraph {
    public static final int FPS = 30;
    public static final double MAX_SECONDS = 600;
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private StudioEditGraph() {}

    /** 一层叠加：整幅 PNG 与它出现的时间。 */
    public record Overlay(Path png, double start, double end) {}

    public static void validate(EditTimeline e) {
        if (e == null) throw bad("剪辑内容是空的");
        int w = e.width() == null ? 0 : e.width(), h = e.height() == null ? 0 : e.height();
        if (w < 320 || h < 320 || w > 1920 || h > 1920 || w % 2 != 0 || h % 2 != 0) throw bad("成片画幅不正确");
        List<EditMedia> clips = e.clips() == null ? List.of() : e.clips();
        List<EditMedia> audios = e.audios() == null ? List.of() : e.audios();
        if (clips.isEmpty()) throw bad("时间线上至少要有一段视频");
        if (clips.size() > 60) throw bad("一次最多 60 段视频");
        if (audios.size() > 20) throw bad("一次最多 20 条音频");
        if (e.texts() != null && e.texts().size() > 30) throw bad("一次最多 30 段文字");
        if (e.captions() != null && e.captions().size() > 200) throw bad("一次最多 200 条字幕");
        for (EditMedia m : clips) media(m);
        for (EditMedia m : audios) media(m);
        if (e.texts() != null) for (EditText t : e.texts()) {
            window(t.start(), t.end());
            if (t.text() == null || t.text().isBlank() || t.text().length() > 120) throw bad("文字不能为空，最多 120 字");
            if (t.fontSize() == null || t.fontSize() < 12 || t.fontSize() > 200) throw bad("字号要在 12 到 200 之间");
            if (t.color() != null && !COLOR.matcher(t.color()).matches()) throw bad("文字颜色不正确");
            if (!finite(t.x()) || !finite(t.y()) || Math.abs(t.x()) > w || Math.abs(t.y()) > h) throw bad("文字位置不正确");
        }
        if (e.captions() != null) for (EditCaption c : e.captions()) {
            window(c.start(), c.end());
            if (c.text() == null || c.text().isBlank() || c.text().length() > 80) throw bad("字幕不能为空，最多 80 字");
        }
        if (total(e) > MAX_SECONDS) throw bad("成片最长 10 分钟");
    }

    private static void media(EditMedia m) {
        if (m == null || m.storageKey() == null || m.storageKey().isBlank()) throw bad("有一段素材没有存储位置");
        window(m.start(), m.end());
        if (!finite(m.from()) || m.from() < 0) throw bad("素材起点不正确");
        if (!finite(m.volume()) || m.volume() < 0 || m.volume() > 2) throw bad("音量要在 0 到 200% 之间");
    }

    private static void window(Double start, Double end) {
        if (!finite(start) || !finite(end) || start < 0 || end <= start || end > MAX_SECONDS) throw bad("时间范围不正确");
    }

    /** 成片总长：所有元素里最晚的结束时间。 */
    public static double total(EditTimeline e) {
        double t = 0;
        for (EditMedia m : list(e.clips())) t = Math.max(t, m.end());
        for (EditMedia m : list(e.audios())) t = Math.max(t, m.end());
        for (EditText x : list(e.texts())) t = Math.max(t, x.end());
        for (EditCaption c : list(e.captions())) t = Math.max(t, c.end());
        return t;
    }

    /** 主轨：按开始时间排，后开始的截断前一段。 */
    public static List<EditMedia> sequence(List<EditMedia> clips) {
        List<EditMedia> sorted = new ArrayList<>(list(clips));
        sorted.sort(Comparator.comparingDouble(EditMedia::start));
        List<EditMedia> out = new ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            EditMedia c = sorted.get(i);
            double end = c.end();
            if (i + 1 < sorted.size()) end = Math.min(end, sorted.get(i + 1).start());
            if (end - c.start() > 0.0005) out.add(new EditMedia(c.storageKey(), c.start(), end, c.from(), c.volume()));
        }
        return out;
    }

    /**
     * @param clips       {@link #sequence} 的结果
     * @param clipFiles   与 clips 一一对应的本地文件
     * @param clipAudio   与 clips 一一对应：素材里有没有音轨
     * @param audios      音频元素
     * @param audioFiles  与 audios 一一对应
     */
    public static List<String> args(int width, int height, double total, List<EditMedia> clips, List<Path> clipFiles, List<Boolean> clipAudio,
                                    List<EditMedia> audios, List<Path> audioFiles, List<Overlay> overlays, Path out) {
        List<String> a = new ArrayList<>(List.of("-v", "error", "-nostdin", "-y", "-threads", "2"));
        a.addAll(List.of("-f", "lavfi", "-t", f(total), "-i", "anullsrc=r=48000:cl=stereo"));
        int next = 1;
        int[] clipIn = new int[clips.size()], audioIn = new int[audios.size()], overlayIn = new int[overlays.size()];
        for (int i = 0; i < clips.size(); i++) {
            EditMedia c = clips.get(i);
            a.addAll(List.of("-ss", f(c.from()), "-t", f(c.end() - c.start()), "-i", clipFiles.get(i).toString()));
            clipIn[i] = next++;
        }
        for (int i = 0; i < audios.size(); i++) {
            EditMedia m = audios.get(i);
            a.addAll(List.of("-ss", f(m.from()), "-t", f(m.end() - m.start()), "-i", audioFiles.get(i).toString()));
            audioIn[i] = next++;
        }
        for (int i = 0; i < overlays.size(); i++) {
            a.addAll(List.of("-loop", "1", "-framerate", String.valueOf(FPS), "-t", f(total), "-i", overlays.get(i).png().toString()));
            overlayIn[i] = next++;
        }

        StringBuilder g = new StringBuilder();
        List<String> segments = new ArrayList<>();
        double at = 0;
        int gaps = 0;
        String size = width + ":" + height;
        for (int i = 0; i < clips.size(); i++) {
            EditMedia c = clips.get(i);
            if (c.start() - at > 0.0005) segments.add(gap(g, gaps++, c.start() - at, width, height));
            g.append('[').append(clipIn[i]).append(":v]trim=duration=").append(f(c.end() - c.start()))
                    .append(",setpts=PTS-STARTPTS,scale=").append(size).append(":force_original_aspect_ratio=decrease,pad=")
                    .append(size).append(":(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=").append(FPS).append(",format=yuv420p[s").append(i).append("];");
            segments.add("[s" + i + "]");
            at = c.end();
        }
        if (total - at > 0.0005) segments.add(gap(g, gaps, total - at, width, height));
        g.append(String.join("", segments)).append("concat=n=").append(segments.size()).append(":v=1:a=0[v0];");
        String video = "[v0]";
        for (int i = 0; i < overlays.size(); i++) {
            Overlay o = overlays.get(i);
            g.append(video).append('[').append(overlayIn[i]).append(":v]overlay=0:0:enable='between(t,")
                    .append(f(o.start())).append(",").append(f(o.end())).append(")'[v").append(i + 1).append("];");
            video = "[v" + (i + 1) + "]";
        }

        List<String> mix = new ArrayList<>(List.of("[a]"));
        g.append("[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo[a];");
        for (int i = 0; i < clips.size(); i++) {
            EditMedia c = clips.get(i);
            if (!clipAudio.get(i) || c.volume() <= 0) continue;
            g.append(audio(clipIn[i], c, total, "c" + i));
            mix.add("[c" + i + "]");
        }
        for (int i = 0; i < audios.size(); i++) {
            EditMedia m = audios.get(i);
            if (m.volume() <= 0) continue;
            g.append(audio(audioIn[i], m, total, "m" + i));
            mix.add("[m" + i + "]");
        }
        if (mix.size() == 1) g.append("[a]anull[aout]");
        else g.append(String.join("", mix)).append("amix=inputs=").append(mix.size())
                .append(":duration=first:dropout_transition=0,volume=").append(mix.size()).append("[aout]");

        a.addAll(List.of("-filter_complex", g.toString(), "-map", video, "-map", "[aout]", "-t", f(total),
                "-r", String.valueOf(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out.toString()));
        return a;
    }

    private static String gap(StringBuilder g, int n, double seconds, int width, int height) {
        g.append("color=c=black:s=").append(width).append('x').append(height).append(":r=").append(FPS)
                .append(":d=").append(f(seconds)).append(",format=yuv420p,setsar=1[g").append(n).append("];");
        return "[g" + n + "]";
    }

    /** 一路声音：截到片段长度，从成片的 start 开始，补静音到总长（所有路等长，amix 的平均系数才是常数）。 */
    private static String audio(int input, EditMedia m, double total, String label) {
        long delay = Math.round(m.start() * 1000);
        return "[" + input + ":a]atrim=duration=" + f(m.end() - m.start()) + ",asetpts=PTS-STARTPTS,aresample=48000,"
                + "aformat=sample_fmts=fltp:channel_layouts=stereo,volume=" + f(m.volume()) + ",adelay=" + delay + "|" + delay
                + ",apad,atrim=0:" + f(total) + "[" + label + "];";
    }

    private static <T> List<T> list(List<T> v) { return v == null ? List.of() : v; }
    private static boolean finite(Double v) { return v != null && Double.isFinite(v); }
    private static String f(double v) { return String.format(Locale.ROOT, "%.3f", v); }
    private static BusinessException bad(String message) { return BusinessException.badRequest("STUDIO_EDIT_INVALID", message); }
}
