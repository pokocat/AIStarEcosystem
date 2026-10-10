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

/** User text is rasterized locally; it never becomes shell or ffmpeg filter syntax. */
@Service
public class StudioPackagingService {
    private final FfmpegRunner ffmpeg;private final FontRegistry fonts;
    public StudioPackagingService(FfmpegRunner ffmpeg,FontRegistry fonts) {this.ffmpeg=ffmpeg;this.fonts=fonts;}
    public static void validate(Packaging value) {
        if(value==null)return;
        text(value.brand(),60);text(value.title(),120);text(value.cta(),100);
        if(value.captions()!=null) {
            if(value.captions().size()>24)fail("一次最多添加 24 条字幕");
            double last=0;
            for(var cue:value.captions()) {
                if(cue==null || cue.start()==null || cue.end()==null || !Double.isFinite(cue.start()) || !Double.isFinite(cue.end()) || cue.start()<last || cue.end()<=cue.start() || cue.end()>600)fail("字幕时间范围不正确或存在重叠");
                text(cue.text(),160);if(cue.text()==null||cue.text().isBlank())fail("字幕不能为空");last=cue.end();
            }
        }
        if(blank(value.brand())&&blank(value.title())&&blank(value.cta())&&(value.captions()==null||value.captions().isEmpty())&&blank(value.voiceoverStorageKey()))fail("请填写品牌文字、字幕或选择配音");
    }
    public Path decorate(Path source,Path work,Packaging value) throws Exception {
        return decorate(source,work,value,null);
    }
    public Path decorate(Path source,Path work,Packaging value,Path audio) throws Exception {
        validate(value);var probe=ffmpeg.probeMedia(source.toFile());
        int width=probe.width(),height=probe.height();double duration=probe.durationSec();
        if(!probe.readable()||width<1||height<1||duration<=0)fail("包装来源视频无法读取");
        if(value.captions()!=null)for(var c:value.captions())if(c.end()>duration+0.25)fail("字幕时间超过成片时长");
        List<String> args=new ArrayList<>(List.of("-y","-i",source.toString()));
        Path base=work.resolve("studio-brand.png");ImageIO.write(overlay(width,height,value.brand(),value.title(),value.cta(),null),"png",base.toFile());
        args.addAll(List.of("-loop","1","-i",base.toString()));String filter="[0:v]setsar=1[v0];[v0][1:v]overlay=0:0[v1]";int n=1;
        if(value.captions()!=null)for(var cue:value.captions()) {
            Path image=work.resolve("studio-caption-"+n+".png");ImageIO.write(overlay(width,height,null,null,null,cue.text()),"png",image.toFile());
            args.addAll(List.of("-loop","1","-i",image.toString()));
            filter+=";[v"+n+"]["+(n+1)+":v]overlay=0:0:enable='between(t,"+String.format(Locale.ROOT,"%.4f",cue.start())+","+String.format(Locale.ROOT,"%.4f",cue.end())+")'[v"+(n+1)+"]";n++;
        }
        Path out=work.resolve("studio-packaged.mp4");
        if(audio!=null) {
            var speech=ffmpeg.probeMedia(audio.toFile());
            if(!speech.readable()||!speech.hasAudio()||speech.hasVideo()||speech.durationSec()<=0)fail("所选配音不是可用音频");
            if(speech.durationSec()>duration+.05)throw BusinessException.badRequest("STUDIO_SPEECH_TOO_LONG","配音长于视频，请缩短文案或增加视频片段；不会截断台词");
            args.addAll(List.of("-i",audio.toString()));
            filter+=";["+(n+1)+":a]aresample=48000,loudnorm=I=-16:TP=-2.5:LRA=11,apad[aout]";
        }
        args.addAll(List.of("-filter_complex_threads","1","-filter_complex",filter,"-map","[v"+n+"]","-map",audio==null?"0:a?":"[aout]","-t",Double.toString(duration),"-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p","-c:a",audio==null?"copy":"aac","-movflags","+faststart",out.toString()));
        ffmpeg.runFfmpeg(args);return out;
    }
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
    private static boolean blank(String v) {return v==null||v.isBlank();}
    private static void text(String v,int max) {if(v!=null&&v.length()>max)fail("包装文字过长");}
    private static void fail(String message) {throw BusinessException.badRequest("STUDIO_PACKAGING_INVALID",message);}
}
