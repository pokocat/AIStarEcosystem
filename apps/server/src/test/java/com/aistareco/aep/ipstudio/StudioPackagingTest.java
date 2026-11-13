package com.aistareco.aep.ipstudio;
import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.*;
import com.aistareco.aep.ipstudio.service.StudioPackagingService;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.picgen.FontRegistry;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import javax.imageio.ImageIO;
import java.nio.file.Path;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
class StudioPackagingTest {
    @Test void selectedSpeechReplacesOriginalTrackWithoutTruncatingNarration(@TempDir Path dir) throws Exception {
        var ffmpeg=new FfmpegRunner(new MixcutProperties());var fonts=new FontRegistry();fonts.load();
        var svc=new StudioPackagingService(ffmpeg,fonts);var src=dir.resolve("source.mp4");var voice=dir.resolve("voice.wav");
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","color=black:size=320x568:rate=24:duration=3","-f","lavfi","-i","sine=frequency=440:duration=3","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",src.toString()));
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","sine=frequency=880:duration=1.5",voice.toString()));
        var value=new Packaging(null,null,null,null,"owned/voice.wav");
        var out=svc.decorate(src,dir,value,voice);var probe=ffmpeg.probeMedia(out.toFile());
        assertEquals(3,probe.durationSec(),.1);assertEquals("aac",probe.audioCodec());
        var raw=dir.resolve("samples.pcm");
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-i",out.toString(),"-vn","-af","atrim=start=0.2:end=1.2","-f","s16le","-ac","1","-ar","16000",raw.toString()));
        var b=java.nio.ByteBuffer.wrap(java.nio.file.Files.readAllBytes(raw)).order(java.nio.ByteOrder.LITTLE_ENDIAN);
        int crossings=0;short prior=0;while(b.remaining()>=2){short sample=b.getShort();if(prior<0&&sample>=0)crossings++;prior=sample;}
        assertTrue(crossings>850&&crossings<910,"The selected 880Hz speech fixture must replace the original 440Hz track");
        var longVoice=dir.resolve("long.wav");ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","sine=duration=4",longVoice.toString()));
        assertEquals("STUDIO_SPEECH_TOO_LONG",assertThrows(BusinessException.class,()->svc.decorate(src,dir,value,longVoice)).getCode());
    }
    @Test void invalidTimingsRejectedBeforeGeneration() {
        for(var cues:List.of(List.of(new Caption(2.0,1.0,"reverse")),List.of(new Caption(0.0,3.0,"one"),new Caption(2.0,4.0,"overlap")),List.of(new Caption(Double.NaN,1.0,"nan"))))
            assertThrows(BusinessException.class,()->StudioPackagingService.validate(new Packaging(null,null,null,cues)));
    }
    @Test void realPackagingPreservesAudioDurationAndAppliesTimedCue(@TempDir Path dir) throws Exception {
        var ffmpeg=new FfmpegRunner(new MixcutProperties());var fonts=new FontRegistry();fonts.load();
        var svc=new StudioPackagingService(ffmpeg,fonts);var src=dir.resolve("source.mp4");
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","color=black:size=320x568:rate=24:duration=3","-f","lavfi","-i","sine=frequency=440:duration=3","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",src.toString()));
        var packaged=svc.decorate(src,dir,new Packaging("Brand",null,"Discover",List.of(new Caption(1.0,2.0,"Literal ';[v] text"))));
        var probe=ffmpeg.probeMedia(packaged.toFile());assertEquals("h264",probe.videoCodec());assertEquals("aac",probe.audioCodec());assertEquals(3,probe.durationSec(),.1);
        var before=dir.resolve("before.png");var during=dir.resolve("during.png");
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-ss","0.5","-i",packaged.toString(),"-frames:v","1",before.toString()));
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-ss","1.5","-i",packaged.toString(),"-frames:v","1",during.toString()));
        var a=ImageIO.read(before.toFile());var b=ImageIO.read(during.toFile());long changed=0;
        for(int y=350;y<460;y++)for(int x=20;x<300;x++)if(a.getRGB(x,y)!=b.getRGB(x,y))changed++;
        assertTrue(changed>200,"Timed caption must be visibly present only within its cue");
        assertThrows(BusinessException.class,()->svc.decorate(src,dir,new Packaging(null,null,null,List.of(new Caption(0.0,4.0,"too late")))));
    }

    /** 成片的最后一道：字幕一路画面、片段接缝、音量统一、背景音乐说话时压低（2026-11-07）。 */
    @Test void manyCaptionsGoInOneTrackAndShowOnlyDuringTheirTime(@TempDir Path dir) throws Exception {
        var ffmpeg=new FfmpegRunner(new MixcutProperties());var fonts=new FontRegistry();fonts.load();
        var svc=new StudioPackagingService(ffmpeg,fonts);var src=dir.resolve("source.mp4");
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","color=black:size=320x568:rate=24:duration=6","-f","lavfi","-i","sine=frequency=440:duration=6","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",src.toString()));
        var cues=new java.util.ArrayList<Caption>();
        for(int i=0;i<40;i++)cues.add(new Caption(1.0+i*0.1,1.0+i*0.1+0.09,"第"+i+"条"));
        var out=svc.finish(src,dir,null,null,null,null,cues);
        var probe=ffmpeg.probeMedia(out.toFile());assertEquals(6,probe.durationSec(),.1);assertEquals("h264",probe.videoCodec());
        assertTrue(changed(ffmpeg,out,dir,0.5,2.0)>100,"字幕时间内画面有字");
        assertEquals(0,changed(ffmpeg,out,dir,0.5,5.5),"字幕结束后画面恢复");
    }
    @Test void withNothingToDrawTheVideoIsCopiedAndOnlyTheSoundIsProcessed(@TempDir Path dir) throws Exception {
        var ffmpeg=new FfmpegRunner(new MixcutProperties());var fonts=new FontRegistry();fonts.load();
        var svc=new StudioPackagingService(ffmpeg,fonts);var src=dir.resolve("source.mp4");
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","color=black:size=320x568:rate=24:duration=3","-f","lavfi","-i","sine=frequency=440:duration=3","-af","volume=0.02","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",src.toString()));
        var out=svc.finish(src,dir,null,null,null,null,null);
        assertTrue(meanVolume(ffmpeg,src,0.5,2)<-30,"原声很小");
        assertTrue(meanVolume(ffmpeg,out,0.5,2)>-25,"响度被统一到正常水平");
    }
    @Test void sparseCaptionsAndSeparateAudioRenderTogetherAtProductionResolution(@TempDir Path dir) throws Exception {
        var ffmpeg=new FfmpegRunner(new MixcutProperties());
        var fonts=new FontRegistry();fonts.load();
        var svc=new StudioPackagingService(ffmpeg,fonts);
        var src=dir.resolve("source.mp4");
        var clean=dir.resolve("clean.wav");
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i",
                "color=black:size=1344x768:rate=24:duration=32","-c:v","libx264","-threads:v","2","-pix_fmt","yuv420p",src.toString()));
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","sine=frequency=880:duration=32",clean.toString()));
        var out=svc.finish(src,dir,null,null,clean,null,List.of(new Caption(20.0,21.0,"A late caption")));
        var probe=ffmpeg.probeMedia(out.toFile());
        assertEquals(32,probe.durationSec(),.1);
        assertEquals(1344,probe.width());
        assertEquals("aac",probe.audioCodec());
        assertTrue(changed(ffmpeg,out,dir,3.0,20.5)>100);
        assertEquals(0,changed(ffmpeg,out,dir,3.0,27.0));
        assertTrue(meanVolume(ffmpeg,out,27.0,2)>-25);
    }
    @Test void musicDucksWhilePeopleTalkAndLoopsToTheEnd(@TempDir Path dir) throws Exception {
        var ffmpeg=new FfmpegRunner(new MixcutProperties());var fonts=new FontRegistry();fonts.load();
        var svc=new StudioPackagingService(ffmpeg,fonts);var src=dir.resolve("source.mp4");var music=dir.resolve("music.m4a");
        // 前 4 秒没人说话，后 4 秒有「人声」（1000Hz）；音乐是 2 秒的 300Hz，要循环铺满。
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","color=black:size=320x568:rate=24:duration=8","-f","lavfi","-i","sine=frequency=1000:duration=8",
                "-af","volume='if(lt(t,4),0,1)':eval=frame","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",src.toString()));
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","sine=frequency=300:duration=2","-c:a","aac",music.toString()));
        var out=svc.finish(src,dir,null,null,null,music,null);
        assertEquals(8,ffmpeg.probeMedia(out.toFile()).durationSec(),.2);
        double quiet=band(ffmpeg,out,300,1.5,2),talking=band(ffmpeg,out,300,5.5,2);
        assertTrue(quiet-talking>3,"说话时音乐要明显压低 quiet="+quiet+" talking="+talking);
    }
    @Test void clipAudioIsPaddedToEachClipSoTheNextOneDoesNotDrift(@TempDir Path dir) throws Exception {
        var ffmpeg=new FfmpegRunner(new MixcutProperties());var fonts=new FontRegistry();fonts.load();
        var svc=new StudioPackagingService(ffmpeg,fonts);var a=dir.resolve("a.mp4");var b=dir.resolve("b.mp4");
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","color=black:size=320x568:rate=24:duration=3","-f","lavfi","-i","sine=frequency=440:duration=1","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",a.toString()));
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","color=black:size=320x568:rate=24:duration=2","-c:v","libx264","-pix_fmt","yuv420p",b.toString()));
        var pa=ffmpeg.probeMedia(a.toFile());var pb=ffmpeg.probeMedia(b.toFile());
        var clean=svc.cleanClipAudio(List.of(a,b),List.of(pa,pb),dir);
        assertEquals(pa.durationSec()+pb.durationSec(),ffmpeg.probeMedia(clean.toFile()).durationSec(),.05);
        assertNull(svc.cleanClipAudio(List.of(b),List.of(pb),dir),"都没有声音就不处理");
    }
    @Test void burningCaptionsOnAFinishedCutKeepsItsSoundAndLength(@TempDir Path dir) throws Exception {
        var ffmpeg=new FfmpegRunner(new MixcutProperties());var fonts=new FontRegistry();fonts.load();
        var svc=new StudioPackagingService(ffmpeg,fonts);var src=dir.resolve("source.mp4");
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-f","lavfi","-i","color=black:size=320x568:rate=24:duration=4","-f","lavfi","-i","sine=frequency=440:duration=4","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",src.toString()));
        var out=svc.burnCaptions(src,dir,List.of(new Caption(1.0,2.0,"这是一条字幕")));
        var probe=ffmpeg.probeMedia(out.toFile());assertEquals(4,probe.durationSec(),.1);assertTrue(probe.hasAudio());
        assertTrue(changed(ffmpeg,out,dir,0.5,1.5)>100,"字幕时间内画面有字");
        assertEquals(0,changed(ffmpeg,out,dir,0.5,3.0),"字幕结束后画面恢复");
    }
    private static long changed(FfmpegRunner ffmpeg,Path video,Path dir,double t1,double t2) throws Exception {
        var a=dir.resolve("a"+t1+"_"+t2+".png");var b=dir.resolve("b"+t1+"_"+t2+".png");
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-ss",String.valueOf(t1),"-i",video.toString(),"-frames:v","1",a.toString()));
        ffmpeg.runFfmpeg(List.of("-v","error","-y","-ss",String.valueOf(t2),"-i",video.toString(),"-frames:v","1",b.toString()));
        var x=ImageIO.read(a.toFile());var y=ImageIO.read(b.toFile());long n=0;
        for(int i=0;i<x.getHeight();i++)for(int j=0;j<x.getWidth();j++)if(Math.abs((x.getRGB(j,i)&255)-(y.getRGB(j,i)&255))>40)n++;
        return n;
    }
    private static double meanVolume(FfmpegRunner ffmpeg,Path file,double from,double seconds) { return detect(ffmpeg,file,"volumedetect",from,seconds); }
    private static double band(FfmpegRunner ffmpeg,Path file,int hz,double from,double seconds) { return detect(ffmpeg,file,"bandpass=f="+hz+":w=60,volumedetect",from,seconds); }
    private static double detect(FfmpegRunner ffmpeg,Path file,String filter,double from,double seconds) {
        String log=ffmpeg.runFfmpeg(List.of("-hide_banner","-y","-ss",String.valueOf(from),"-t",String.valueOf(seconds),"-i",file.toString(),"-af",filter,"-f","null","-"));
        var m=java.util.regex.Pattern.compile("mean_volume: (-?[0-9.]+) dB").matcher(log);
        assertTrue(m.find(),log);return Double.parseDouble(m.group(1));
    }
}
