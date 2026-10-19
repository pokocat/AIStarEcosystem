package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/** X-Dub can return source-left/result-right comparisons. Verify the source before extracting. */
@Component
public class StudioLipSyncResult {
    public record Result(byte[] bytes,double durationSec,int width,int height,boolean comparison) {}
    public Result extract(Path source,Path output) throws Exception {
        JsonNode sourceVideo=video(StudioLipSyncMedia.probe(source)),probe=StudioLipSyncMedia.probe(output),resultVideo=video(probe);
        int width=resultVideo.path("width").asInt(),height=resultVideo.path("height").asInt();
        double seconds=probe.path("format").path("duration").asDouble();
        double relativeAspect=(double)width/height/((double)sourceVideo.path("width").asInt()/sourceVideo.path("height").asInt());
        if(Math.abs(relativeAspect-1)<0.05)return new Result(Files.readAllBytes(output),seconds,width,height,false);
        // Never cut arbitrary widescreen output in half. The known comparison layout must match
        // both the source aspect and decoded source pixels; unknown layouts remain available for review.
        if(width%4!=0||Math.abs(relativeAspect-2)>0.08)throw bad();
        int half=width/2;
        Path log=Files.createTempFile("studio-lip-check-",".log"),cut=Files.createTempFile("studio-lip-result-",".mp4");
        try {
            String comparison="[0:v]trim=duration="+seconds+",setpts=PTS-STARTPTS,scale="+half+":"+height+",fps=1,format=yuv420p[a];[1:v]crop="+half+":"+height+":0:0,fps=1,format=yuv420p[b];[a][b]ssim";
            run(List.of("ffmpeg","-hide_banner","-i",source.toString(),"-i",output.toString(),"-filter_complex",comparison,"-an","-f","null","-"),log);
            var match=Pattern.compile("All:([0-9.]+)").matcher(Files.readString(log));
            if(!match.find()||Double.parseDouble(match.group(1))<0.85)throw bad();
            run(List.of("ffmpeg","-v","error","-y","-i",output.toString(),"-map","0:v:0","-map","0:a:0","-vf","crop="+half+":"+height+":"+half+":0",
                    "-c:v","libx264","-preset","fast","-crf","18","-pix_fmt","yuv420p","-c:a","copy","-movflags","+faststart",cut.toString()),log);
            var checked=StudioLipSyncMedia.probe(cut);JsonNode v=video(checked);
            if(v.path("width").asInt()!=half||v.path("height").asInt()!=height||Math.abs(checked.path("format").path("duration").asDouble()-seconds)>0.04)throw bad();
            return new Result(Files.readAllBytes(cut),seconds,half,height,true);
        } finally {Files.deleteIfExists(log);Files.deleteIfExists(cut);}
    }
    private static JsonNode video(JsonNode probe){for(JsonNode stream:probe.path("streams"))if("video".equals(stream.path("codec_type").asText()))return stream;throw bad();}
    private static void run(List<String> args,Path log) throws Exception {
        Process process=new ProcessBuilder(args).redirectErrorStream(true).redirectOutput(log.toFile()).start();
        if(!process.waitFor(90,TimeUnit.SECONDS)){process.destroyForcibly();throw bad();}
        if(process.exitValue()!=0)throw bad();
    }
    private static BusinessException bad(){return BusinessException.badRequest("STUDIO_LIP_SYNC_LAYOUT_UNKNOWN","无法确认口型结果的画面布局，请先查看原始结果；未再次生成或扣积分");}
}
