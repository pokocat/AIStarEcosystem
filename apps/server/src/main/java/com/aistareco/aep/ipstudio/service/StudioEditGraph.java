package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditCaption;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditMedia;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditOverlay;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditText;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditTimeline;
import com.aistareco.common.BusinessException;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 成片高级编辑的 FFmpeg 合成图（2026-10-19，2026-11-07 加变速、淡入淡出、调色、画中画和贴图）：纯函数，不碰文件系统，便于测试。
 *
 * <ul>
 *   <li>视频：所有视频片段按开始时间排成一条主轨，片段之间的空隙补黑；后开始的片段截断前一段。
 *       每段按素材里的起点 from 截取，缩放加黑边到成片画幅，统一 30fps。speed 是播放速度，淡入淡出是从黑到画面。</li>
 *   <li>画中画和贴图：叠在主轨上面，按相对画面中心的位置和显示尺寸摆放，只在自己的时间段显示。</li>
 *   <li>声音：每段视频的原声（音量为 0 就不要）和每条音频按成片时间延后，补静音到成片总长，再一起混音。
 *       amix 会按路数平均，所以混完乘回路数（不用 4.4 才有的 normalize=0，线上 ffmpeg 版本不保证），最后统一响度。</li>
 *   <li>文字、字幕：由调用方画成透明 PNG，按出现时间叠上去（用户文字不进滤镜语法）。</li>
 * </ul>
 *
 * <p>只用 FFmpeg 4.0 就有的滤镜（线上共享的 ffmpeg 是 2018 版），所以没用 xfade。
 */
public final class StudioEditGraph {
    public static final int FPS = 30;
    public static final double MAX_SECONDS = 600;
    public static final double MIN_SPEED = 0.5, MAX_SPEED = 2;
    public static final double MAX_FADE = 3;
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final String STEREO = "aformat=sample_fmts=fltp:channel_layouts=stereo";
    // loudnorm 之后再定一次采样率和声道：旧版 ffmpeg（线上 2018 版、Ubuntu 18.04 的 3.4）loudnorm 不带声道布局，后面的 atrim / sidechaincompress 会报 Cannot select channel layout（2026-11-07 用 3.4 实跑发现，8.x 没这个问题）。
    private static final String LOUDNESS = "loudnorm=I=-16:TP=-2.5:LRA=11,aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
    /**
     * 调色预设：名字和 Twick 的 mediaFilter 一致（编辑器里预览用它），数值按它的 CSS 滤镜换算（@twick/visualizer helpers/filters.ts）。
     * CSS 的 brightness 是乘法，eq 的 brightness 是加法，所以亮度用 colorchannelmixer。
     */
    private static final Map<String, String> LOOKS = Map.of(
            "saturated", "eq=contrast=1.1:saturation=1.4",
            "bright", "eq=contrast=1.05,colorchannelmixer=rr=1.3:gg=1.3:bb=1.3",
            "black_white", "hue=s=0,eq=contrast=1.25,colorchannelmixer=rr=1.05:gg=1.05:bb=1.05",
            "warm", "hue=h=-15:s=1.3,eq=contrast=1.05,colorchannelmixer=rr=1.15:gg=1.15:bb=1.15",
            "cool", "hue=h=15:s=1.3,eq=contrast=1.05,colorchannelmixer=rr=1.1:gg=1.1:bb=1.1");

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
        if (e.overlays() != null && e.overlays().size() > 12) throw bad("一次最多 12 个小窗和图片");
        for (EditMedia m : clips) media(m);
        for (EditMedia m : audios) media(m);
        if (e.overlays() != null) for (EditOverlay o : e.overlays()) overlay(o, w, h);
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
        speed(m.speed());
        double length = m.end() - m.start();
        fade(m.fadeIn(), length);
        fade(m.fadeOut(), length);
        if (m.look() != null && !m.look().isBlank() && !LOOKS.containsKey(m.look())) throw bad("调色效果不正确");
    }

    private static void overlay(EditOverlay o, int w, int h) {
        if (o == null || o.storageKey() == null || o.storageKey().isBlank()) throw bad("有一个小窗或图片没有存储位置");
        if (!"video".equals(o.kind()) && !"image".equals(o.kind())) throw bad("小窗类型不正确");
        window(o.start(), o.end());
        if (!finite(o.x()) || !finite(o.y()) || Math.abs(o.x()) > w || Math.abs(o.y()) > h) throw bad("小窗位置不正确");
        if (!finite(o.width()) || !finite(o.height()) || o.width() < 16 || o.height() < 16 || o.width() > 2 * w || o.height() > 2 * h) throw bad("小窗大小不正确");
        if (o.from() != null && (!finite(o.from()) || o.from() < 0)) throw bad("素材起点不正确");
        if (o.volume() != null && (!finite(o.volume()) || o.volume() < 0 || o.volume() > 2)) throw bad("音量要在 0 到 200% 之间");
        speed(o.speed());
    }

    private static void speed(Double v) {
        if (v != null && (!finite(v) || v < MIN_SPEED || v > MAX_SPEED)) throw bad("播放速度要在 0.5 到 2 倍之间");
    }

    private static void fade(Double v, double length) {
        if (v != null && (!finite(v) || v < 0 || v > MAX_FADE || v > length)) throw bad("淡入淡出的时间不正确");
    }

    private static void window(Double start, Double end) {
        if (!finite(start) || !finite(end) || start < 0 || end <= start || end > MAX_SECONDS) throw bad("时间范围不正确");
    }

    /** 成片总长：所有元素里最晚的结束时间。 */
    public static double total(EditTimeline e) {
        double t = 0;
        for (EditMedia m : list(e.clips())) t = Math.max(t, m.end());
        for (EditMedia m : list(e.audios())) t = Math.max(t, m.end());
        for (EditOverlay o : list(e.overlays())) t = Math.max(t, o.end());
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
            if (end - c.start() > 0.0005) out.add(new EditMedia(c.storageKey(), c.start(), end, c.from(), c.volume(), c.speed(), c.fadeIn(), c.fadeOut(), c.look()));
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
        return args(width, height, total, clips, clipFiles, clipAudio, audios, audioFiles, overlays, List.of(), List.of(), List.of(), null, out);
    }

    /**
     * @param pips         画中画和贴图，叠在主轨和文字之间
     * @param pipFiles     与 pips 一一对应的本地文件
     * @param pipAudio     与 pips 一一对应：素材里有没有音轨
     * @param captionTrack 所有字幕合成的一路透明画面（{@link StudioPackagingService#captionTrack}），可空
     */
    public static List<String> args(int width, int height, double total, List<EditMedia> clips, List<Path> clipFiles, List<Boolean> clipAudio,
                                    List<EditMedia> audios, List<Path> audioFiles, List<Overlay> overlays,
                                    List<EditOverlay> pips, List<Path> pipFiles, List<Boolean> pipAudio, Path captionTrack, Path out) {
        List<String> a = new ArrayList<>(List.of("-v", "error", "-nostdin", "-y", "-threads", "2"));
        a.addAll(List.of("-f", "lavfi", "-t", f(total), "-i", "anullsrc=r=48000:cl=stereo"));
        int next = 1;
        int[] clipIn = new int[clips.size()], audioIn = new int[audios.size()], overlayIn = new int[overlays.size()], pipIn = new int[pips.size()];
        for (int i = 0; i < clips.size(); i++) {
            EditMedia c = clips.get(i);
            a.addAll(List.of("-ss", f(c.from()), "-t", f(sourceSeconds(c)), "-i", clipFiles.get(i).toString()));
            clipIn[i] = next++;
        }
        for (int i = 0; i < audios.size(); i++) {
            EditMedia m = audios.get(i);
            a.addAll(List.of("-ss", f(m.from()), "-t", f(sourceSeconds(m)), "-i", audioFiles.get(i).toString()));
            audioIn[i] = next++;
        }
        for (int i = 0; i < pips.size(); i++) {
            EditOverlay o = pips.get(i);
            if ("image".equals(o.kind())) a.addAll(List.of("-loop", "1", "-framerate", String.valueOf(FPS), "-t", f(total), "-i", pipFiles.get(i).toString()));
            else a.addAll(List.of("-ss", f(from(o)), "-t", f((o.end() - o.start()) * rate(o.speed())), "-i", pipFiles.get(i).toString()));
            pipIn[i] = next++;
        }
        for (int i = 0; i < overlays.size(); i++) {
            a.addAll(List.of("-loop", "1", "-framerate", String.valueOf(FPS), "-t", f(total), "-i", overlays.get(i).png().toString()));
            overlayIn[i] = next++;
        }
        int captionIn = -1;
        if (captionTrack != null) {
            a.addAll(List.of("-f", "concat", "-safe", "0", "-i", captionTrack.toString()));
            captionIn = next++;
        }

        StringBuilder g = new StringBuilder();
        List<String> segments = new ArrayList<>();
        double at = 0;
        int gaps = 0;
        String size = width + ":" + height;
        for (int i = 0; i < clips.size(); i++) {
            EditMedia c = clips.get(i);
            if (c.start() - at > 0.0005) segments.add(gap(g, gaps++, c.start() - at, width, height));
            double length = c.end() - c.start();
            g.append('[').append(clipIn[i]).append(":v]trim=duration=").append(f(sourceSeconds(c))).append(",setpts=").append(setpts(c.speed()))
                    .append(",scale=").append(size).append(":force_original_aspect_ratio=decrease,pad=")
                    .append(size).append(":(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=").append(FPS);
            String look = c.look() == null ? null : LOOKS.get(c.look());
            if (look != null) g.append(',').append(look);
            g.append(",format=yuv420p");
            if (positive(c.fadeIn())) g.append(",fade=t=in:st=0:d=").append(f(c.fadeIn()));
            if (positive(c.fadeOut())) g.append(",fade=t=out:st=").append(f(Math.max(0, length - c.fadeOut()))).append(":d=").append(f(c.fadeOut()));
            g.append("[s").append(i).append("];");
            segments.add("[s" + i + "]");
            at = c.end();
        }
        if (total - at > 0.0005) segments.add(gap(g, gaps, total - at, width, height));
        g.append(String.join("", segments)).append("concat=n=").append(segments.size()).append(":v=1:a=0[v0];");
        String video = "[v0]";
        int layer = 0;
        for (int i = 0; i < pips.size(); i++) {
            EditOverlay o = pips.get(i);
            int w = even(o.width()), h = even(o.height());
            g.append('[').append(pipIn[i]).append(":v]");
            if ("image".equals(o.kind())) g.append("scale=").append(w).append(':').append(h);
            else g.append("trim=duration=").append(f((o.end() - o.start()) * rate(o.speed()))).append(",setpts=(PTS-STARTPTS)/").append(f(rate(o.speed())))
                    .append("+").append(f(o.start())).append("/TB,scale=").append(w).append(':').append(h);
            g.append(",format=rgba[p").append(i).append("];");
            layer++;
            g.append(video).append("[p").append(i).append("]overlay=").append(f((width - w) / 2.0 + o.x())).append(':').append(f((height - h) / 2.0 + o.y()))
                    .append(":eof_action=pass:enable='between(t,").append(f(o.start())).append(",").append(f(o.end())).append(")'[v").append(layer).append("];");
            video = "[v" + layer + "]";
        }
        for (int i = 0; i < overlays.size(); i++) {
            Overlay o = overlays.get(i);
            layer++;
            g.append(video).append('[').append(overlayIn[i]).append(":v]overlay=0:0:enable='between(t,")
                    .append(f(o.start())).append(",").append(f(o.end())).append(")'[v").append(layer).append("];");
            video = "[v" + layer + "]";
        }
        if (captionIn >= 0) {
            layer++;
            g.append('[').append(captionIn).append(":v]fps=").append(FPS).append(",format=rgba[ct];")
                    .append(video).append("[ct]overlay=0:0:eof_action=pass[v").append(layer).append("];");
            video = "[v" + layer + "]";
        }

        List<String> mix = new ArrayList<>(List.of("[a]"));
        g.append("[0:a]").append(STEREO).append("[a];");
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
        for (int i = 0; i < pips.size(); i++) {
            EditOverlay o = pips.get(i);
            if ("image".equals(o.kind()) || !pipAudio.get(i) || o.volume() == null || o.volume() <= 0) continue;
            g.append(audio(pipIn[i], new EditMedia(o.storageKey(), o.start(), o.end(), from(o), o.volume(), o.speed(), null, null, null), total, "p" + i + "a"));
            mix.add("[p" + i + "a]");
        }
        if (mix.size() == 1) g.append("[a]anull[aout]");
        else g.append(String.join("", mix)).append("amix=inputs=").append(mix.size())
                .append(":duration=first:dropout_transition=0,volume=").append(mix.size()).append(',').append(LOUDNESS).append(",atrim=0:").append(f(total)).append("[aout]");

        a.addAll(List.of("-filter_complex", g.toString(), "-map", video, "-map", "[aout]", "-t", f(total),
                "-r", String.valueOf(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out.toString()));
        return a;
    }

    /** 这一段要用掉素材里的多少秒：快放用得多，慢放用得少。 */
    private static double sourceSeconds(EditMedia m) { return (m.end() - m.start()) * rate(m.speed()); }
    private static double rate(Double speed) { return speed == null || speed <= 0 ? 1 : speed; }
    private static double from(EditOverlay o) { return o.from() == null ? 0 : o.from(); }
    private static boolean positive(Double v) { return v != null && v > 0; }
    private static String setpts(Double speed) { return rate(speed) == 1 ? "PTS-STARTPTS" : "(PTS-STARTPTS)/" + f(rate(speed)); }
    private static int even(double v) { return Math.max(2, (int) Math.round(v / 2) * 2); }

    private static String gap(StringBuilder g, int n, double seconds, int width, int height) {
        g.append("color=c=black:s=").append(width).append('x').append(height).append(":r=").append(FPS)
                .append(":d=").append(f(seconds)).append(",format=yuv420p,setsar=1[g").append(n).append("];");
        return "[g" + n + "]";
    }

    /** 一路声音：截到片段长度，从成片的 start 开始，补静音到总长（所有路等长，amix 的平均系数才是常数）。 */
    private static String audio(int input, EditMedia m, double total, String label) {
        long delay = Math.round(m.start() * 1000);
        double length = m.end() - m.start();
        StringBuilder s = new StringBuilder("[").append(input).append(":a]atrim=duration=").append(f(sourceSeconds(m))).append(",asetpts=PTS-STARTPTS,");
        if (rate(m.speed()) != 1) s.append("atempo=").append(f(rate(m.speed()))).append(',');
        s.append("aresample=48000,").append(STEREO).append(",volume=").append(f(m.volume()));
        if (positive(m.fadeIn())) s.append(",afade=t=in:st=0:d=").append(f(m.fadeIn()));
        if (positive(m.fadeOut())) s.append(",afade=t=out:st=").append(f(Math.max(0, length - m.fadeOut()))).append(":d=").append(f(m.fadeOut()));
        return s.append(",adelay=").append(delay).append('|').append(delay).append(",apad,atrim=0:").append(f(total)).append('[').append(label).append("];").toString();
    }

    private static <T> List<T> list(List<T> v) { return v == null ? List.of() : v; }
    private static boolean finite(Double v) { return v != null && Double.isFinite(v); }
    private static String f(double v) { return String.format(Locale.ROOT, "%.3f", v); }
    private static BusinessException bad(String message) { return BusinessException.badRequest("STUDIO_EDIT_INVALID", message); }
}
