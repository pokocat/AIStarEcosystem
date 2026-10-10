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
