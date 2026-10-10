package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.model.*;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.ai.*;
import com.aistareco.aep.service.storage.*;
import com.aistareco.common.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Duration;
import java.util.*;
import java.util.function.Consumer;

/** Jusuan images use protected input assets and async Jobs, rather than OpenAI's inline result. */
@Component
public class JusuanImageClient {
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.service.AiModelUsageService usage;
    private final AiModelInvocationService models;
    private final FileStorageService storage;
    private final UpstreamModelHttp upstream;
    private final ObjectMapper mapper;
    private final HttpClient http;
    private final Runnable pause;
    @org.springframework.beans.factory.annotation.Autowired
    public JusuanImageClient(AiModelInvocationService models,FileStorageService storage,UpstreamModelHttp upstream,ObjectMapper mapper) {
        this(models,storage,upstream,mapper,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).followRedirects(HttpClient.Redirect.NEVER).build(),()->{
            try {Thread.sleep(2000);}catch(InterruptedException e){Thread.currentThread().interrupt();throw failure("生成任务已中断");}
        });
    }
    JusuanImageClient(AiModelInvocationService models,FileStorageService storage,UpstreamModelHttp upstream,ObjectMapper mapper,HttpClient http,Runnable pause) {
        this.models=models;this.storage=storage;this.upstream=upstream;this.mapper=mapper;this.http=http;this.pause=pause;
    }
    public static boolean supports(AiModelEndpoint endpoint) {
        try {
            URI uri=URI.create(endpoint.getBaseUrl());
            return "https".equals(uri.getScheme()) && "api.jusuanhub.com".equals(uri.getHost()) && uri.getUserInfo()==null
                    && uri.getQuery()==null && uri.getFragment()==null && Set.of("flux2-klein-4b","longcat-image-edit","ernie-Image").contains(endpoint.getModel());
        }catch(RuntimeException e){return false;}
    }
    public boolean supportsEndpoint(String id) {return id!=null && models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,id).map(r->supports(r.endpoint())).orElse(false);}
    public static void validate(AiModelEndpoint endpoint,String prompt,int references) {
        if(!supports(endpoint))return;
        int limit=switch(endpoint.getModel()){case "flux2-klein-4b"->500;case "longcat-image-edit"->1200;default->2048;};
        int max=switch(endpoint.getModel()){case "flux2-klein-4b"->5;case "longcat-image-edit"->1;default->0;};
        if(prompt.codePointCount(0,prompt.length())>limit)throw BusinessException.badRequest("STUDIO_IMAGE_PROMPT_TOO_LONG","当前图片模型的提示词最多 "+limit+" 字，请缩短后再生成");
        if(references>max || "longcat-image-edit".equals(endpoint.getModel())&&references!=1)
            throw BusinessException.badRequest("STUDIO_IMAGE_REFERENCES_INVALID","当前图片模型"+(max==0?"仅支持文生图":"最多支持 "+max+" 张参考图")+("longcat-image-edit".equals(endpoint.getModel())?"，请选择一张参考图":""));
    }
    public byte[] generate(String endpointId,String prompt,String size,List<String> keys,String requestId,String owner,Consumer<String> progress) {
        var endpoint=models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,endpointId).orElseThrow(()->failure("图片模型已停用")).endpoint();
        validate(endpoint,prompt,keys.size());
        if(!supports(endpoint))throw failure("图片模型不支持聚算图片协议");
        ObjectNode body=mapper.createObjectNode().put("model",endpoint.getModel()).put("prompt",prompt);
        if("flux2-klein-4b".equals(endpoint.getModel()))body.put("size",fluxSize(size));
        else if("ernie-Image".equals(endpoint.getModel()))body.put("resolutionTier","720p").put("orientation",orientation(size)).put("imageCount",1);
        List<String> assets=new ArrayList<>();
        for(int i=0;i<keys.size();i++)assets.add(upload(endpoint,keys.get(i),requestId+"-ref-"+i,owner));
        if("flux2-klein-4b".equals(endpoint.getModel())&&!assets.isEmpty())assets.forEach(body.putArray("input_image_asset_ids")::add);
        if("longcat-image-edit".equals(endpoint.getModel()))body.put("input_image_asset_id",assets.get(0));
        JsonNode accepted=json(endpoint,"/images/generations",body.toString(),requestId,owner);
        String id=accepted.path("id").asText(accepted.path("jobId").asText());requireId(id);
        org.slf4j.LoggerFactory.getLogger(getClass()).info("[studio-jusuan-image] accepted request={} endpoint={} job={}",requestId,endpointId,id);
        progress.accept("image.provider.queued");
        for(int poll=0;poll<900;poll++) {
            JsonNode job=json(endpoint,"/jobs/"+id,null,requestId,owner);
            String status=job.path("status").asText();
            if(Set.of("failed","cancelled","canceled","expired").contains(status))throw failure("聚算图片任务失败，请检查提示词和参考图后重试");
            if(Set.of("succeeded","completed","done").contains(status)) {
                String asset=assetId(job);requireId(asset);byte[] bytes=download(endpoint,asset);
                if(usage!=null)try {usage.recordMeteredObservedWithAttribution(endpoint.getId(),endpoint.getName(),endpoint.getModel(),AiModelPurpose.DAP_IMAGE.name(),
                        0L,0L,0L,AiModelBillingMode.PER_CALL,1L,0L,true,owner,null,"aiavatar",requestId,id,null,null,null,body.toString(),null,null);}catch(RuntimeException ignored){}
                return bytes;
            }
            progress.accept("queued".equals(status)?"image.provider.queued":"image.provider.processing");pause.run();
        }
        throw failure("聚算图片任务等待超时，请稍后查询任务结果");
    }
    private String upload(AiModelEndpoint endpoint,String key,String id,String owner) {
        try {
            var file=storage.openForRead(key);if(Files.size(file)>16*1024*1024)throw failure("参考图超过 16 MB");
            byte[] bytes=Files.readAllBytes(file);var format=MediaBytes.sniff("image",bytes);
            if(format==null || bytes.length>16*1024*1024)throw failure("参考图格式不支持或超过 16 MB");
            String boundary="studio-image-"+UUID.randomUUID();
            byte[] head=("--"+boundary+"\r\nContent-Disposition: form-data; name=\"image\"; filename=\"reference."+format.ext()+"\"\r\nContent-Type: "+format.mime()+"\r\n\r\n").getBytes(StandardCharsets.UTF_8);
            var body=HttpRequest.BodyPublishers.concat(HttpRequest.BodyPublishers.ofByteArray(head),HttpRequest.BodyPublishers.ofByteArray(bytes),HttpRequest.BodyPublishers.ofString("\r\n--"+boundary+"--\r\n"));
            var request=request(endpoint,"/assets/input").header("Content-Type","multipart/form-data; boundary="+boundary).POST(body).build();
            String asset=checked(upstream.sendJson(request,context(endpoint,id,owner,null))).path("asset").path("assetId").asText();requireId(asset);return asset;
        }catch(BusinessException e){throw e;}catch(Exception e){throw failure("参考图上传失败，请稍后重试");}
    }
    private JsonNode json(AiModelEndpoint endpoint,String path,String body,String id,String owner) {
        var request=request(endpoint,path);
        if(body==null)request.GET();else request.header("Content-Type","application/json").header("Idempotency-Key",id).POST(HttpRequest.BodyPublishers.ofString(body));
        return checked(upstream.sendJson(request.build(),context(endpoint,id,owner,body)));
    }
    private HttpRequest.Builder request(AiModelEndpoint endpoint,String path) {
        return HttpRequest.newBuilder(URI.create(endpoint.getBaseUrl().replaceAll("/$","")+path+"?model="+endpoint.getModel()))
                .timeout(Duration.ofSeconds(90)).header("Authorization","Bearer "+AepCryptoUtil.decrypt(endpoint.getUpstreamApiKeyEncrypted()));
    }
    private byte[] download(AiModelEndpoint endpoint,String id) {
        try {
            var response=http.send(request(endpoint,"/assets/"+id+"/content").GET().build(),HttpResponse.BodyHandlers.ofInputStream());
            try(var in=response.body()) {
                if(response.statusCode()/100!=2)throw failure("图片结果下载失败");
                byte[] bytes=in.readNBytes(64*1024*1024+1);
                if(bytes.length==0 || bytes.length>64*1024*1024 || MediaBytes.sniff("image",bytes)==null)throw failure("图片结果不可用");
                return bytes;
            }
        }catch(BusinessException e){throw e;}catch(Exception e){throw failure("图片结果下载失败");}
    }
    private ModelCallCtx context(AiModelEndpoint endpoint,String id,String owner,String body) {
        return ModelCallCtx.builder(AiModelPurpose.DAP_IMAGE).endpoint(endpoint.getId(),endpoint.getName()).model(endpoint.getModel()).requestId(id).ownerUserId(owner)
                .appCode("aiavatar").client(http).requestBodyJson(body).recordFailureUsage(body!=null).maxAttempts(1).build();
    }
    private JsonNode checked(HttpResponse<String> response) {
        if(response.statusCode()/100!=2)throw failure("聚算图片接口暂时不可用（"+response.statusCode()+"）");
        try{return mapper.readTree(response.body());}catch(Exception e){throw failure("聚算图片接口返回了无效结果");}
    }
    static String assetId(JsonNode job) {
        for(String field:List.of("outputAssetId","output_asset_id","assetId"))if(job.hasNonNull(field))return job.path(field).asText();
        for(String field:List.of("output","result","data")){String id=assetIdNested(job.path(field));if(id!=null)return id;}
        for(String field:List.of("outputs","assets","output_assets","results")){var rows=job.path(field);if(rows.isArray()&&!rows.isEmpty()){String id=rows.get(0).path("assetId").asText(rows.get(0).path("asset_id").asText(rows.get(0).path("id").asText(null)));if(id!=null)return id;
            String url=rows.get(0).path("contentUrl").asText(null);
            if(url!=null)try {String path=URI.create(url).getPath();var match=java.util.regex.Pattern.compile("/v1/assets/([a-zA-Z0-9_-]{1,128})/content").matcher(path);if(match.matches())return match.group(1);}catch(RuntimeException ignored){}}}
        return null;
    }
    private static String assetIdNested(JsonNode node){for(String field:List.of("outputAssetId","output_asset_id","assetId","asset_id"))if(node.hasNonNull(field))return node.path(field).asText();return null;}
    static String fluxSize(String size) {return switch(size==null?"":size){case "768x1024"->"864x1152";case "768x1365"->"768x1376";case "1365x768"->"1376x768";default->"1024x1024";};}
    private static String orientation(String size){return size!=null&&size.startsWith("768x")?"portrait":size!=null&&size.startsWith("1365x")?"landscape":"square";}
    private static void requireId(String id){if(id==null || !id.matches("[a-zA-Z0-9_-]{1,128}"))throw failure("聚算图片任务或产物编号无效");}
    private static BusinessException failure(String message){return new BusinessException(HttpStatus.BAD_GATEWAY,"STUDIO_IMAGE_PROVIDER_FAILED",message);}
}
