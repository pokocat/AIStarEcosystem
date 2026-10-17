package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.*;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** Extract the complete mixed soundtrack as an ordinary owned asset. No ASR or source separation. */
public final class StudioSourceAudio {
    private static final ObjectMapper OM=new ObjectMapper();
    private StudioSourceAudio() {}

    public static ObjectNode extract(JsonNode source,JsonNode resume,FileStorageService storage,String owner) {
        String sourceKey=source.path("storageKey").asText();
        // Resume is loaded server-side from the same owner's accepted run, never from client media keys.
        if(sourceKey.equals(resume.path("sourceStorageKey").asText()) &&
                ("absent".equals(resume.path("status").asText()) ||
                 "ready".equals(resume.path("status").asText())&&!resume.path("storageKey").asText().isBlank())) {
            ObjectNode saved=resume.deepCopy();saved.remove("url");return saved;
        }
        ObjectNode result=OM.createObjectNode().put("sourceNodeId",source.path("nodeId").asText())
                .put("sourceStorageKey",sourceKey).put("sourceTitle",source.path("title").asText());
        Path directory=null;
        try {
            Path input=storage.openForRead(sourceKey);JsonNode probe=StudioLipSyncMedia.probe(input);
            boolean hasAudio=false;
            for(JsonNode stream:probe.path("streams"))if("audio".equals(stream.path("codec_type").asText())){hasAudio=true;break;}
            if(!hasAudio)return result.put("status","absent");
            directory=Files.createTempDirectory("studio-source-audio-");Path audio=directory.resolve("original.wav");
            // A 60-second stereo PCM file is bounded to about 11.5MB; WAV also works with existing assembly/lip-sync inputs.
            Process process=StudioHypitMedia.configureMediaRuntime(new ProcessBuilder(List.of("ffmpeg","-v","error","-nostdin","-y",
                    "-threads","2","-copyts","-start_at_zero","-i",input.toString(),"-map","0:a:0","-vn","-af","aresample=async=1:first_pts=0","-c:a","pcm_s16le","-ar","48000","-ac","2",audio.toString())))
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start();
            try {
                if(!process.waitFor(120,TimeUnit.SECONDS)||process.exitValue()!=0)throw new IllegalStateException("Audio extraction failed");
            }finally{if(process.isAlive())process.destroyForcibly();}
            JsonNode actual=StudioLipSyncMedia.probe(audio);double duration=actual.path("format").path("duration").asDouble();
            if(!Double.isFinite(duration)||duration<=0||duration>60.3||actual.path("streams").size()!=1||
                    !"audio".equals(actual.path("streams").path(0).path("codec_type").asText()))throw new IllegalStateException("Invalid extracted audio");
            var file=storage.store(Files.readAllBytes(audio),IpProjectService.CATEGORY_GEN,owner,"wav","audio/wav");
            return result.put("status","ready").put("storageKey",file.key()).put("mimeType","audio/wav").put("durationSec",duration).put("bytes",file.bytes());
        }catch(BusinessException e){throw e;}
        catch(Exception e){throw BusinessException.badRequest("STUDIO_AUDIO_EXTRACTION_FAILED","原声音频提取失败，请重试");}
        finally{if(directory!=null)try(var paths=Files.walk(directory)){for(Path path:paths.sorted(java.util.Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}catch(Exception ignored){}}
    }
}
