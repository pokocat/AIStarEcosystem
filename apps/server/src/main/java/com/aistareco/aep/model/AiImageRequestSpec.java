package com.aistareco.aep.model;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Image request and async asset wire rules stored on one fixed model endpoint. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiImageRequestSpec(int promptMaxChars, int minReferenceImages, int maxReferenceImages,
                                 String referenceField, List<Output> outputs, Wire wire,
                                 List<Integer> batchCounts) {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> REF_FIELDS = Set.of("none", "single", "multiple");
    private static final Set<String> RESERVED_FIELDS = Set.of("model", "prompt", "input_image_asset_id", "input_image_asset_ids",
            "input_image_url", "input_image_urls");

    public record Output(String canvasSize, String aspectRatio, Map<String, Object> providerFields) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Wire(String submitPath, String pollPathTemplate, String uploadPath,
                       String downloadPathTemplate, String uploadAssetIdPointer,
                       String submitIdPointer, String statusPointer, String outputAssetIdPointer,
                       List<String> succeeded, List<String> failed,
                       String modelQueryParam, String authHeaderName, String authPrefix,
                       String idempotencyHeaderName, String uploadFieldName,
                       Map<String, Object> submitTemplate,
                       String pollMethod, Map<String, Object> pollTemplate,
                       Integer maxReferenceBytes, Integer maxOutputBytes,
                       Integer maxPollAttempts, Integer pollIntervalMillis,
                       Integer requestTimeoutMillis,
                       String inputMode, String resultMode, String outputPointer,
                       List<String> outputHosts) {}

    public AiImageRequestSpec(int promptMaxChars, int minReferenceImages, int maxReferenceImages,
                              String referenceField, List<Output> outputs) {
        this(promptMaxChars,minReferenceImages,maxReferenceImages,referenceField,outputs,null,null);
    }

    public AiImageRequestSpec(int promptMaxChars, int minReferenceImages, int maxReferenceImages,
                              String referenceField, List<Output> outputs, Wire wire) {
        this(promptMaxChars,minReferenceImages,maxReferenceImages,referenceField,outputs,wire,null);
    }

    public static AiImageRequestSpec read(String json) {
        if(json==null || json.isBlank())return null;
        try {
            AiImageRequestSpec spec=MAPPER.readValue(json,AiImageRequestSpec.class);
            spec.validate();
            return spec;
        } catch(BusinessException e) {throw e;
        } catch(Exception e) {throw invalid();}
    }

    public String json() {
        validate();
        try {return MAPPER.writeValueAsString(this);}catch(Exception e){throw invalid();}
    }

    public Output output(String canvasSize) {
        return outputs.stream().filter(o->o.canvasSize().equals(canvasSize)).findFirst().orElse(null);
    }

    public List<String> ratios() {return outputs.stream().map(Output::aspectRatio).distinct().toList();}

    public void validate() {
        if(promptMaxChars<1 || minReferenceImages<0 || maxReferenceImages<minReferenceImages
                || !REF_FIELDS.contains(referenceField) || outputs==null || outputs.isEmpty()
                || ("none".equals(referenceField)&&maxReferenceImages!=0)
                || ("single".equals(referenceField)&&(minReferenceImages!=1||maxReferenceImages!=1))
                || ("multiple".equals(referenceField)&&maxReferenceImages<1))throw invalid();
        Set<String> sizes=new HashSet<>();
        for(Output output:outputs) {
            if(output==null || output.canvasSize()==null || !output.canvasSize().matches("[1-9][0-9]*x[1-9][0-9]*")
                    || !sizes.add(output.canvasSize()) || output.aspectRatio()==null
                    || !output.aspectRatio().matches("[1-9][0-9]*:[1-9][0-9]*")
                    || output.providerFields()==null)throw invalid();
            String[] canvas=output.canvasSize().split("x"),ratio=output.aspectRatio().split(":");
            double actual=Double.parseDouble(canvas[0])/Double.parseDouble(canvas[1]);
            double claimed=Double.parseDouble(ratio[0])/Double.parseDouble(ratio[1]);
            if(!Double.isFinite(actual) || !Double.isFinite(claimed) || Math.abs(actual-claimed)/claimed>0.02)throw invalid();
            for(var field:output.providerFields().entrySet()) {
                if(!field.getKey().matches("[A-Za-z][A-Za-z0-9_]{0,63}") || RESERVED_FIELDS.contains(field.getKey()))throw invalid();
                Object value=field.getValue();
                if("imageCount".equals(field.getKey())) {
                    if(!(value instanceof Integer count) || count!=1)throw invalid();
                } else if(value instanceof String text) {
                    if(text.isBlank())throw invalid();
                } else if(value instanceof Number number) {
                    if(!Double.isFinite(number.doubleValue()))throw invalid();
                } else if(!(value instanceof Boolean))throw invalid();
            }
        }
        if(wire!=null)validateWire(wire,referenceField);
        if(batchCounts!=null && (batchCounts.isEmpty() || batchCounts.stream().anyMatch(n->n==null||n<1)
                || new HashSet<>(batchCounts).size()!=batchCounts.size()))throw invalid();
    }

    public List<Integer> allowedBatchCounts() {return batchCounts==null?List.of(1,2,4):batchCounts;}

    private static void validateWire(Wire wire,String referenceField) {
        String input=wire.inputMode()==null?"asset-id":wire.inputMode();
        String result=wire.resultMode()==null?"async-asset":wire.resultMode();
        if(!Set.of("asset-id","url").contains(input)
                || !Set.of("async-asset","async-url","sync-base64","sync-url").contains(result))throw invalid();
        path(wire.submitPath(),false);
        if(wire.submitPath()!=null && wire.submitPath().contains("{id}"))throw invalid();
        String method=wire.pollMethod()==null?"GET":wire.pollMethod();
        if(!Set.of("GET","POST").contains(method) || "GET".equals(method) && wire.pollTemplate()!=null)throw invalid();
        path(wire.pollPathTemplate(),"GET".equals(method));
        path(wire.uploadPath(),false);
        if(wire.uploadPath()!=null && wire.uploadPath().contains("{id}"))throw invalid();
        path(wire.downloadPathTemplate(),"async-asset".equals(result));
        pointer(wire.uploadAssetIdPointer());pointer(wire.submitIdPointer());
        pointer(wire.statusPointer());pointer(wire.outputAssetIdPointer());
        pointer(wire.outputPointer());
        if(!"async-asset".equals(result) && wire.outputPointer()==null)throw invalid();
        statuses(wire.succeeded());statuses(wire.failed());
        if(wire.modelQueryParam()!=null && !wire.modelQueryParam().isEmpty() && !wire.modelQueryParam().matches("[A-Za-z][A-Za-z0-9_-]*"))throw invalid();
        if(wire.authHeaderName()!=null && !wire.authHeaderName().matches("[A-Za-z][A-Za-z0-9-]*"))throw invalid();
        if(wire.authPrefix()!=null && (wire.authPrefix().contains("\r") || wire.authPrefix().contains("\n")))throw invalid();
        if(wire.idempotencyHeaderName()!=null && !wire.idempotencyHeaderName().isEmpty()
                && !wire.idempotencyHeaderName().matches("[A-Za-z][A-Za-z0-9-]*"))throw invalid();
        if(wire.uploadFieldName()!=null && !wire.uploadFieldName().matches("[A-Za-z][A-Za-z0-9_-]*"))throw invalid();
        if(wire.submitTemplate()!=null) {
            template(wire.submitTemplate());
            if("single".equals(referenceField) && !containsVariable(wire.submitTemplate(),
                    "url".equals(input)?"referenceUrl":"assetId")
                    || "multiple".equals(referenceField) && !containsVariable(wire.submitTemplate(),
                    "url".equals(input)?"referenceUrls":"assetIds"))throw invalid();
        }
        if(wire.pollTemplate()!=null)template(wire.pollTemplate());
        if("POST".equals(method) && wire.pollPathTemplate()!=null && !wire.pollPathTemplate().contains("{id}")
                && !containsVariable(wire.pollTemplate(),"id"))throw invalid();
        positive(wire.maxReferenceBytes());positive(wire.maxOutputBytes());
        positive(wire.maxPollAttempts());positive(wire.requestTimeoutMillis());
        if(wire.maxOutputBytes()!=null && wire.maxOutputBytes()==Integer.MAX_VALUE
                || wire.pollIntervalMillis()!=null && wire.pollIntervalMillis()<0)throw invalid();
        if(wire.outputHosts()!=null && (wire.outputHosts().isEmpty()
                || wire.outputHosts().stream().anyMatch(host->host==null || !host.matches("[A-Za-z0-9.-]+"))
                || new HashSet<>(wire.outputHosts()).size()!=wire.outputHosts().size()))throw invalid();
    }

    private static void positive(Integer value) {if(value!=null && value<1)throw invalid();}

    private static void path(String value, boolean idRequired) {
        if(value==null)return;
        if(!value.startsWith("/") || value.startsWith("//") || value.contains("..")
                || value.contains("#") || value.contains("\\")
                || idRequired && !value.contains("{id}"))throw invalid();
        try {
            URI uri=URI.create(value.replace("{id}","sample").replace("{model}","sample"));
            if(uri.getScheme()!=null || uri.getHost()!=null || uri.getRawPath()==null || !uri.getRawPath().startsWith("/"))throw invalid();
        }catch(IllegalArgumentException e){throw invalid();}
    }

    private static void pointer(String value) {
        if(value==null)return;
        try {
            if(!value.startsWith("/"))throw invalid();
            com.fasterxml.jackson.core.JsonPointer.compile(value);
        }catch(IllegalArgumentException e){throw invalid();}
    }

    private static void statuses(List<String> values) {
        if(values==null)return;
        if(values.isEmpty() || values.stream().anyMatch(value->value==null || !value.matches("[A-Za-z][A-Za-z0-9_-]*")))throw invalid();
    }

    private static void template(Object value) {
        if(value instanceof Map<?,?> fields) {
            for(var entry:fields.entrySet()) {
                if(!(entry.getKey() instanceof String key) || key.isBlank())throw invalid();
                template(entry.getValue());
            }
        } else if(value instanceof List<?> items)items.forEach(AiImageRequestSpec::template);
        else if(value instanceof String text) {
            if(text.startsWith("${") && text.endsWith("}") && !Set.of("model","prompt","assetId","assetIds","referenceUrl","referenceUrls","canvasSize","aspectRatio","requestId","providerFields","id").contains(text.substring(2,text.length()-1)))throw invalid();
        } else if(value!=null && !(value instanceof Number) && !(value instanceof Boolean))throw invalid();
    }
    private static boolean containsVariable(Object value,String name) {
        if(value instanceof String text)return text.equals("${"+name+"}");
        if(value instanceof Map<?,?> map)return map.values().stream().anyMatch(item->containsVariable(item,name));
        if(value instanceof List<?> list)return list.stream().anyMatch(item->containsVariable(item,name));
        return false;
    }

    private static BusinessException invalid() {
        return BusinessException.badRequest("IMAGE_REQUEST_SPEC_INVALID","图片模型请求规格配置无效");
    }
}
