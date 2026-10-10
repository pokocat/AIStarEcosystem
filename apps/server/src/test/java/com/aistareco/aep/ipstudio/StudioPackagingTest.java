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
}
