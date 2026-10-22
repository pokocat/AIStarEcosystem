package com.aistareco.aep.service.alerts;

import com.fasterxml.jackson.databind.*;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Map;

/** Application bot; secrets and raw Feishu responses are never logged or included in exceptions. */
@Component
public class FeishuAlertClient {
    private final FeishuAlertConfig config;private final ObjectMapper mapper;private final HttpClient http;
    private String token;private long expiresAt;
    @org.springframework.beans.factory.annotation.Autowired
    public FeishuAlertClient(FeishuAlertConfig config,ObjectMapper mapper) {
        this(config,mapper,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build());
    }
    FeishuAlertClient(FeishuAlertConfig config,ObjectMapper mapper,HttpClient http){this.config=config;this.mapper=mapper;this.http=http;}
    private synchronized String token() throws Exception {
        if(token!=null&&System.currentTimeMillis()<expiresAt)return token;
        var response=request("POST","/auth/v3/tenant_access_token/internal",Map.of("app_id",config.getAppId(),"app_secret",config.getAppSecret()),null);
        String value=response.path("tenant_access_token").asText();if(value.isBlank())throw new IllegalStateException("Feishu token missing");
        token=value;expiresAt=System.currentTimeMillis()+Math.max(1,response.path("expire").asLong(7200)-120)*1000;return token;
    }
    public String send(String id,String text) throws Exception {
        var result=request("POST","/im/v1/messages?receive_id_type=chat_id",Map.of("receive_id",config.getChatId(),"msg_type","text",
                "content",mapper.writeValueAsString(Map.of("text",text)),"uuid",id),token());
        String messageId=result.path("data").path("message_id").asText();
        if(!messageId.matches("om_[A-Za-z0-9]+"))throw new IllegalStateException("Feishu message ID missing");return messageId;
    }
    public void urgent(String messageId) throws Exception {
        if(!messageId.matches("om_[A-Za-z0-9]+"))throw new IllegalArgumentException("Invalid Feishu message ID");
        var result=request("PATCH","/im/v1/messages/"+messageId+"/urgent_app?user_id_type=open_id",Map.of("user_id_list",java.util.List.of(config.getUserId())),token());
        if(result.path("data").path("invalid_user_id_list").size()>0)throw new IllegalStateException("Feishu urgency recipient invalid");
    }
    private JsonNode request(String method,String path,Object body,String token) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("https://open.feishu.cn/open-apis"+path)).timeout(Duration.ofSeconds(5))
                .header("Content-Type","application/json").method(method,HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        if(token!=null)builder.header("Authorization","Bearer "+token);
        HttpResponse<String> response;
        try {response=http.send(builder.build(),HttpResponse.BodyHandlers.ofString());}
        catch(Exception error){if(error instanceof InterruptedException)Thread.currentThread().interrupt();throw new IllegalStateException("Feishu transport unavailable");}
        if(response.statusCode()!=200)throw new IllegalStateException("Feishu HTTP "+response.statusCode());
        JsonNode result;
        try {result=mapper.readTree(response.body());}catch(Exception error){throw new IllegalStateException("Feishu invalid response");}
        if(!result.has("code")||result.path("code").asInt(-1)!=0) {
            int code=result.path("code").asInt(-1);
            if(code==99991663||code==99991664||code==99991668) {this.token=null;expiresAt=0;}
            throw new IllegalStateException("Feishu code "+code);
        }
        return result;
    }
}
