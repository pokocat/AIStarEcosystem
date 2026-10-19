package com.aistareco.aep.ipstudio.service;

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

/** X-Dub native contract: stage owned video/WAV, then one idempotent async media job. */
@Component
public class JusuanLipSyncClient {
    private final UpstreamModelHttp upstream; private final ObjectMapper mapper;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
    public JusuanLipSyncClient(UpstreamModelHttp upstream,ObjectMapper mapper){this.upstream=upstream;this.mapper=mapper;}
    public static boolean supports(AiModelEndpoint endpoint) {
        try {URI base=URI.create(endpoint.getBaseUrl());return "x-dub".equals(endpoint.getModel())&&"https".equals(base.getScheme())&&"api.jusuanhub.com".equals(base.getHost())
                &&(base.getPort()==-1||base.getPort()==443)&&base.getUserInfo()==null&&base.getQuery()==null&&base.getFragment()==null&&Set.of("/v1","/v1/").contains(base.getPath());}
        catch(RuntimeException e){return false;}
    }
    public String upload(AiModelEndpoint endpoint,String base,Path file,String role,String id,String owner) throws Exception {
        if(!Set.of("video","audio").contains(role))throw new IllegalArgumentException("Invalid upload role");
        String boundary="studio-"+UUID.randomUUID();String mime="video".equals(role)?"video/mp4":"audio/wav";
        String header="--"+boundary+"\r\nContent-Disposition: form-data; name=\""+role+"\"; filename=\"input."+("video".equals(role)?"mp4":"wav")+"\"\r\nContent-Type: "+mime+"\r\n\r\n";
        var publisher=HttpRequest.BodyPublishers.concat(HttpRequest.BodyPublishers.ofByteArray(header.getBytes(StandardCharsets.UTF_8)),HttpRequest.BodyPublishers.ofFile(file),HttpRequest.BodyPublishers.ofByteArray(("\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8)));
        var request=HttpRequest.newBuilder(URI.create(base+"/assets/input?model=x-dub")).timeout(Duration.ofSeconds(90))
                .header("Authorization","Bearer "+key(endpoint)).header("Content-Type","multipart/form-data; boundary="+boundary)
                .header("X-Client-Request-Id",id+"-"+role).POST(publisher).build();
        var response=upstream.sendJson(request,context(endpoint,id,owner,null));
        JsonNode result=checked(response,true);String asset=result.path("asset").path("assetId").asText();
        if(!asset.matches("[a-zA-Z0-9_-]{1,128}"))throw fail("STUDIO_LIP_SYNC_BAD_OUTPUT","口型素材尚未确认，正在恢复原任务");
        return asset;
    }
    public JusuanSpeechClient.Job submit(AiModelEndpoint endpoint,String base,String body,String id,String owner) {
        JsonNode result=json(endpoint,base+"/media/generations",body,id,owner);
        String jobId=result.path("jobId").asText(result.path("id").asText());
        if(!jobId.matches("[a-zA-Z0-9_-]{1,128}"))throw fail("STUDIO_LIP_SYNC_BAD_OUTPUT","口型任务尚未确认，正在核对原请求");
        String url=result.path("jobUrl").asText(base+"/jobs/"+jobId+"?model=x-dub");scopedUri(base,url,"/jobs/",jobId);
        return new JusuanSpeechClient.Job(jobId,url);
    }
    public JsonNode poll(AiModelEndpoint endpoint,String base,String jobUrl,String id,String owner) {
        scopedUri(base,jobUrl,"/jobs/",null);return json(endpoint,jobUrl,null,id,owner);
    }
    public record Video(byte[] bytes,double durationSec,int width,int height) {}
    public Video download(AiModelEndpoint endpoint,String base,String contentUrl,String id) throws Exception {
        var request=HttpRequest.newBuilder(scopedUri(base,contentUrl,"/assets/",null)).timeout(Duration.ofSeconds(90)).header("Authorization","Bearer "+key(endpoint)).GET().build();
        var response=http.send(request,HttpResponse.BodyHandlers.ofInputStream());byte[] bytes;
        try(var stream=response.body()) {
            if(response.statusCode()/100!=2){org.slf4j.LoggerFactory.getLogger(getClass()).warn("[lip-sync] download failed endpoint={} request={} status={}",endpoint.getId(),id,response.statusCode());throw fail("STUDIO_LIP_SYNC_DOWNLOAD_FAILED","口型视频暂未取回，正在恢复原任务");}
            bytes=stream.readNBytes(128*1024*1024+1);
        }
        if(bytes.length<128||bytes.length>128*1024*1024)throw fail("STUDIO_LIP_SYNC_BAD_VIDEO","口型结果大小不正确");
        Path file=Files.createTempFile("studio-lips-",".mp4");
        try {
            Files.write(file,bytes);JsonNode probe=StudioLipSyncMedia.probe(file),video=null;int videoCount=0,audioCount=0;
            for(JsonNode stream:probe.path("streams")){if("video".equals(stream.path("codec_type").asText())){video=stream;videoCount++;}if("audio".equals(stream.path("codec_type").asText()))audioCount++;}
            double seconds=probe.path("format").path("duration").asDouble();
            if(videoCount!=1||audioCount!=1||!Double.isFinite(seconds)||seconds<=0||seconds>61||video.path("width").asInt()<=0||video.path("height").asInt()<=0)
                throw fail("STUDIO_LIP_SYNC_BAD_VIDEO","口型结果不是可播放的音视频");
            return new Video(bytes,seconds,video.path("width").asInt(),video.path("height").asInt());
        } finally {Files.deleteIfExists(file);}
    }
    static URI scopedUri(String base,String url,String prefix,String id) {
        URI origin=URI.create(base),uri=origin.resolve(url);String expected=origin.getPath().replaceAll("/$","")+prefix+(id==null?"":id);
        boolean scope=uri.getRawQuery()!=null&&Arrays.stream(uri.getRawQuery().split("&")).anyMatch(p->"model=x-dub".equals(p));
        if(!Objects.equals(origin.getScheme(),uri.getScheme())||!Objects.equals(origin.getHost(),uri.getHost())||origin.getPort()!=uri.getPort()
                ||uri.getUserInfo()!=null||uri.getFragment()!=null||!uri.getPath().startsWith(expected)||id!=null&&!uri.getPath().equals(expected)||!scope)
            throw fail("STUDIO_LIP_SYNC_URL_INVALID","口型服务返回了不正确的任务地址");
        return uri;
    }
    private JsonNode json(AiModelEndpoint endpoint,String url,String body,String id,String owner) {
        var builder=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(25)).header("Authorization","Bearer "+key(endpoint));
        if(body==null)builder.GET();else builder.header("Content-Type","application/json").header("Idempotency-Key",id).header("X-Client-Request-Id",id).POST(HttpRequest.BodyPublishers.ofString(body));
        return checked(upstream.sendJson(builder.build(),context(endpoint,id,owner,body)),body!=null);
    }
    private ModelCallCtx context(AiModelEndpoint endpoint,String id,String owner,String body) {
        return ModelCallCtx.builder(AiModelPurpose.DAP_LIP_SYNC).endpoint(endpoint.getId(),endpoint.getName()).model("x-dub").requestId(id).ownerUserId(owner).appCode("aiavatar")
                .client(http).requestBodyJson(body).recordFailureUsage(body!=null).maxAttempts(1).build();
    }
    private JsonNode checked(HttpResponse<String> response,boolean create) {
        if(response.statusCode()/100!=2) {
            if(create&&response.statusCode()>=400&&response.statusCode()<500&&response.statusCode()!=408)
                throw new JusuanSpeechClient.Rejected("STUDIO_LIP_SYNC_REJECTED","口型请求被拒绝，请检查源视频是否有清晰的单人正脸，以及配音时长");
            throw fail("STUDIO_LIP_SYNC_UNAVAILABLE","口型服务暂时不可用，正在核对原任务");
        }
        try{return mapper.readTree(response.body());}catch(Exception e){throw fail("STUDIO_LIP_SYNC_BAD_OUTPUT","口型任务尚未确认，正在核对原请求");}
    }
    private static String key(AiModelEndpoint e){return AepCryptoUtil.decrypt(e.getUpstreamApiKeyEncrypted());}
    private static BusinessException fail(String code,String message){return new BusinessException(HttpStatus.BAD_GATEWAY,code,message);}
}
