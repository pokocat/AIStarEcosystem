package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Packaging;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.picgen.FontRegistry;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import java.awt.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** User text is rasterized locally; it never becomes shell or ffmpeg filter syntax. */
@Service
public class StudioPackagingService {
    /** 一键成片的字幕上限，和成片高级编辑一致。 */
    public static final int MAX_CAPTIONS=200;
    /** 处理后的响度（与配音一致）：-16 LUFS 是短视频平台的常见水平，-2.5 dBTP 给 AAC 编码回弹留余量（v0.135）。 */
    // loudnorm 之后再定一次采样率和声道：旧版 ffmpeg（线上 2018 版、Ubuntu 18.04 的 3.4）loudnorm 不带声道布局，后面的 atrim / sidechaincompress 会报 Cannot select channel layout（2026-11-07 用 3.4 实跑发现，8.x 没这个问题）。
    private static final String LOUDNESS="loudnorm=I=-16:TP=-2.5:LRA=11,aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
    /** 背景音乐先压到这个响度，比人声低一截，说话时再自动压低。 */
    private static final String MUSIC_LOUDNESS="loudnorm=I=-27:TP=-6:LRA=11,aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
    private static final String STEREO="aformat=sample_fmts=fltp:channel_layouts=stereo";
    /** 片段接缝处的淡入淡出（秒）：很短，听不出来，但能去掉波形突变带来的「啪」声。 */
    private static final double SEAM=0.015;
    private final FfmpegRunner ffmpeg;private final FontRegistry fonts;
    public StudioPackagingService(FfmpegRunner ffmpeg,FontRegistry fonts) {this.ffmpeg=ffmpeg;this.fonts=fonts;}
    public static void validate(Packaging value) {
        if(value==null)return;
        text(value.brand(),60);text(value.title(),120);text(value.cta(),100);
        if(value.captions()!=null) {
            if(value.captions().size()>MAX_CAPTIONS)fail("一次最多添加 "+MAX_CAPTIONS+" 条字幕");
            double last=0;
            for(var cue:value.captions()) {
                if(cue==null || cue.start()==null || cue.end()==null || !Double.isFinite(cue.start()) || !Double.isFinite(cue.end()) || cue.start()<last || cue.end()<=cue.start() || cue.end()>600)fail("字幕时间范围不正确或存在重叠");
                text(cue.text(),160);if(cue.text()==null||cue.text().isBlank())fail("字幕不能为空");last=cue.end();
            }
        }
        if(value.quality()!=null&&!Set.of("720p","1080p").contains(value.quality()))fail("清晰度只能选 720P 或 1080P");
        if(value.knownClips()!=null) {
            if(value.knownClips().size()>60)fail("一次最多 60 段视频");
            for(var clip:value.knownClips())if(clip==null||clip.lines()!=null&&clip.lines().size()>200)fail("每段台词太多，无法生成字幕");
        }
        if(blank(value.brand())&&blank(value.title())&&blank(value.cta())&&(value.captions()==null||value.captions().isEmpty())&&blank(value.voiceoverStorageKey())
                &&!Boolean.TRUE.equals(value.autoCaptions())&&blank(value.musicStorageKey())&&blank(value.quality()))fail("请填写品牌文字、字幕或选择配音");
    }
    /**
     * Run before the clips are spliced, against the planned length (sum of the probed clips). It rejects only what
     * {@link #decorate} would certainly reject after a full splice: the result may come out up to {@code slack} seconds
     * longer than planned and still pass the assembly quality gate, so the same limits are applied to planned + slack.
     */
    public void precheck(Packaging value,Path audio,double plannedSec,double slack) {
        validate(value);if(value==null)return;
        checkCaptions(value,plannedSec+slack);
        if(audio!=null)checkSpeech(ffmpeg.probeMedia(audio.toFile()),plannedSec+slack);
    }
    public Path decorate(Path source,Path work,Packaging value) throws Exception {
        return decorate(source,work,value,null);
    }
    public Path decorate(Path source,Path work,Packaging value,Path audio) throws Exception {
        return finish(source,work,value,audio,null,null,value==null?null:value.captions());
    }
    /**
     * 成片的最后一道：叠品牌文字和字幕、统一响度、混背景音乐。画面最多编码一次。
     *
     * @param speech   配音，有它就替换片段原声
     * @param clean    {@link #cleanClipAudio} 处理过的片段原声，可空（空就用 source 里的声音）
     * @param music    背景音乐，可空；说话时自动压低
     * @param captions 要烧进画面的字幕
     */
    public Path finish(Path source,Path work,Packaging value,Path speech,Path clean,Path music,List<com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Caption> captions) throws Exception {
        validate(value);var probe=ffmpeg.probeMedia(source.toFile());
        int width=probe.width(),height=probe.height();double duration=probe.durationSec();
        if(!probe.readable()||width<1||height<1||duration<=0)fail("包装来源视频无法读取");
        if(value!=null)checkCaptions(value,duration);
        boolean hasBrand=value!=null&&(!blank(value.brand())||!blank(value.title())||!blank(value.cta()));
        boolean hasCaptions=captions!=null&&!captions.isEmpty();
        // Render video separately. With sparse subtitle timestamps and audio filters in the same
        // graph, FFmpeg 6 can buffer decoded video frames while it waits for the audio timeline.
        Path picture=hasBrand||hasCaptions ? renderPicture(source,work,probe,hasBrand?value:null,captions,false) : source;
        List<String> args=new ArrayList<>(List.of("-y","-i",source.toString()));
        int next=1;
        String video="0:v";
        if(!picture.equals(source)) {
            args.addAll(List.of("-i",picture.toString()));
            video=next++ + ":v";
        }
        StringBuilder filter=new StringBuilder();
        String main=null;
        if(speech!=null) {
            checkSpeech(ffmpeg.probeMedia(speech.toFile()),duration);
            args.addAll(List.of("-i",speech.toString()));main="["+next+":a]";next++;
        } else if(clean!=null) {
            args.addAll(List.of("-i",clean.toString()));main="["+next+":a]";next++;
        } else if(probe.hasAudio()) main="[0:a]";
        String audio=null;
        if(main!=null) {
            filter.append(main).append("aresample=48000,").append(STEREO).append(",").append(LOUDNESS).append(",apad,atrim=0:").append(num(duration)).append(",asetpts=PTS-STARTPTS[main];");
            audio="[main]";
        }
        if(music!=null) {
            var heard=ffmpeg.probeMedia(music.toFile());
            if(!heard.readable()||!heard.hasAudio()||heard.durationSec()<=0)fail("背景音乐无法读取，请换一首");
            args.addAll(List.of("-stream_loop","-1","-i",music.toString()));
            double fadeAt=Math.max(0,duration-1.5);
            filter.append("[").append(next).append(":a]aresample=48000,").append(STEREO).append(",").append(MUSIC_LOUDNESS).append(",atrim=0:").append(num(duration))
                    .append(",asetpts=PTS-STARTPTS,afade=t=out:st=").append(num(fadeAt)).append(":d=").append(num(Math.min(1.5,duration))).append("[bgm];");
            next++;
            if(audio==null)audio="[bgm]";
            else {
                // 说话时音乐压低：人声作为侧链去压音乐，再和人声混合。amix 按路数平均，混完乘回来（旧版 ffmpeg 没有 normalize=0）。
                filter.append("[main]asplit=2[say][key];[bgm][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[duck];")
                        .append("[say][duck]amix=inputs=2:duration=first:dropout_transition=0,volume=2,alimiter=limit=0.89[mixed];");
                audio="[mixed]";
            }
        }
        Path out=work.resolve("studio-packaged.mp4");
        if(filter.length()>0)args.addAll(List.of("-filter_complex_threads","1","-filter_complex",filter.substring(0,filter.length()-1)));
        args.addAll(List.of("-map",video));
        if(audio!=null)args.addAll(List.of("-map",audio));
        args.addAll(List.of("-t",Double.toString(duration)));
        args.addAll(List.of("-c:v","copy"));
        if(audio!=null)args.addAll(List.of("-c:a","aac","-b:a","192k","-ar","48000","-ac","2"));
        args.addAll(List.of("-movflags","+faststart",out.toString()));
        ffmpeg.runFfmpeg(args);return out;
    }
    /**
     * 把每个片段的原声处理好再拼起来：长度对齐片段（声音比画面短的补静音，后面的才不会错位），接缝处做很短的淡入淡出。
     * @return 16 位 WAV；所有片段都没有声音时 null
     */
    public Path cleanClipAudio(List<Path> clips,List<FfmpegRunner.MediaProbe> probes,Path work) {
        if(clips.size()!=probes.size())throw new IllegalArgumentException("clips/probes 数量不一致");
        if(probes.stream().noneMatch(FfmpegRunner.MediaProbe::hasAudio))return null;
        List<String> args=new ArrayList<>(List.of("-y","-v","error"));
        for(Path clip:clips)args.addAll(List.of("-i",clip.toString()));
        StringBuilder g=new StringBuilder(),in=new StringBuilder();
        for(int i=0;i<clips.size();i++) {
            var p=probes.get(i);double d=p.durationSec();
            if(p.hasAudio())g.append("[").append(i).append(":a]aresample=48000,").append(STEREO).append(",apad,");
            else g.append("anullsrc=r=48000:cl=stereo,").append(STEREO).append(",");
            g.append("atrim=0:").append(num(d)).append(",asetpts=PTS-STARTPTS,afade=t=in:st=0:d=").append(num(SEAM))
                    .append(",afade=t=out:st=").append(num(Math.max(0,d-SEAM))).append(":d=").append(num(SEAM)).append("[a").append(i).append("];");
            in.append("[a").append(i).append("]");
        }
        g.append(in).append("concat=n=").append(clips.size()).append(":v=0:a=1[aout]");
        Path out=work.resolve("studio-clean.wav");
        args.addAll(List.of("-filter_complex",g.toString(),"-map","[aout]","-c:a","pcm_s16le",out.toString()));
        ffmpeg.runFfmpeg(args);return out;
    }
    /** 把字幕叠到已经合成好的片子上（成片高级编辑导出时自动生成字幕用），声音不动。 */
    public Path burnCaptions(Path source,Path work,List<com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Caption> captions) throws Exception {
        return renderPicture(source,work,ffmpeg.probeMedia(source.toFile()),null,captions,true);
    }

    private Path renderPicture(Path source,Path work,FfmpegRunner.MediaProbe probe,Packaging brand,
                               List<com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Caption> captions,boolean copyAudio) throws Exception {
        List<String> args=new ArrayList<>(List.of("-y","-filter_complex_threads","1","-threads:v","2","-i",source.toString()));
        StringBuilder filter=new StringBuilder("[0:v]setsar=1[v0]");
        String video="[v0]";
        int next=1;
        if(brand!=null) {
            Path base=work.resolve("studio-brand.png");
            ImageIO.write(overlay(probe.width(),probe.height(),brand.brand(),brand.title(),brand.cta(),null),"png",base.toFile());
            args.addAll(List.of("-loop","1","-threads:v","1","-i",base.toString()));
            filter.append(';').append(video).append('[').append(next++).append(":v]overlay=0:0[v1]");
            video="[v1]";
        }
        if(captions!=null&&!captions.isEmpty()) {
            Path track=captionTrack(work,captions,probe.width(),probe.height(),probe.durationSec());
            args.addAll(List.of("-f","concat","-safe","0","-threads:v","1","-i",track.toString()));
            // Framesync holds each PNG until the next cue. Keep the subtitle stream sparse.
            filter.append(";[").append(next).append(":v]format=rgba[ct];").append(video).append("[ct]overlay=0:0:eof_action=pass[v2]");
            video="[v2]";
        }
        Path out=work.resolve("studio-captioned.mp4");
        args.addAll(List.of("-filter_complex",filter.toString(),"-map",video));
        if(copyAudio)args.addAll(List.of("-map","0:a?","-c:a","copy"));
        args.addAll(List.of("-t",Double.toString(probe.durationSec()),"-c:v","libx264","-threads:v","2",
                "-preset","veryfast","-crf","20","-pix_fmt","yuv420p",out.toString()));
        ffmpeg.runFfmpeg(args);
        return out;
    }
    /**
     * 所有字幕合成一路透明画面：每条字幕一张整幅透明 PNG，按时间排成 ffconcat 清单，只占一路输入。
     * 之前每条字幕一路 {@code -loop 1} 输入，几十条以后又慢又费内存。
     */
    public Path captionTrack(Path work,List<com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Caption> captions,int width,int height,double duration) throws Exception {
        Path blank=work.resolve("caption-blank.png");
        ImageIO.write(new BufferedImage(width,height,BufferedImage.TYPE_INT_ARGB),"png",blank.toFile());
        StringBuilder list=new StringBuilder("ffconcat version 1.0\n");
        double at=0;int n=0;
        for(var cue:captions.stream().sorted(java.util.Comparator.comparingDouble(com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Caption::start)).toList()) {
            double start=Math.max(cue.start(),at),end=Math.min(cue.end(),duration);
            if(end-start<0.02)continue;
            if(start-at>0.0005)list.append("file '").append(blank.getFileName()).append("'\nduration ").append(num(start-at)).append("\n");
            Path image=work.resolve("caption-"+(n++)+".png");
            ImageIO.write(editCaption(width,height,cue.text()),"png",image.toFile());
            list.append("file '").append(image.getFileName()).append("'\nduration ").append(num(end-start)).append("\n");
            at=end;
        }
        // ffconcat 里最后一张图要多写一次，否则最后的 duration 不生效。
        list.append("file '").append(blank.getFileName()).append("'\nduration ").append(num(Math.max(0.04,duration-at))).append("\nfile '").append(blank.getFileName()).append("'\n");
        Path track=work.resolve("captions.ffconcat");
        java.nio.file.Files.writeString(track,list.toString());
        return track;
    }
    private static String num(double v) {return String.format(Locale.ROOT,"%.3f",v);}
    BufferedImage overlay(int width,int height,String brand,String title,String cta,String caption) {
        BufferedImage image=new BufferedImage(width,height,BufferedImage.TYPE_INT_ARGB);Graphics2D g=image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            int margin=Math.max(20,width/18),size=Math.max(18,width/22);
            if(!blank(brand))draw(g,brand,margin,margin,width-2*margin,size,true);
            if(!blank(title))draw(g,title,margin,margin+size*2,width-2*margin,size+6,true);
            if(!blank(cta))draw(g,cta,margin,height-margin-size*2,width-2*margin,size,true);
            if(!blank(caption))draw(g,caption,margin,height-margin-size*9,width-2*margin,size+4,false);
            return image;
        } finally {g.dispose();}
    }
    private void draw(Graphics2D g,String text,int x,int y,int maxWidth,int size,boolean compact) {
        Font font=fonts.byKind(FontRegistry.Kind.SANS).stream().map(FontRegistry.RegisteredFont::font).filter(f->f.canDisplayUpTo(text)<0).findFirst().orElse(new Font(Font.SANS_SERIF,Font.BOLD,size));
        if(font.canDisplayUpTo(text)>=0)fail("中文字体未安装，暂不能添加这些文字");
        font=font.deriveFont(Font.BOLD,(float)size);g.setFont(font);var metrics=g.getFontMetrics();List<String> lines=new ArrayList<>();StringBuilder line=new StringBuilder();
        for(int cp:text.codePoints().toArray()) {String c=new String(Character.toChars(cp));if(metrics.stringWidth(line+c)>maxWidth-24||cp=='\n') {lines.add(line.toString());line.setLength(0);}if(cp!='\n')line.append(c);}
        if(!line.isEmpty())lines.add(line.toString());if(lines.size()>4)fail("文字过长，请缩短品牌文字或字幕");
        int boxWidth=compact?Math.min(maxWidth,lines.stream().mapToInt(metrics::stringWidth).max().orElse(0)+24):maxWidth;
        g.setColor(new Color(17,24,39,195));g.fillRoundRect(x,y,boxWidth,lines.size()*(size+8)+18,12,12);g.setColor(Color.WHITE);
        for(int i=0;i<lines.size();i++)g.drawString(lines.get(i),x+12,y+12+metrics.getAscent()+i*(size+8));
    }
    /** 成片高级编辑的一段文字：整幅透明图，文字（可多行）居中在画面中心 + (x, y)，粗体、给定字号和颜色（与编辑器预览一致：只有填充，没有底框）。 */
    public BufferedImage editText(int width,int height,String text,double x,double y,int size,String color) {
        BufferedImage image=new BufferedImage(width,height,BufferedImage.TYPE_INT_ARGB);Graphics2D g=image.createGraphics();
        try {
            hints(g);g.setFont(font(text,size));g.setColor(color==null?Color.WHITE:Color.decode(color));
            centered(g,text.split("\n",-1),width/2.0+x,height/2.0+y);
            return image;
        } finally {g.dispose();}
    }
    /** 成片高级编辑的字幕：和编辑器里的「SOFT_BOX」样式一致 —— 40px 白色粗体、#333 底框，整句居中在画面中线往下 30% 高度处。 */
    public BufferedImage editCaption(int width,int height,String text) {
        BufferedImage image=new BufferedImage(width,height,BufferedImage.TYPE_INT_ARGB);Graphics2D g=image.createGraphics();
        try {
            // 按短边算字号：720 档 40px（和编辑器一致），横屏不会因为画面宽就把字放得过大。
            hints(g);int size=Math.max(18,Math.round(40f*Math.min(width,height)/720f));g.setFont(font(text,size));var m=g.getFontMetrics();
            String[] lines=wrap(text,m,width-2*Math.max(20,width/18)-24);
            int lineH=m.getHeight(),boxW=0;for(String l:lines)boxW=Math.max(boxW,m.stringWidth(l));boxW+=32;int boxH=lines.length*lineH+20;
            double cy=height/2.0+height*0.3;g.setColor(new Color(51,51,51,215));
            g.fillRoundRect((int)Math.round(width/2.0-boxW/2.0),(int)Math.round(cy-boxH/2.0),boxW,boxH,16,16);
            g.setColor(Color.WHITE);centered(g,lines,width/2.0,cy);
            return image;
        } finally {g.dispose();}
    }
    private static void hints(Graphics2D g) {g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,RenderingHints.VALUE_TEXT_ANTIALIAS_ON);}
    private Font font(String text,int size) {
        Font font=fonts.byKind(FontRegistry.Kind.SANS).stream().map(FontRegistry.RegisteredFont::font).filter(f->f.canDisplayUpTo(text.replace("\n",""))<0).findFirst().orElse(new Font(Font.SANS_SERIF,Font.BOLD,size));
        if(font.canDisplayUpTo(text.replace("\n",""))>=0)fail("中文字体未安装，暂不能添加这些文字");
        return font.deriveFont(Font.BOLD,(float)size);
    }
    private static void centered(Graphics2D g,String[] lines,double cx,double cy) {
        var m=g.getFontMetrics();int lineH=m.getHeight();double top=cy-lines.length*lineH/2.0;
        for(int i=0;i<lines.length;i++)g.drawString(lines[i],(float)(cx-m.stringWidth(lines[i])/2.0),(float)(top+i*lineH+m.getAscent()));
    }
    private static String[] wrap(String text,java.awt.FontMetrics m,int maxWidth) {
        List<String> lines=new ArrayList<>();StringBuilder line=new StringBuilder();
        for(int cp:text.codePoints().toArray()){String c=new String(Character.toChars(cp));if(cp=='\n'||m.stringWidth(line+c)>maxWidth&&!line.isEmpty()){lines.add(line.toString());line.setLength(0);}if(cp!='\n')line.append(c);}
        if(!line.isEmpty())lines.add(line.toString());return lines.toArray(String[]::new);
    }
    private static boolean blank(String v) {return v==null||v.isBlank();}
    private static void text(String v,int max) {if(v!=null&&v.length()>max)fail("包装文字过长");}
    /** The one caption limit, shared by {@link #precheck} and {@link #decorate}. */
    private static void checkCaptions(Packaging value,double duration) {
        if(value.captions()!=null)for(var c:value.captions())if(c.end()>duration+0.25)fail("字幕时间超过成片时长");
    }
    /** The one voiceover limit, shared by {@link #precheck} and {@link #decorate}: never truncated, never longer than the video. */
    private static void checkSpeech(FfmpegRunner.MediaProbe speech,double duration) {
        if(!speech.readable()||!speech.hasAudio()||speech.hasVideo()||speech.durationSec()<=0)fail("所选配音不是可用音频");
        if(speech.durationSec()>duration+.05)throw BusinessException.badRequest("STUDIO_SPEECH_TOO_LONG","配音长于视频，请缩短文案或增加视频片段；不会截断台词");
    }
    private static void fail(String message) {throw BusinessException.badRequest("STUDIO_PACKAGING_INVALID",message);}
}
