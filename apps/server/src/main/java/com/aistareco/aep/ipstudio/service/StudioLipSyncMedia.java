package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;

/** Validate decoded media before freezing credits or submitting to the lip-sync supplier. */
@Component
public class StudioLipSyncMedia {
    public record Inputs(double audioDurationSec, double videoDurationSec) {}
    public Inputs inspect(Path video, Path audio) {
        try {
            if(Files.size(video)>128L*1024*1024 || Files.size(audio)>25L*1024*1024)
                throw bad("口型素材过大：视频最多 128MB，音频最多 25MB");
            JsonNode v=probe(video),a=probe(audio);
            double vd=v.path("format").path("duration").asDouble(),ad=a.path("format").path("duration").asDouble();
            JsonNode videoStream=null;int videoCount=0;
            for(JsonNode stream:v.path("streams"))if("video".equals(stream.path("codec_type").asText())){videoStream=stream;videoCount++;}
            if(videoCount!=1 || !v.path("format").path("format_name").asText().contains("mp4"))throw bad("请选择可播放的单画面 MP4 人物视频");
            String[] fpsParts=videoStream.path("avg_frame_rate").asText("0/1").split("/");
            double fps=Double.parseDouble(fpsParts[0])/(fpsParts.length>1?Double.parseDouble(fpsParts[1]):1);
            if(!Double.isFinite(fps)||fps<15||fps>60)throw bad("人物视频需为 15–60fps");
            if(!"wav".equals(a.path("format").path("format_name").asText())||a.path("streams").size()!=1||!"audio".equals(a.path("streams").path(0).path("codec_type").asText()))
                throw bad("口型驱动目前需要 WAV 配音，请选择画布中的 WAV 配音");
            if(!Double.isFinite(vd)||!Double.isFinite(ad)||vd<=0||ad<=0||ad>60)throw bad("驱动配音需为 0–60 秒");
            if(ad>vd+0.04)throw bad("配音比人物视频更长，请先准备足够长的视频，不会截断台词");
            return new Inputs(ad,vd);
        } catch(BusinessException e){throw e;}
        catch(Exception e){throw bad("素材无法读取或解码，请重新选择视频和 WAV 配音");}
    }
    static JsonNode probe(Path file) throws Exception {
        Process p=new ProcessBuilder("ffprobe","-v","error","-show_streams","-show_format","-of","json",file.toString()).redirectError(ProcessBuilder.Redirect.DISCARD).start();
        if(!p.waitFor(20,TimeUnit.SECONDS)){p.destroyForcibly();throw new IllegalStateException("Media probe timeout");}
        if(p.exitValue()!=0)throw new IllegalArgumentException("Invalid media");
        return new ObjectMapper().readTree(p.getInputStream().readAllBytes());
    }
    private static BusinessException bad(String message){return BusinessException.badRequest("STUDIO_LIP_SYNC_MEDIA_INVALID",message);}
}
