package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.common.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.net.InetSocketAddress;
import java.nio.file.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class JusuanLipSyncClientTest {
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints={400,503})
    void providerErrorReasonSurvivesSubmitAndPoll(int status) {
        var upstream=mock(UpstreamModelHttp.class);
        var endpoint=AiModelEndpoint.builder().id("lips").upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("test-key")).build();
        java.net.http.HttpResponse<String> response=mock(java.net.http.HttpResponse.class);
        when(response.statusCode()).thenReturn(status);when(response.body()).thenReturn("{\"error\":{\"message\":\"face not visible token=private-token\"}}");
        when(upstream.sendJson(any(),any())).thenReturn(response);
        var client=new JusuanLipSyncClient(upstream,new ObjectMapper());
        for(boolean submit:new boolean[]{true,false}) {
            var error=assertThrows(BusinessException.class,()->{if(submit)client.submit(endpoint,"https://lip.example/v1","{}","id","owner");else client.poll(endpoint,"https://lip.example/v1","https://lip.example/v1/jobs/id?model=x-dub","id","owner");});
            assertTrue(error.getMessage().contains("face not visible"));assertFalse(error.getMessage().contains("private-token"));
            assertEquals(submit&&status==400?"STUDIO_LIP_SYNC_REJECTED":"STUDIO_LIP_SYNC_UNAVAILABLE",error.getCode());
        }
    }
    @Test void nativeMultipartThenOriginalIdempotentBodyAndScopedQuery(@TempDir Path dir) throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);String base="http://127.0.0.1:"+server.getAddress().getPort()+"/v1";
        var multipart=new AtomicReference<String>();var body=new AtomicReference<String>();var key=new AtomicReference<String>();
        server.createContext("/v1/assets/input",x->{assertEquals("model=x-dub",x.getRequestURI().getQuery());assertEquals("Bearer private-test-key",x.getRequestHeaders().getFirst("Authorization"));multipart.set(new String(x.getRequestBody().readAllBytes()));var b="{\"asset\":{\"assetId\":\"asset_video\"}}".getBytes();x.sendResponseHeaders(200,b.length);x.getResponseBody().write(b);x.close();});
        server.createContext("/v1/media/generations",x->{body.set(new String(x.getRequestBody().readAllBytes()));key.set(x.getRequestHeaders().getFirst("Idempotency-Key"));var b=("{\"jobId\":\"job_lips\",\"jobUrl\":\""+base+"/jobs/job_lips?model=x-dub\"}").getBytes();x.sendResponseHeaders(202,b.length);x.getResponseBody().write(b);x.close();});
        server.createContext("/v1/jobs/job_lips",x->{assertEquals("model=x-dub",x.getRequestURI().getQuery());var b="{\"status\":\"running\"}".getBytes();x.sendResponseHeaders(200,b.length);x.getResponseBody().write(b);x.close();});server.start();
        try {
            var endpoint=AiModelEndpoint.builder().id("lips").baseUrl(base).model("x-dub").upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("private-test-key")).build();
            var client=new JusuanLipSyncClient(new UpstreamModelHttp(mock(AiModelUsageService.class)),new ObjectMapper());Path f=dir.resolve("video.mp4");Files.writeString(f,"actual-file-bytes");
            assertEquals("asset_video",client.upload(endpoint,base,f,"video","original","owner"));assertTrue(multipart.get().contains("name=\"video\""));assertTrue(multipart.get().contains("actual-file-bytes"));
            String request="{\"model\":\"x-dub\",\"input_video_asset_id\":\"asset_video\",\"input_audio_asset_id\":\"asset_audio\"}";
            var job=client.submit(endpoint,base,request,"original","owner");assertEquals(request,body.get());assertEquals("original",key.get());assertEquals("running",client.poll(endpoint,base,job.jobUrl(),"original","owner").path("status").asText());
        } finally {server.stop(0);}
    }
    @Test void returnedUrlsCannotLoseModelScopeOrSendKeyElsewhere() {
        for(String url:new String[]{"https://evil.example/v1/jobs/j?model=x-dub","https://api.jusuanhub.com/v1/jobs/j","https://api.jusuanhub.com/v1/jobs/j?model=qwen3-tts","https://user@api.jusuanhub.com/v1/jobs/j?model=x-dub"})
            assertThrows(BusinessException.class,()->JusuanLipSyncClient.scopedUri("https://api.jusuanhub.com/v1",url,"/jobs/",null));
    }
}
