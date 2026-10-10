package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.ai.*;
import com.aistareco.aep.service.storage.*;
import com.aistareco.common.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.net.http.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class JusuanImageClientTest {
    final ObjectMapper mapper=new ObjectMapper();
    final AiModelInvocationService models=mock(AiModelInvocationService.class);
    final FileStorageService storage=mock(FileStorageService.class);
    final UpstreamModelHttp upstream=mock(UpstreamModelHttp.class);
    final HttpClient http=mock(HttpClient.class);
    final JusuanImageClient client=new JusuanImageClient(models,storage,upstream,mapper,http,()->{});
    AiModelEndpoint endpoint(String model){return AiModelEndpoint.builder().id("ep").name("Jusuan").baseUrl("https://api.jusuanhub.com/v1").model(model).upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("test-key")).enabled(true).build();}
    HttpResponse<String> json(String value){var r=mock(HttpResponse.class);when(r.statusCode()).thenReturn(200);when(r.body()).thenReturn(value);return r;}
    @Test void unsupportedGeometryIsTranslatedAndModelLimitsFailBeforeCallingProvider(){
        assertEquals("768x1376",JusuanImageClient.fluxSize("768x1365"));
        assertThrows(BusinessException.class,()->JusuanImageClient.validate(endpoint("flux2-klein-4b"),"x".repeat(501),0));
        assertThrows(BusinessException.class,()->JusuanImageClient.validate(endpoint("flux2-klein-4b"),"x",6));
        assertThrows(BusinessException.class,()->JusuanImageClient.validate(endpoint("ernie-Image"),"x",1));
        assertThrows(BusinessException.class,()->JusuanImageClient.validate(endpoint("longcat-image-edit"),"x",0));
        verifyNoInteractions(upstream);
    }
    @Test void asyncGenerationUploadsRefsKeepsOrderPollsAndDownloadsWithModelScope() throws Exception {
        var ep=endpoint("flux2-klein-4b");when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        Path image=Files.createTempFile("jusuan-test-",".png");byte[] bytes=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS9sAAAAASUVORK5CYII=");
        try {
            Files.write(image,bytes);when(storage.openForRead("one")).thenReturn(image);when(storage.openForRead("two")).thenReturn(image);
            var replies=List.of(json("{\"asset\":{\"assetId\":\"ref1\"}}"),json("{\"asset\":{\"assetId\":\"ref2\"}}"),json("{\"id\":\"job1\",\"status\":\"queued\"}"),json("{\"status\":\"running\"}"),json("{\"status\":\"succeeded\",\"outputs\":[{\"assetId\":\"out1\"}]}"));
            when(upstream.sendJson(any(),any())).thenReturn(replies.get(0),replies.get(1),replies.get(2),replies.get(3),replies.get(4));
            var downloaded=mock(HttpResponse.class);when(downloaded.statusCode()).thenReturn(200);when(downloaded.body()).thenReturn(new ByteArrayInputStream(bytes));when(http.send(any(),any())).thenReturn(downloaded);
            List<String> stages=new ArrayList<>();assertArrayEquals(bytes,client.generate("ep","portrait","768x1365",List.of("one","two"),"run-image-0","owner",stages::add));
            var requests=org.mockito.ArgumentCaptor.forClass(HttpRequest.class);var contexts=org.mockito.ArgumentCaptor.forClass(ModelCallCtx.class);verify(upstream,times(5)).sendJson(requests.capture(),contexts.capture());
            assertTrue(requests.getAllValues().get(0).headers().firstValue("Content-Type").orElseThrow().startsWith("multipart/form-data"));
            assertEquals("run-image-0",requests.getAllValues().get(2).headers().firstValue("Idempotency-Key").orElseThrow());
            JsonNodeCheck(contexts.getAllValues().get(2).requestBodyJson());
            assertEquals("model=flux2-klein-4b",requests.getAllValues().get(3).uri().getQuery());
            var download=org.mockito.ArgumentCaptor.forClass(HttpRequest.class);verify(http).send(download.capture(),any());assertEquals("/v1/assets/out1/content",download.getValue().uri().getPath());assertEquals("model=flux2-klein-4b",download.getValue().uri().getQuery());
            assertTrue(stages.contains("image.provider.processing"));
        }finally{Files.deleteIfExists(image);}
    }
    void JsonNodeCheck(String body)throws Exception {var json=mapper.readTree(body);assertEquals("768x1376",json.path("size").asText());assertEquals(List.of("ref1","ref2"),mapper.convertValue(json.path("input_image_asset_ids"),List.class));assertFalse(json.has("image"));}
    @Test void failedAsyncJobNeverProducesAnImage() {
        var ep=endpoint("ernie-Image");when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        var accepted=json("{\"id\":\"job\"}");var failed=json("{\"status\":\"failed\"}");when(upstream.sendJson(any(),any())).thenReturn(accepted,failed);
        assertThrows(BusinessException.class,()->client.generate("ep","x","1024x1024",List.of(),"run","owner",s->{}));verifyNoInteractions(http);
    }
    @Test void outputContentUrlYieldsOnlyValidatedAssetIdentifier()throws Exception {
        assertEquals("a1",JusuanImageClient.assetId(mapper.readTree("{\"outputs\":[{\"contentUrl\":\"https://api.jusuanhub.com/v1/assets/a1/content?model=flux2-klein-4b\"}]}")));
        assertNull(JusuanImageClient.assetId(mapper.readTree("{\"outputs\":[{\"contentUrl\":\"https://evil.example/private\"}]}")));
    }
}
