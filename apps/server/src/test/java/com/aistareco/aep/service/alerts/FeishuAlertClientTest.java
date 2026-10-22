package com.aistareco.aep.service.alerts;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import java.net.http.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FeishuAlertClientTest {
    @Test @SuppressWarnings("unchecked") void sendsAsBotAndUrgentlyNotifiesTheSelectedGroupMemberWithOneToken() throws Exception {
        var config=new FeishuAlertConfig();config.setAppId("app");config.setAppSecret("secret");config.setChatId("oc_group");config.setUserId("ou_person");
        var http=mock(HttpClient.class);List<HttpRequest> requests=new ArrayList<>();List<String> bodies=new ArrayList<>();
        when(http.send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenAnswer(call->{
            HttpRequest request=call.getArgument(0);requests.add(request);bodies.add(body(request));
            HttpResponse<String> response=mock(HttpResponse.class);when(response.statusCode()).thenReturn(200);
            when(response.body()).thenReturn(switch(requests.size()) {case 1 -> "{\"code\":0,\"tenant_access_token\":\"test-token\",\"expire\":7200}";case 2 -> "{\"code\":0,\"data\":{\"message_id\":\"om_original\"}}";default -> "{\"code\":0,\"data\":{\"invalid_user_id_list\":[]}}";});return response;
        });
        var client=new FeishuAlertClient(config,new ObjectMapper(),http);String id=client.send("stable-key","测试告警");client.urgent(id);
        assertEquals(3,requests.size());assertEquals("PATCH",requests.get(2).method());assertTrue(requests.get(2).uri().getPath().endsWith("/om_original/urgent_app"));
        var json=new ObjectMapper().readTree(bodies.get(1));assertEquals("oc_group",json.path("receive_id").asText());assertEquals("stable-key",json.path("uuid").asText());
        assertEquals("测试告警",new ObjectMapper().readTree(json.path("content").asText()).path("text").asText());
        assertEquals("ou_person",new ObjectMapper().readTree(bodies.get(2)).path("user_id_list").path(0).asText());
        assertEquals("Bearer test-token",requests.get(2).headers().firstValue("Authorization").orElseThrow());
    }
    @Test @SuppressWarnings("unchecked") void providerErrorsDoNotExposeResponseSecrets() throws Exception {
        var http=mock(HttpClient.class);HttpResponse<String> response=mock(HttpResponse.class);when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn("{\"code\":99991672,\"msg\":\"private-token\"}");when(http.send(any(),any(HttpResponse.BodyHandler.class))).thenReturn(response);
        var client=new FeishuAlertClient(new FeishuAlertConfig(),new ObjectMapper(),http);
        assertEquals("Feishu code 99991672",assertThrows(IllegalStateException.class,()->client.send("id","text")).getMessage());
    }
    static String body(HttpRequest request) throws Exception {
        var bytes=new java.io.ByteArrayOutputStream();var done=new java.util.concurrent.CompletableFuture<String>();
        request.bodyPublisher().orElseThrow().subscribe(new java.util.concurrent.Flow.Subscriber<java.nio.ByteBuffer>() {
            public void onSubscribe(java.util.concurrent.Flow.Subscription s){s.request(Long.MAX_VALUE);}
            public void onNext(java.nio.ByteBuffer b){byte[] data=new byte[b.remaining()];b.get(data);bytes.writeBytes(data);}
            public void onError(Throwable t){done.completeExceptionally(t);}
            public void onComplete(){done.complete(bytes.toString(java.nio.charset.StandardCharsets.UTF_8));}
        });return done.get();
    }
}
