package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioSpeechDtos.SpeechVoice;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.ai.*;
import com.aistareco.common.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Native async Qwen3 TTS contract. Provider credentials never reach the canvas. */
@Component
public class JusuanSpeechClient {
    private final UpstreamModelHttp upstream;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private volatile List<SpeechVoice> voices = List.of();
    private volatile long voicesUntil;
    public JusuanSpeechClient(UpstreamModelHttp upstream, ObjectMapper mapper) {
        this.upstream=upstream; this.mapper=mapper;
    }
    public static boolean supports(AiModelEndpoint endpoint) {
        try {
            URI base=URI.create(endpoint.getBaseUrl());
            return "qwen3-tts".equals(endpoint.getModel()) && "https".equals(base.getScheme())
                    && "api.jusuanhub.com".equals(base.getHost()) && (base.getPort()==-1 || base.getPort()==443)
                    && base.getUserInfo()==null && base.getQuery()==null && base.getFragment()==null
                    && Set.of("/v1", "/v1/").contains(base.getPath());
        } catch (RuntimeException e) { return false; }
    }
    public synchronized List<SpeechVoice> voices(AiModelEndpoint endpoint) {
        if (!voices.isEmpty() && System.currentTimeMillis()<voicesUntil) return voices;
        JsonNode result=json(endpoint,endpoint.getBaseUrl().replaceAll("/$", "")+"/audio/voices",null,"speech-voices",null);
        List<SpeechVoice> found=new ArrayList<>();
        for (var voice: result.path("data")) {
            String name=voice.path("displayName").asText();
            if(!name.isBlank()) found.add(new SpeechVoice(name,name,voice.path("primaryLanguage").asText(),voice.path("description").asText()));
        }
        if(found.isEmpty()) throw fail("STUDIO_SPEECH_VOICES_UNAVAILABLE", "没有可用音色，请稍后重新加载");
        voices=List.copyOf(found);voicesUntil=System.currentTimeMillis()+3_600_000;return voices;
    }
    public record Job(String jobId, String jobUrl) {}
    public Job submit(AiModelEndpoint endpoint, String base, String body, String requestId, String owner) {
        JsonNode result=json(endpoint,base+"/audio/generations",body,requestId,owner);
        String id=result.path("jobId").asText(result.path("id").asText());
        if(!id.matches("[a-zA-Z0-9_-]{1,128}")) throw fail("STUDIO_SPEECH_BAD_OUTPUT", "配音任务尚未确认，正在核对原请求");
        // Scope also covers providers returning only the legacy id alias.
        String url=result.path("jobUrl").asText(base+"/jobs/"+id+"?model=qwen3-tts");
        scopedUri(base,url,"/jobs/",id);
        return new Job(id,url);
    }
    public JsonNode poll(AiModelEndpoint endpoint, String base, String jobUrl, String id, String owner) {
        scopedUri(base,jobUrl,"/jobs/",null);
        return json(endpoint,jobUrl,null,id,owner);
    }
    public record Audio(byte[] bytes, String extension, String mimeType, double durationSec) {}
    public Audio download(AiModelEndpoint endpoint, String base, String contentUrl, String id, String owner) throws Exception {
        URI uri=scopedUri(base,contentUrl,"/assets/",null);
        HttpRequest request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(60))
                .header("Authorization","Bearer "+AepCryptoUtil.decrypt(endpoint.getUpstreamApiKeyEncrypted())).GET().build();
        var response=http.send(request,HttpResponse.BodyHandlers.ofInputStream());
        byte[] bytes;
        try(var stream=response.body()) {
            if(response.statusCode()/100!=2) {
                String body=new String(stream.readNBytes(4096),StandardCharsets.UTF_8);
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("[speech] download failed endpoint={} model=qwen3-tts request={} status={} body={}",endpoint.getId(),id,response.statusCode(),body);
                throw fail("STUDIO_SPEECH_DOWNLOAD_FAILED","音频暂未取回，正在恢复原任务");
            }
            bytes=stream.readNBytes(20*1024*1024+1);
        }
        if(bytes.length<128 || bytes.length>20*1024*1024) throw fail("STUDIO_SPEECH_BAD_AUDIO","配音文件大小不正确，正在核对原任务");
        return inspect(bytes);
    }
    /** Probe actual media; JSON/error documents and empty placeholder audio cannot count as success. */
    static Audio inspect(byte[] bytes) throws Exception {
        Path file=Files.createTempFile("studio-speech-", ".media");
        try {
            Files.write(file,bytes);
            Process p=new ProcessBuilder("ffprobe","-v","error","-show_streams","-show_format","-of","json",file.toString()).redirectError(ProcessBuilder.Redirect.DISCARD).start();
            if(!p.waitFor(20,TimeUnit.SECONDS)){p.destroyForcibly();throw new IllegalStateException("Audio probe timeout");}
            JsonNode probe=new ObjectMapper().readTree(p.getInputStream().readAllBytes());
            if(p.exitValue()!=0 || probe==null || probe.path("streams").size()!=1 || !"audio".equals(probe.path("streams").get(0).path("codec_type").asText())) throw fail("STUDIO_SPEECH_BAD_AUDIO","生成结果不是可用音频");
            double duration=probe.path("format").path("duration").asDouble(0);
            if(!Double.isFinite(duration)||duration<=0||duration>600) throw fail("STUDIO_SPEECH_BAD_AUDIO","音频时长不正确");
            String format=probe.path("format").path("format_name").asText();
            String ext=format.equals("wav")?"wav":format.equals("mp3")?"mp3":format.equals("ogg")?"ogg":format.equals("flac")?"flac":format.contains("mp4")?"m4a":null;
            if(ext==null) throw fail("STUDIO_SPEECH_BAD_AUDIO","暂不支持此音频格式");
            String mime=switch(ext){case "wav"->"audio/wav";case "mp3"->"audio/mpeg";case "ogg"->"audio/ogg";case "flac"->"audio/flac";default->"audio/mp4";};
            return new Audio(bytes,ext,mime,duration);
        } finally { Files.deleteIfExists(file); }
    }
    /** Host, path and model scope are checked before attaching Bearer to a returned URL. */
    static URI scopedUri(String base,String url,String prefix,String id) {
        URI origin=URI.create(base),uri=origin.resolve(url);
        String path=origin.getPath().replaceAll("/$", "")+prefix;
        String expected=id==null?path:path+id;
        String query=uri.getRawQuery();
        boolean scope=query!=null && Arrays.stream(query.split("&")).anyMatch(p->p.equals("model=qwen3-tts"));
        if(!Objects.equals(origin.getScheme(),uri.getScheme()) || !Objects.equals(origin.getHost(),uri.getHost())
                || origin.getPort()!=uri.getPort() || uri.getUserInfo()!=null || uri.getFragment()!=null
                || !uri.getPath().startsWith(expected) || id!=null&&!uri.getPath().equals(expected) || !scope)
            throw fail("STUDIO_SPEECH_URL_INVALID","配音服务返回了不正确的任务地址");
        return uri;
    }
    private JsonNode json(AiModelEndpoint endpoint,String url,String body,String id,String owner) {
        HttpRequest.Builder builder=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(25))
                .header("Authorization","Bearer "+AepCryptoUtil.decrypt(endpoint.getUpstreamApiKeyEncrypted()));
        if(body==null)builder.GET();else builder.header("Content-Type","application/json").header("Idempotency-Key",id)
                .header("X-Client-Request-Id",id).POST(HttpRequest.BodyPublishers.ofString(body));
        var ctx=ModelCallCtx.builder(AiModelPurpose.DAP_AUDIO).endpoint(endpoint.getId(),endpoint.getName())
                .model("qwen3-tts").requestId(id).ownerUserId(owner).appCode("aiavatar").client(http)
                .requestBodyJson(body).recordFailureUsage(body!=null).maxAttempts(1).build();
        var response=upstream.sendJson(builder.build(),ctx);
        if(response.statusCode()/100!=2) {
            if(body!=null && response.statusCode()>=400 && response.statusCode()<500 && response.statusCode()!=408)
                throw new Rejected("STUDIO_SPEECH_REJECTED",safeMessage(response.body()));
            throw fail("STUDIO_SPEECH_UNAVAILABLE","配音服务暂时不可用，正在核对原任务");
        }
        try {return mapper.readTree(response.body());}
        catch(Exception e){upstream.recordBadOutput(ctx,response.body(),"STUDIO_SPEECH_BAD_OUTPUT");throw fail("STUDIO_SPEECH_BAD_OUTPUT","配音任务尚未确认，正在核对原请求");}
    }
    private String safeMessage(String body) {
        try {String msg=mapper.readTree(body).path("error").path("message").asText();if(!msg.isBlank()&&msg.length()<300)return "配音请求被拒绝："+msg;}catch(Exception ignored){}
        return "配音请求被拒绝，请检查文案与音色";
    }
    public static class Rejected extends BusinessException {
        public Rejected(String code,String message){super(HttpStatus.BAD_REQUEST,code,message);}
    }
    private static BusinessException fail(String code,String msg){return new BusinessException(HttpStatus.BAD_GATEWAY,code,msg);}
}
