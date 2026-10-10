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
