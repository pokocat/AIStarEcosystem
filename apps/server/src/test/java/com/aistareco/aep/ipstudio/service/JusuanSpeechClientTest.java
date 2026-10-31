package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.common.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JusuanSpeechClientTest {
    private final ObjectMapper mapper=new ObjectMapper();
    @Test void anErrorInsideHttp200KeepsItsCauseAndExistingUnconfirmedCode() {
        var upstream=mock(UpstreamModelHttp.class);
        var endpoint=AiModelEndpoint.builder().id("tts").upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("test-key")).build();
        java.net.http.HttpResponse<String> response=mock(java.net.http.HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn("{\"error\":{\"code\":\"InputTextSensitiveContentDetected\"}}");
        when(upstream.sendJson(any(),any())).thenReturn(response);
        var client=new JusuanSpeechClient(upstream,mapper);
        for(boolean submit:new boolean[]{true,false}) {
            var error=assertThrows(BusinessException.class,()->{if(submit)client.submit(endpoint,"https://speech.example/v1","{}","id","owner");else client.poll(endpoint,"https://speech.example/v1","https://speech.example/v1/jobs/id?model=qwen3-tts","id","owner");});
            assertEquals("STUDIO_SPEECH_BAD_OUTPUT",error.getCode());
            assertFalse(error instanceof JusuanSpeechClient.Rejected);
            assertTrue(error.getMessage().contains("输入文本未通过内容审核"));
            assertEquals(200,((com.aistareco.aep.service.ai.ProviderResponseDiagnostics)error.getSuppressed()[0]).status());
        }
    }
    @Test void unclassifiedRejectionDoesNotInventAWrongVoiceOrScript() {
        var upstream=mock(UpstreamModelHttp.class);
        var endpoint=AiModelEndpoint.builder().id("tts").upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("test-key")).build();
        java.net.http.HttpResponse<String> response=mock(java.net.http.HttpResponse.class);
        when(response.statusCode()).thenReturn(400);when(response.body()).thenReturn("{}");
        when(upstream.sendJson(any(),any())).thenReturn(response);
        var client=new JusuanSpeechClient(upstream,mapper);
        var error=assertThrows(BusinessException.class,()->client.submit(endpoint,"https://speech.example/v1","{}","id","owner"));
        assertEquals("STUDIO_SPEECH_REJECTED",error.getCode());
        assertTrue(error.getMessage().contains("未提供具体原因"));
        assertFalse(error.getMessage().contains("检查文案"));
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints={400,503})
    void providerErrorReasonSurvivesSubmitAndPoll(int status) {
        var upstream=mock(UpstreamModelHttp.class);
        var endpoint=AiModelEndpoint.builder().id("tts").upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("test-key")).build();
        java.net.http.HttpResponse<String> response=mock(java.net.http.HttpResponse.class);
        when(response.statusCode()).thenReturn(status);when(response.body()).thenReturn("{\"error\":{\"message\":\"voice unavailable token=private-token\"}}");
        when(upstream.sendJson(any(),any())).thenReturn(response);
        var client=new JusuanSpeechClient(upstream,mapper);
        for(boolean submit:new boolean[]{true,false}) {
            var error=assertThrows(BusinessException.class,()->{if(submit)client.submit(endpoint,"https://speech.example/v1","{}","id","owner");else client.poll(endpoint,"https://speech.example/v1","https://speech.example/v1/jobs/id?model=qwen3-tts","id","owner");});
            assertTrue(error.getMessage().contains("voice unavailable"));assertFalse(error.getMessage().contains("private-token"));
            assertEquals(submit&&status==400?"STUDIO_SPEECH_REJECTED":"STUDIO_SPEECH_UNAVAILABLE",error.getCode());
        }
    }
    @Test void nativeContractPreservesBodyAndIdempotencyAndModelScope() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        var body=new AtomicReference<String>();var auth=new AtomicReference<String>();var key=new AtomicReference<String>();
        String base="http://127.0.0.1:"+server.getAddress().getPort()+"/v1";
        server.createContext("/v1/audio/generations",x->{body.set(new String(x.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));auth.set(x.getRequestHeaders().getFirst("Authorization"));key.set(x.getRequestHeaders().getFirst("Idempotency-Key"));byte[] r=("{\"jobId\":\"job_speech\",\"jobUrl\":\""+base+"/jobs/job_speech?model=qwen3-tts\"}").getBytes();x.sendResponseHeaders(202,r.length);x.getResponseBody().write(r);x.close();});
        server.createContext("/v1/jobs/job_speech",x->{assertEquals("model=qwen3-tts",x.getRequestURI().getQuery());assertEquals("Bearer test-provider-key",x.getRequestHeaders().getFirst("Authorization"));byte[] r="{\"status\":\"running\"}".getBytes();x.sendResponseHeaders(200,r.length);x.getResponseBody().write(r);x.close();});
        server.start();
        try {
            var endpoint=AiModelEndpoint.builder().id("tts").name("tts").baseUrl(base).model("qwen3-tts").upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("test-provider-key")).build();
            var client=new JusuanSpeechClient(new UpstreamModelHttp(mock(AiModelUsageService.class)),mapper);
            String request="{\"model\":\"qwen3-tts\",\"speaker\":\"Vivian\",\"text\":\"中文台词。\",\"instruct\":\"自然温暖\"}";
            var job=client.submit(endpoint,base,request,"saved-request","owner");
            assertEquals(request,body.get());assertEquals("saved-request",key.get());assertEquals("Bearer test-provider-key",auth.get());
            assertEquals("job_speech",job.jobId());assertEquals("running",client.poll(endpoint,base,job.jobUrl(),"saved-request","owner").path("status").asText());
        } finally {server.stop(0);}
    }
    @Test void returnedUrlsCannotSendKeyToAnotherHostOrLoseModelScope() {
        for(String url:new String[]{"https://evil.example/v1/jobs/j?model=qwen3-tts","https://api.jusuanhub.com/v1/jobs/j","https://api.jusuanhub.com/v1/jobs/j?model=another","https://user@api.jusuanhub.com/v1/jobs/j?model=qwen3-tts","https://api.jusuanhub.com/v1/audio/voices?model=qwen3-tts"})
            assertEquals("STUDIO_SPEECH_URL_INVALID",assertThrows(BusinessException.class,()->JusuanSpeechClient.scopedUri("https://api.jusuanhub.com/v1",url,"/jobs/",null)).getCode());
    }
    @Test void nonAudioProviderOutputCannotBecomeACompletedArtifact() {
        assertThrows(Exception.class,()->JusuanSpeechClient.inspect("{\"error\":\"not audio\"}".getBytes()));
    }
}
