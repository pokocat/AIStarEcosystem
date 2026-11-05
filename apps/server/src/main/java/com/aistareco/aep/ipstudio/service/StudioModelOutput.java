package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** A model's actual text is a user artifact even when it cannot be turned into executable structured data. */
public final class StudioModelOutput {
    private StudioModelOutput(){}
    public static boolean present(AiModelInvocationService.AiModelResponse reply){return reply!=null&&reply.content()!=null&&!reply.content().isBlank();}
    public static ObjectNode capture(ObjectMapper json,AiModelInvocationService.AiModelResponse reply){
        return json.createObjectNode().put("content",reply.content()).put("finishReason",reply.finishReason())
                .put("model",reply.modelUsed());
    }
    public static boolean presentationFailure(Exception error){
        if(error instanceof com.fasterxml.jackson.core.JsonProcessingException)return true;
        if(!(error instanceof BusinessException b))return false;
        return java.util.Set.of("AI_BAD_OUTPUT","AI_USAGE_MISSING","AI_USAGE_LIMIT","MODEL_SETTLEMENT_USAGE_INVALID",
                "SCOPED_RESOURCE_OVERRUN","STUDIO_PLAN_NOT_READY").contains(b.getCode());
    }
    public static String readable(ObjectMapper json,String raw){
        try {var value=ModelJson.parse(json,raw);for(String key:java.util.List.of("content","markdown","reply","text","summary"))
            if(value.path(key).isTextual()&&!value.path(key).asText().isBlank())return value.path(key).asText();}
        catch(Exception ignored){}return raw;
    }
    public static ObjectNode preserve(ObjectMapper json,JsonNode input,ObjectNode output,String raw,String message){
        String text=readable(json,raw);
        boolean usableBody=!text.equals(raw)||!raw.stripLeading().startsWith("{")&&!raw.stripLeading().startsWith("[");
        output.put("rawOnly",true).put("text",text);
        output.withArray("warnings").add("模型内容已保留，请核对原文；自动整理未完成");
        String operation=input.path("operation").asText();
        if(usableBody&&"text".equals(operation)&&!input.path("_exec").path("skillPlan").asBoolean()&&!input.path("_exec").has("skillDistill"))
            output.putObject("textRevision").put("summary","已保留模型返回的内容").put("content",text);
        if(usableBody&&"assistant".equals(operation)&&input.hasNonNull("scriptEdit"))
            output.putObject("scriptRevision").put("summary","已保留模型返回的内容").put("markdown",text);
        if("director".equals(operation)&&java.util.Set.of("script","script-more").contains(input.path("_director").path("task").asText())) {
            ObjectNode script=json.createObjectNode().put("content",text);
            try {var parsed=ModelJson.parse(json,raw);if(parsed.isObject()){script=(ObjectNode)parsed.deepCopy();script.put("content",text);}}
            catch(Exception ignored){}
            if(usableBody){output.set("director",script);output.put("rawOnly",false);}
        }
        if("director".equals(operation)&&"assistant".equals(input.path("_director").path("task").asText())) {
            var reply=output.putObject("director").put("reply",text).put("dropped",0);reply.putArray("proposals");
            output.put("rawOnly",false);
        }
        return output;
    }
}
