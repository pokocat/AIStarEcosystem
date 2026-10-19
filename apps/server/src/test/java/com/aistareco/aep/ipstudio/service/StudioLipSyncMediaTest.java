package com.aistareco.aep.ipstudio.service;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
class StudioLipSyncMediaTest {
    @Test void decodedMediaControlsQuoteAndRejectsLongOrNonWavInput(@TempDir Path dir) throws Exception {
        var video=dir.resolve("video.mp4");var audio=dir.resolve("audio.wav");
        make("-f","lavfi","-i","color=size=320x568:rate=24:duration=3","-c:v","libx264","-pix_fmt","yuv420p",video.toString());
        make("-f","lavfi","-i","sine=duration=1.52",audio.toString());
        var checker=new StudioLipSyncMedia();var input=checker.inspect(video,audio);assertEquals(1.52,input.audioDurationSec(),.01);assertEquals(3,input.videoDurationSec(),.01);
        var longAudio=dir.resolve("long.wav");make("-f","lavfi","-i","sine=duration=4",longAudio.toString());
        assertEquals("STUDIO_LIP_SYNC_MEDIA_INVALID",assertThrows(BusinessException.class,()->checker.inspect(video,longAudio)).getCode());
        var disguised=dir.resolve("fake.wav");Files.writeString(disguised,"not a real wav");assertThrows(BusinessException.class,()->checker.inspect(video,disguised));
    }
    private static void make(String... args)throws Exception {
        var command=new java.util.ArrayList<String>(java.util.List.of("ffmpeg","-v","error","-y"));command.addAll(java.util.List.of(args));
        var p=new ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.INHERIT).start();assertTrue(p.waitFor(30,TimeUnit.SECONDS));assertEquals(0,p.exitValue());
    }
}
