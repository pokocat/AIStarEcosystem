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
import java.net.URLEncoder;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Duration;
import java.util.*;
import java.util.function.Consumer;
import java.util.function.LongConsumer;

/** Endpoint-configured image transport for Studio. */
@Component
public class JusuanImageClient {
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.service.AiModelUsageService usage;
    private final AiModelInvocationService models;
    private final FileStorageService storage;
    private final UpstreamModelHttp upstream;
    private final ObjectMapper mapper;
    private final HttpClient http;
    private final LongConsumer pause;
    @org.springframework.beans.factory.annotation.Autowired
    public JusuanImageClient(AiModelInvocationService models,FileStorageService storage,UpstreamModelHttp upstream,ObjectMapper mapper) {
        this(models,storage,upstream,mapper,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).followRedirects(HttpClient.Redirect.NEVER).build(),millis->{
            try {Thread.sleep(millis);}catch(InterruptedException e){Thread.currentThread().interrupt();throw failure("生成任务已中断");}
        });
    }
    JusuanImageClient(AiModelInvocationService models,FileStorageService storage,UpstreamModelHttp upstream,ObjectMapper mapper,HttpClient http,LongConsumer pause) {
        this.models=models;this.storage=storage;this.upstream=upstream;this.mapper=mapper;this.http=http;this.pause=pause;
    }
    public static boolean supports(AiModelEndpoint endpoint) {
        try {
            if(endpoint.getImageRequestSpecJson()==null || endpoint.getImageRequestSpecJson().isBlank())return false;
            URI uri=URI.create(endpoint.getBaseUrl());
            return "https".equals(uri.getScheme()) && uri.getHost()!=null && uri.getUserInfo()==null
                    && uri.getQuery()==null && uri.getFragment()==null;
        }catch(RuntimeException e){return false;}
    }
    public boolean supportsEndpoint(String id) {return id!=null && models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,id,"studio").map(r->supports(r.endpoint())).orElse(false);}
    public static void validate(AiModelEndpoint endpoint,String prompt,int references,String size) {
        validate(endpoint,prompt,references,size,null);
    }
    private static void validate(AiModelEndpoint endpoint,String prompt,int references,String size,AiImageRequestSpec snapshot) {
        if(endpoint.getImageRequestSpecJson()!=null && !endpoint.getImageRequestSpecJson().isBlank() && !supports(endpoint))
            throw BusinessException.badRequest("STUDIO_IMAGE_ENDPOINT_INVALID","图片模型的调用地址必须是有效的 HTTPS 地址");
        if(!supports(endpoint))return;
        var spec=snapshot==null?requiredSpec(endpoint):snapshot;
        if(prompt.codePointCount(0,prompt.length())>spec.promptMaxChars())throw BusinessException.badRequest("STUDIO_IMAGE_PROMPT_TOO_LONG","当前图片模型的提示词最多 "+spec.promptMaxChars()+" 字，请缩短后再生成");
        if(references<spec.minReferenceImages() || references>spec.maxReferenceImages())
            throw BusinessException.badRequest("STUDIO_IMAGE_REFERENCES_INVALID",spec.maxReferenceImages()==0?"当前图片模型仅支持文生图":
                    "当前图片模型需要 "+spec.minReferenceImages()+" 至 "+spec.maxReferenceImages()+" 张参考图");
        if(spec.output(size)==null)throw BusinessException.badRequest("STUDIO_IMAGE_SIZE_UNSUPPORTED","当前图片模型不支持所选画幅，请更换画幅或图片模型");
    }
    public byte[] generate(String endpointId,String prompt,String size,List<String> keys,String requestId,String owner,Consumer<String> progress) {
        return generate(endpointId,prompt,size,keys,requestId,owner,progress,null);
    }
    public byte[] generate(String endpointId,String prompt,String size,List<String> keys,String requestId,String owner,Consumer<String> progress,AiImageRequestSpec snapshot) {
        var endpoint=models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,endpointId,"studio").orElseThrow(()->failure("图片模型已停用")).endpoint();
        validate(endpoint,prompt,keys.size(),size,snapshot);
        if(!supports(endpoint))throw failure("图片模型未配置可用的请求协议");
        var spec=snapshot==null?requiredSpec(endpoint):snapshot;
        var wire=spec.wire();
        boolean urlInput=wire!=null && "url".equals(wire.inputMode());
        String resultMode=configured(wire==null?null:wire.resultMode(),"async-asset");
        List<String> references=new ArrayList<>();
        for(int i=0;i<keys.size();i++)references.add(urlInput
                ?referenceUrl(wire,keys.get(i))
                :upload(endpoint,wire,keys.get(i),requestId+"-ref-"+i,owner));
        ObjectNode body=requestBody(endpoint,spec,size,prompt,references,requestId);
        String submitPath=fillPath(configured(wire==null?null:wire.submitPath(),"/images/generations"),"",endpoint.getModel());
        JsonNode accepted=json(endpoint,wire,submitPath,body.toString(),requestId,owner,"POST",true);
        if(resultMode.startsWith("sync-")) {
            byte[] bytes=resultBytes(endpoint,wire,pointerText(accepted,wire.outputPointer()),resultMode);
            recordSuccess(endpoint,owner,requestId,null,body);
            return bytes;
        }
        String id=wire!=null && wire.submitIdPointer()!=null?pointerText(accepted,wire.submitIdPointer())
                :accepted.path("id").asText(accepted.path("jobId").asText());requireId(id);
        org.slf4j.LoggerFactory.getLogger(getClass()).info("[studio-jusuan-image] accepted request={} endpoint={} job={}",requestId,endpointId,id);
        progress.accept("image.provider.queued");
        for(int poll=0;poll<setting(wire==null?null:wire.maxPollAttempts(),900);poll++) {
            String pollPath=fillPath(configured(wire==null?null:wire.pollPathTemplate(),"/jobs/{id}"),id,endpoint.getModel());
            String pollMethod=configured(wire==null?null:wire.pollMethod(),"GET");
            String pollBody=null;
            if("POST".equals(pollMethod) && wire!=null && wire.pollTemplate()!=null) {
                Map<String,Object> variables=Map.of("id",id,"model",endpoint.getModel()==null?"":endpoint.getModel(),"requestId",requestId);
                pollBody=mapper.valueToTree(renderTemplate(wire.pollTemplate(),variables)).toString();
            }
            JsonNode job=json(endpoint,wire,pollPath,pollBody,requestId,owner,pollMethod,false);
            String status=wire!=null && wire.statusPointer()!=null?pointerText(job,wire.statusPointer()):job.path("status").asText();
            if(statusIn(status,wire==null?null:wire.failed(),Set.of("failed","cancelled","canceled","expired")))throw failure("图片任务失败，请检查提示词和参考图后重试");
            if(statusIn(status,wire==null?null:wire.succeeded(),Set.of("succeeded","completed","done"))) {
                byte[] bytes;
                if("async-url".equals(resultMode))bytes=resultBytes(endpoint,wire,pointerText(job,wire.outputPointer()),resultMode);
                else {
                    String asset=wire!=null && wire.outputAssetIdPointer()!=null?pointerText(job,wire.outputAssetIdPointer()):assetId(job);
                    requireId(asset);bytes=download(endpoint,wire,asset);
                }
                recordSuccess(endpoint,owner,requestId,id,body);
                return bytes;
            }
            progress.accept("queued".equals(status)?"image.provider.queued":"image.provider.processing");
            if(poll+1<setting(wire==null?null:wire.maxPollAttempts(),900))pause.accept(setting(wire==null?null:wire.pollIntervalMillis(),2000));
        }
        throw failure("图片任务等待超时，请稍后查询任务结果");
    }
    private ObjectNode requestBody(AiModelEndpoint endpoint,AiImageRequestSpec spec,String size,String prompt,
                                   List<String> references,String requestId) {
        var output=spec.output(size);
        var wire=spec.wire();
        boolean urlInput=wire!=null && "url".equals(wire.inputMode());
        if(wire==null || wire.submitTemplate()==null) {
            ObjectNode body=mapper.createObjectNode().put("model",endpoint.getModel()).put("prompt",prompt);
            output.providerFields().forEach((field,value)->body.set(field,mapper.valueToTree(value)));
            if("multiple".equals(spec.referenceField())&&!references.isEmpty())
                references.forEach(body.putArray(urlInput?"input_image_urls":"input_image_asset_ids")::add);
            if("single".equals(spec.referenceField()))body.put(urlInput?"input_image_url":"input_image_asset_id",references.get(0));
            return body;
        }
        Map<String,Object> variables=new HashMap<>();
        variables.put("model",endpoint.getModel());variables.put("prompt",prompt);
        variables.put("assetId",urlInput?null:references.isEmpty()?null:references.get(0));
        variables.put("assetIds",urlInput?List.of():references);
        variables.put("referenceUrl",urlInput&&!references.isEmpty()?references.get(0):null);
        variables.put("referenceUrls",urlInput?references:List.of());
        variables.put("canvasSize",size);variables.put("aspectRatio",output.aspectRatio());
        variables.put("requestId",requestId);variables.put("providerFields",output.providerFields());
        ObjectNode body=mapper.valueToTree(renderTemplate(wire.submitTemplate(),variables));
        if(!containsVariable(wire.submitTemplate(),"providerFields"))
            output.providerFields().forEach((field,value)->body.set(field,mapper.valueToTree(value)));
        return body;
    }
    private static boolean containsVariable(Object value,String name) {
        if(value instanceof String text)return text.equals("${"+name+"}");
        if(value instanceof Map<?,?> map)return map.values().stream().anyMatch(item->containsVariable(item,name));
        if(value instanceof List<?> list)return list.stream().anyMatch(item->containsVariable(item,name));
        return false;
    }
    private static Object renderTemplate(Object value,Map<String,Object> variables) {
        if(value instanceof String text && text.startsWith("${") && text.endsWith("}"))return variables.get(text.substring(2,text.length()-1));
        if(value instanceof Map<?,?> map) {
            Map<String,Object> result=new LinkedHashMap<>();
            map.forEach((key,item)->result.put((String)key,renderTemplate(item,variables)));
            return result;
        }
        if(value instanceof List<?> list)return list.stream().map(item->renderTemplate(item,variables)).toList();
        return value;
    }
    private String upload(AiModelEndpoint endpoint,AiImageRequestSpec.Wire wire,String key,String id,String owner) {
        try {
            int maxBytes=setting(wire==null?null:wire.maxReferenceBytes(),16*1024*1024);
            var file=storage.openForRead(key);if(Files.size(file)>maxBytes)throw failure("参考图超过端点配置的大小上限");
            byte[] bytes=Files.readAllBytes(file);var format=MediaBytes.sniff("image",bytes);
            if(format==null || bytes.length>maxBytes)throw failure("参考图格式不支持或超过端点配置的大小上限");
            String boundary="studio-image-"+UUID.randomUUID();
            String field=configured(wire==null?null:wire.uploadFieldName(),"image");
            byte[] head=("--"+boundary+"\r\nContent-Disposition: form-data; name=\""+field+"\"; filename=\"reference."+format.ext()+"\"\r\nContent-Type: "+format.mime()+"\r\n\r\n").getBytes(StandardCharsets.UTF_8);
            var body=HttpRequest.BodyPublishers.concat(HttpRequest.BodyPublishers.ofByteArray(head),HttpRequest.BodyPublishers.ofByteArray(bytes),HttpRequest.BodyPublishers.ofString("\r\n--"+boundary+"--\r\n"));
            String uploadPath=fillPath(configured(wire==null?null:wire.uploadPath(),"/assets/input"),"",endpoint.getModel());
            var request=request(endpoint,wire,uploadPath)
                    .header("Content-Type","multipart/form-data; boundary="+boundary).POST(body).build();
            JsonNode accepted=checked(upstream.sendJson(request,context(endpoint,id,owner,null,false)));
            String asset=wire!=null && wire.uploadAssetIdPointer()!=null?pointerText(accepted,wire.uploadAssetIdPointer())
                    :accepted.path("asset").path("assetId").asText();
            requireId(asset);return asset;
        }catch(BusinessException e){throw e;}catch(Exception e){throw failure("参考图上传失败，请稍后重试");}
    }
    private String referenceUrl(AiImageRequestSpec.Wire wire,String key) {
        try {
            int maxBytes=setting(wire.maxReferenceBytes(),16*1024*1024);
            var file=storage.openForRead(key);
            if(Files.size(file)<1 || Files.size(file)>maxBytes)throw failure("参考图超过端点配置的大小上限");
            byte[] head;
            try(var input=Files.newInputStream(file)){head=input.readNBytes(64);}
            if(MediaBytes.sniff("image",head)==null)throw failure("参考图格式不支持");
            String url=storage.upstreamFetchUrl(key);
            URI uri=URI.create(url==null?"":url);
            if(!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null
                    || uri.getFragment()!=null)
                throw failure("参考图没有可供供应商读取的 HTTPS 地址");
            return url;
        }catch(BusinessException e){throw e;}catch(Exception e){throw failure("参考图地址不可用");}
    }

    private byte[] resultBytes(AiModelEndpoint endpoint,AiImageRequestSpec.Wire wire,String value,String mode) {
        if(value==null || value.isBlank())throw failure("图片结果缺少端点配置的输出字段");
        if("sync-base64".equals(mode)) {
            String encoded=value;
            if(encoded.startsWith("data:image/")) {
                int marker=encoded.indexOf(";base64,");
                if(marker<0)throw failure("图片结果编码无效");
                encoded=encoded.substring(marker+8);
            }
            int maxBytes=setting(wire.maxOutputBytes(),64*1024*1024);
            if(encoded.length()>((long)maxBytes+2)/3*4+4)throw failure("图片结果超过端点配置的大小上限");
            try{return checkedImage(Base64.getDecoder().decode(encoded),maxBytes);}
            catch(IllegalArgumentException e){throw failure("图片结果编码无效");}
        }
        return downloadUrl(endpoint,wire,value);
    }

    private byte[] downloadUrl(AiModelEndpoint endpoint,AiImageRequestSpec.Wire wire,String value) {
        try {
            URI uri=URI.create(value);
            String host=uri.getHost();
            if(!"https".equalsIgnoreCase(uri.getScheme()) || host==null || uri.getUserInfo()!=null
                    || uri.getFragment()!=null || !(host.equalsIgnoreCase(URI.create(endpoint.getBaseUrl()).getHost())
                    || wire.outputHosts()!=null && wire.outputHosts().stream().anyMatch(host::equalsIgnoreCase))
                    || !publicHost(host))throw failure("图片结果地址不在端点允许的 HTTPS 域名内");
            var response=http.send(HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofMillis(setting(wire.requestTimeoutMillis(),90000))).GET().build(),
                    HttpResponse.BodyHandlers.ofInputStream());
            try(var input=response.body()) {
                if(response.statusCode()/100!=2)throw failure("图片结果下载失败");
                int maxBytes=setting(wire.maxOutputBytes(),64*1024*1024);
                return checkedImage(input.readNBytes(maxBytes+1),maxBytes);
            }
        }catch(BusinessException e){throw e;}catch(Exception e){throw failure("图片结果下载失败");}
    }

    private static boolean publicHost(String host) {
        try {
            InetAddress[] addresses=InetAddress.getAllByName(host);
            if(addresses.length==0)return false;
            for(InetAddress address:addresses) {
                if(address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress())return false;
                byte[] bytes=address.getAddress();
                if(address instanceof Inet4Address) {
                    int first=bytes[0]&255,second=bytes[1]&255;
                    if(first==0 || first>=224 || first==100&&(second&0xC0)==64
                            || first==198&&(second==18||second==19))return false;
                } else if(address instanceof Inet6Address && (bytes[0]&0xFE)==0xFC)return false;
            }
            return true;
        }catch(Exception e){return false;}
    }

    private static byte[] checkedImage(byte[] bytes,int maxBytes) {
        if(bytes.length==0 || bytes.length>maxBytes || MediaBytes.sniff("image",bytes)==null)
            throw failure("图片结果不可用或超过端点配置的大小上限");
        return bytes;
    }

    private void recordSuccess(AiModelEndpoint endpoint,String owner,String requestId,String providerJobId,ObjectNode body) {
        if(usage!=null)try {usage.recordMeteredObservedWithAttribution(endpoint.getId(),endpoint.getName(),endpoint.getModel(),AiModelPurpose.DAP_IMAGE.name(),
                0L,0L,0L,AiModelBillingMode.PER_CALL,1L,0L,true,owner,null,"aiavatar",requestId,providerJobId,null,null,null,body.toString(),null,null);}catch(RuntimeException ignored){}
    }
    private JsonNode json(AiModelEndpoint endpoint,AiImageRequestSpec.Wire wire,String path,String body,
                          String id,String owner,String method,boolean submit) {
        var request=request(endpoint,wire,path);
        if("GET".equals(method))request.GET();else {
            if(body!=null)request.header("Content-Type","application/json");
            if(submit) {
                String header=wire==null?"Idempotency-Key":configured(wire.idempotencyHeaderName(),"Idempotency-Key");
                if(!header.isEmpty())request.header(header,id);
            }
            request.POST(body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body));
        }
        return checked(upstream.sendJson(request.build(),context(endpoint,id,owner,body,submit)));
    }
    private HttpRequest.Builder request(AiModelEndpoint endpoint,AiImageRequestSpec.Wire wire,String path) {
        String queryName=wire==null?"model":configured(wire.modelQueryParam(),"model");
        String url=endpoint.getBaseUrl().replaceAll("/$","")+path;
        if(!queryName.isEmpty() && endpoint.getModel()!=null && !endpoint.getModel().isBlank())
            url+=(path.contains("?")?"&":"?")+queryName+"="+URLEncoder.encode(endpoint.getModel(),StandardCharsets.UTF_8);
        String header=wire==null?"Authorization":configured(wire.authHeaderName(),"Authorization");
        String prefix=wire==null?"Bearer ":configured(wire.authPrefix(),"Bearer ");
        return HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofMillis(setting(wire==null?null:wire.requestTimeoutMillis(),90000)))
                .header(header,prefix+AepCryptoUtil.decrypt(endpoint.getUpstreamApiKeyEncrypted()));
    }
    private byte[] download(AiModelEndpoint endpoint,AiImageRequestSpec.Wire wire,String id) {
        try {
            String path=fillPath(configured(wire==null?null:wire.downloadPathTemplate(),"/assets/{id}/content"),id,endpoint.getModel());
            var response=http.send(request(endpoint,wire,path).GET().build(),HttpResponse.BodyHandlers.ofInputStream());
            try(var in=response.body()) {
                if(response.statusCode()/100!=2)throw failure("图片结果下载失败");
                int maxBytes=setting(wire==null?null:wire.maxOutputBytes(),64*1024*1024);
                byte[] bytes=in.readNBytes(maxBytes+1);
                if(bytes.length==0 || bytes.length>maxBytes || MediaBytes.sniff("image",bytes)==null)throw failure("图片结果不可用");
                return bytes;
            }
        }catch(BusinessException e){throw e;}catch(Exception e){throw failure("图片结果下载失败");}
    }
    private static String configured(String value,String fallback) {return value==null?fallback:value;}
    private static int setting(Integer value,int fallback) {return value==null?fallback:value;}
    private static String fillPath(String template,String id,String model) {
        return template.replace("{id}",URLEncoder.encode(id,StandardCharsets.UTF_8))
                .replace("{model}",URLEncoder.encode(model==null?"":model,StandardCharsets.UTF_8));
    }
    private static String pointerText(JsonNode root,String pointer) {
        JsonNode value=root.at(pointer);
        return value.isValueNode()&&!value.isNull()?value.asText(null):null;
    }
    private static boolean statusIn(String status,List<String> configured,Set<String> fallback) {
        if(status==null)return false;
        if(configured==null)return fallback.contains(status.toLowerCase(Locale.ROOT));
        return configured.stream().anyMatch(value->value.equalsIgnoreCase(status));
    }
    private ModelCallCtx context(AiModelEndpoint endpoint,String id,String owner,String body,boolean submit) {
        return ModelCallCtx.builder(AiModelPurpose.DAP_IMAGE).endpoint(endpoint.getId(),endpoint.getName()).model(endpoint.getModel()).requestId(id).ownerUserId(owner)
                .appCode("studio").client(http).requestBodyJson(body).recordFailureUsage(submit).maxAttempts(1).build();
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
    private static AiImageRequestSpec requiredSpec(AiModelEndpoint endpoint){
        AiImageRequestSpec spec=AiImageRequestSpec.read(endpoint.getImageRequestSpecJson());
        if(spec==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_IMAGE_SPEC_NOT_CONFIGURED","当前图片模型尚未配置合法请求规格");
        return spec;
    }
    private static void requireId(String id){if(id==null || !id.matches("[a-zA-Z0-9_-]{1,128}"))throw failure("聚算图片任务或产物编号无效");}
    private static BusinessException failure(String message){return new BusinessException(HttpStatus.BAD_GATEWAY,"STUDIO_IMAGE_PROVIDER_FAILED",message);}
}
