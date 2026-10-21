package com.aistareco.aep.service.ai;

import com.aistareco.aep.ipstudio.service.StudioVisualContext;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import java.nio.file.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Only actual downloaded video pixels enter link analysis; four stills do not establish audio or continuous action. */
@Component
public class VideoAnalysisFrames {
    private static final int MAX_BYTES=128*1024*1024;
    private final HttpClient http;
    public VideoAnalysisFrames() {this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).followRedirects(HttpClient.Redirect.NEVER).build());}
    VideoAnalysisFrames(HttpClient http) {this.http=http;}
    public record Sample(List<Map<String,Object>> parts,double durationSec) {}
    public Sample sample(String videoUrl) {
        Path dir=null;
        try {
            dir=Files.createTempDirectory("viral-analysis-");Path video=dir.resolve("source.mp4");
            var response=download(videoUrl);
            try(var input=response.body()) {
                if(response.statusCode()/100!=2) {
                    String body=new String(input.readNBytes(512),java.nio.charset.StandardCharsets.UTF_8).replaceAll("[\\r\\n]"," ");
                    LoggerFactory.getLogger(getClass()).warn("[viral-analysis] video download HTTP {} body={}",response.statusCode(),body);
                    throw BusinessException.badRequest("VIRAL_VIDEO_UNREADABLE","视频地址无法读取（HTTP "+response.statusCode()+"），请提供可访问的视频直链");
                }
                if(response.headers().firstValueAsLong("Content-Length").orElse(0)>MAX_BYTES)throw invalid("视频超过 128 MB，请先压缩或截取片段");
                try(var out=Files.newOutputStream(video)) {byte[] buffer=new byte[8192];int count;long total=0;while((count=input.read(buffer))!=-1){total+=count;if(total>MAX_BYTES)throw invalid("视频超过 128 MB，请先压缩或截取片段");out.write(buffer,0,count);}}
            }
            Path probe=dir.resolve("probe.json"),errors=dir.resolve("probe.err");
            run(List.of("ffprobe","-v","error","-show_format","-show_streams","-of","json",video.toString()),probe,errors);
            var metadata=new ObjectMapper().readTree(probe.toFile());double seconds=metadata.path("format").path("duration").asDouble();
            if(!Double.isFinite(seconds) || seconds<=0 || seconds>180)throw invalid("请提供 3 分钟以内的有效视频");
            boolean hasVideo=false;for(var stream:metadata.path("streams"))if("video".equals(stream.path("codec_type").asText()))hasVideo=true;
            if(!hasVideo)throw invalid("该文件没有可分析的视频画面");
            List<Map<String,Object>> parts=new ArrayList<>();
            parts.add(Map.of("type","text","text",String.format(Locale.ROOT,"视频真实时长 %.2f 秒。以下按顺序采样 4 帧，未提供音轨，不能判断对白、音乐或完整动作；时间点之间的内容未知。",seconds)));
            for(int i=0;i<4;i++) {
                double at=seconds*(i+0.5)/4;Path frame=dir.resolve("frame-"+i+".jpg");
                run(List.of("ffmpeg","-nostdin","-v","error","-ss",Double.toString(at),"-i",video.toString(),"-frames:v","1","-vf","scale=768:768:force_original_aspect_ratio=decrease","-y",frame.toString()),dir.resolve("ffmpeg.out"),dir.resolve("ffmpeg.err"));
                parts.add(Map.of("type","text","text",String.format(Locale.ROOT,"采样 %d/4：%.2f 秒",i+1,at)));
                parts.add(StudioVisualContext.image(Files.readAllBytes(frame)));
            }
            return new Sample(List.copyOf(parts),seconds);
        }catch(BusinessException e){throw e;}catch(Exception e){LoggerFactory.getLogger(getClass()).warn("[viral-analysis] video sampling failed: {}",e.toString());throw invalid("参考视频无法读取或抽取画面，请换一个可访问的视频直链");}
        finally {if(dir!=null)try(var files=Files.walk(dir)){files.sorted(Comparator.reverseOrder()).forEach(p->{try{Files.deleteIfExists(p);}catch(Exception ignored){}});}catch(Exception ignored){}}
    }
    private HttpResponse<java.io.InputStream> download(String source) throws Exception {
        var uri=PublicMediaUris.require(source);
        for(int redirects=0;redirects<=4;redirects++) {
            var response=http.send(HttpRequest.newBuilder(uri).header("User-Agent","Mozilla/5.0 AIBuzz-VideoAnalysis/1.0")
                    .timeout(Duration.ofSeconds(90)).GET().build(),HttpResponse.BodyHandlers.ofInputStream());
            if(!java.util.Set.of(301,302,303,307,308).contains(response.statusCode()))return response;
            try(var body=response.body()) {
                String location=response.headers().firstValue("Location").orElseThrow(()->invalid("视频跳转地址无效"));
                uri=PublicMediaUris.require(uri.resolve(location).toString());
            }
        }
        throw invalid("视频地址跳转过多，请提供视频直链");
    }
    private static void run(List<String> command,Path stdout,Path stderr) throws Exception {
        Process p=new ProcessBuilder(command).redirectOutput(stdout.toFile()).redirectError(stderr.toFile()).start();
        try {if(!p.waitFor(25,TimeUnit.SECONDS))throw invalid("视频抽帧超时，请截取较短片段");}
        finally {if(p.isAlive())p.destroyForcibly();}
        if(p.exitValue()!=0) {
            String diagnostic=Files.readString(stderr);LoggerFactory.getLogger(VideoAnalysisFrames.class).warn("[viral-analysis] {} failed: {}",command.get(0),diagnostic.substring(0,Math.min(600,diagnostic.length())));
            throw invalid("视频格式无法解析，请使用 MP4 视频");
        }
    }
    private static BusinessException invalid(String message){return BusinessException.badRequest("VIRAL_VIDEO_INVALID",message);}
}
