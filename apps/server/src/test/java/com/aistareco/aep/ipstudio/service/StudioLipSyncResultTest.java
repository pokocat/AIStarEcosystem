package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;

class StudioLipSyncResultTest {
    @Test void verifiedSourceLeftComparisonExtractsRightAndPreservesAudio(@TempDir Path dir) throws Exception {
        Path source=dir.resolve("source.mp4"),output=dir.resolve("compare.mp4");
        make("-f","lavfi","-i","testsrc2=size=320x568:rate=25:duration=1.52","-c:v","libx264",source.toString());
        make("-i",source.toString(),"-f","lavfi","-i","color=red:size=320x568:rate=25:duration=1.52","-f","lavfi","-i","sine=duration=1.52",
                "-filter_complex","[0:v][1:v]hstack[v]","-map","[v]","-map","2:a","-c:v","libx264","-c:a","aac","-shortest",output.toString());
        var result=new StudioLipSyncResult().extract(source,output);assertTrue(result.comparison());assertEquals(320,result.width());assertEquals(568,result.height());assertEquals(1.52,result.durationSec(),.04);
        Path cut=dir.resolve("cut.mp4");Files.write(cut,result.bytes());
        Path originalAudio=dir.resolve("original.wav"),cutAudio=dir.resolve("cut.wav");
        make("-i",output.toString(),"-vn",originalAudio.toString());make("-i",cut.toString(),"-vn",cutAudio.toString());assertArrayEquals(Files.readAllBytes(originalAudio),Files.readAllBytes(cutAudio));
        var unchanged=new StudioLipSyncResult().extract(source,cut);assertFalse(unchanged.comparison());assertArrayEquals(result.bytes(),unchanged.bytes());
    }
    @Test void unrelatedLeftSideIsNeverTreatedAsSource(@TempDir Path dir) throws Exception {
        Path source=dir.resolve("source.mp4"),output=dir.resolve("other.mp4");
        make("-f","lavfi","-i","testsrc2=size=320x568:rate=25:duration=1.52","-c:v","libx264",source.toString());
        make("-f","lavfi","-i","color=red:size=640x568:rate=25:duration=1.52","-f","lavfi","-i","sine=duration=1.52","-c:v","libx264","-c:a","aac",output.toString());
        assertEquals("STUDIO_LIP_SYNC_LAYOUT_UNKNOWN",assertThrows(BusinessException.class,()->new StudioLipSyncResult().extract(source,output)).getCode());
    }
    private static void make(String... args)throws Exception {
        var command=new ArrayList<String>(List.of("ffmpeg","-v","error","-y"));command.addAll(List.of(args));
        var process=new ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.INHERIT).start();assertTrue(process.waitFor(30,TimeUnit.SECONDS));assertEquals(0,process.exitValue());
    }
}
