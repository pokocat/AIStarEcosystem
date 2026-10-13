package com.aistareco.aep.model;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Image request limits and canvas-to-provider fields stored on one fixed model endpoint. */
public record AiImageRequestSpec(int promptMaxChars, int minReferenceImages, int maxReferenceImages,
                                 String referenceField, List<Output> outputs) {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> REF_FIELDS = Set.of("none", "single", "multiple");
    private static final Set<String> RESERVED_FIELDS = Set.of("model", "prompt", "input_image_asset_id", "input_image_asset_ids");

    public record Output(String canvasSize, String aspectRatio, Map<String, Object> providerFields) {}

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
        if(promptMaxChars<1 || promptMaxChars>20000 || minReferenceImages<0 || maxReferenceImages<minReferenceImages
                || maxReferenceImages>32 || !REF_FIELDS.contains(referenceField) || outputs==null || outputs.isEmpty()
                || outputs.size()>24 || ("none".equals(referenceField)&&maxReferenceImages!=0)
                || ("single".equals(referenceField)&&(minReferenceImages!=1||maxReferenceImages!=1))
                || ("multiple".equals(referenceField)&&maxReferenceImages<1))throw invalid();
        Set<String> sizes=new HashSet<>();
        for(Output output:outputs) {
            if(output==null || output.canvasSize()==null || !output.canvasSize().matches("[1-9][0-9]{1,4}x[1-9][0-9]{1,4}")
                    || !sizes.add(output.canvasSize()) || output.aspectRatio()==null
                    || !output.aspectRatio().matches("[1-9][0-9]?:[1-9][0-9]?")
                    || output.providerFields()==null || output.providerFields().size()>12)throw invalid();
            String[] canvas=output.canvasSize().split("x"),ratio=output.aspectRatio().split(":");
            double actual=Double.parseDouble(canvas[0])/Double.parseDouble(canvas[1]);
            double claimed=Double.parseDouble(ratio[0])/Double.parseDouble(ratio[1]);
            if(Math.abs(actual-claimed)/claimed>0.02)throw invalid();
            for(var field:output.providerFields().entrySet()) {
                if(!field.getKey().matches("[A-Za-z][A-Za-z0-9_]{0,63}") || RESERVED_FIELDS.contains(field.getKey()))throw invalid();
                Object value=field.getValue();
                if("imageCount".equals(field.getKey())) {
                    if(!(value instanceof Integer count) || count!=1)throw invalid();
                } else if(value instanceof String text) {
                    if(text.isBlank() || text.length()>100)throw invalid();
                } else if(value instanceof Number number) {
                    if(!Double.isFinite(number.doubleValue()))throw invalid();
                } else if(!(value instanceof Boolean))throw invalid();
            }
        }
    }

    private static BusinessException invalid() {
        return BusinessException.badRequest("IMAGE_REQUEST_SPEC_INVALID","图片模型请求规格配置无效");
    }
}
