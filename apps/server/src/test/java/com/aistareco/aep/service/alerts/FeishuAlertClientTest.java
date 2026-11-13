package com.aistareco.aep.service.alerts;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import java.net.http.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FeishuAlertClientTest {
    private static final String WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/test-hook";
    @Test @SuppressWarnings("unchecked") void webhookNeedsNoAppCredentialsAndDoesNotRequestATokenOrUrgency() throws Exception {
        var config=new FeishuAlertConfig();config.setEnabled(true);config.setWebhook(WEBHOOK);config.setUrgent(true);
        assertTrue(config.ready());assertFalse(config.urgencyEnabled());
        var http=mock(HttpClient.class);HttpResponse<String> response=mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);when(response.body()).thenReturn("{\"code\":0,\"msg\":\"success\"}");
        when(http.send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenAnswer(call->{
            HttpRequest request=call.getArgument(0);
            assertEquals(WEBHOOK,request.uri().toString());assertTrue(request.headers().firstValue("Authorization").isEmpty());
            var json=new ObjectMapper().readTree(body(request));
            assertEquals("text",json.path("msg_type").asText());assertEquals("测试告警",json.path("content").path("text").asText());
            return response;
        });
        var client=new FeishuAlertClient(config,new ObjectMapper(),http);
        assertEquals("webhook:stable-key",client.send("stable-key","测试告警"));client.urgent("webhook:stable-key");
        verify(http,times(1)).send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class));
        config.setEnabled(false);assertFalse(config.ready());
    }
    @Test void invalidWebhookDoesNotFallBackToTheApplicationBot() {
        var config=new FeishuAlertConfig();config.setEnabled(true);config.setAppId("app");config.setAppSecret("secret");config.setChatId("oc_group");config.setUserId("ou_person");
        var http=mock(HttpClient.class);var client=new FeishuAlertClient(config,new ObjectMapper(),http);
        for(String url:List.of("https://example.com/hook/secret","https://open.feishu.cn/open-apis/bot/v2/hook/key?token=secret","http://open.feishu.cn/open-apis/bot/v2/hook/key")) {
            config.setWebhook(url);assertFalse(config.ready());
            assertEquals("Feishu webhook invalid",assertThrows(IllegalStateException.class,()->client.send("id","text")).getMessage());
        }
        verifyNoInteractions(http);
    }
    @Test @SuppressWarnings("unchecked") void webhookSendsAnInteractiveTaskCardAndKeepsLinksWhenResponseIsLong() throws Exception {
        var config=new FeishuAlertConfig();config.setWebhook(WEBHOOK);
        var http=mock(HttpClient.class);HttpResponse<String> response=mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);when(response.body()).thenReturn("{\"code\":0}");
        var card=new FeishuTaskCard();
        card.field("用户","测试用户");
        String page="https://aiavatar.aibuzz.cn/video?scene=recreation&draft=IPP-1";
        card.field("报错操作链接",page);
        when(http.send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenAnswer(call->{
            String payload=body(call.getArgument(0));
            assertTrue(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8).length<=20000);
            var wire=new ObjectMapper().readTree(payload);
            assertEquals("interactive",wire.path("msg_type").asText());
            var content=wire.path("card");
            assertEquals("【模型任务告警】",content.at("/header/title/content").asText());
            assertTrue(content.toString().contains("完整内容见后台请求日志"));
            assertEquals(page,content.at("/body/elements/4/behaviors/0/default_url").asText());
            return response;
        });
        assertEquals("webhook:key",new FeishuAlertClient(config,new ObjectMapper(),http).send("key",card.finish("告警😀".repeat(10000),page)));
    }
    @Test @SuppressWarnings("unchecked") void webhookErrorsAreRedactedAndLongUnicodeAlertsFitThePayloadLimit() throws Exception {
        var config=new FeishuAlertConfig();config.setWebhook(WEBHOOK);
        var http=mock(HttpClient.class);HttpResponse<String> response=mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);when(response.body()).thenReturn("{\"code\":19024,\"msg\":\"private-hook\"}");
        when(http.send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenAnswer(call->{
            String payload=body(call.getArgument(0));
            assertTrue(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8).length<=20000);
            String text=new ObjectMapper().readTree(payload).path("content").path("text").asText();
            assertTrue(text.contains("告警过长已截断"));assertTrue(text.endsWith("https://admin.aibuzz.cn/admin/platform/ai-models"));
            assertFalse(text.contains("\uFFFD"));return response;
        });
        var client=new FeishuAlertClient(config,new ObjectMapper(),http);
        assertEquals("Feishu code 19024",assertThrows(IllegalStateException.class,()->client.send("id","告警😀\n\"".repeat(10000))).getMessage());
    }
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
