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
    final JusuanImageClient client=new JusuanImageClient(models,storage,upstream,mapper,http,millis->{});
    AiModelEndpoint endpoint(String model){
        AiImageRequestSpec spec=switch(model){
            case "flux2-klein-4b" -> new AiImageRequestSpec(500,0,5,"multiple",
                    List.of(new AiImageRequestSpec.Output("768x1365","9:16",Map.of("size","768x1376"))));
            case "longcat-image-edit" -> new AiImageRequestSpec(1200,1,1,"single",
                    List.of(new AiImageRequestSpec.Output("768x1365","9:16",Map.of())));
            default -> new AiImageRequestSpec(2048,0,0,"none",
                    List.of(new AiImageRequestSpec.Output("1024x1024","1:1",Map.of("resolutionTier","hd","orientation","square","imageCount",1))));
        };
        return AiModelEndpoint.builder().id("ep").name("Jusuan").baseUrl("https://api.jusuanhub.com/v1").model(model)
                .imageRequestSpecJson(spec.json()).upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("test-key")).enabled(true).build();
    }
    HttpResponse<String> json(String value){var r=mock(HttpResponse.class);when(r.statusCode()).thenReturn(200);when(r.body()).thenReturn(value);return r;}
    @Test void configuredAsyncImageProtocolDoesNotDependOnProviderHostname(){
        var ep=endpoint("flux2-klein-4b");
        ep.setBaseUrl("https://image-proxy.example/v1");
        assertTrue(JusuanImageClient.supports(ep));
        assertThrows(BusinessException.class,()->JusuanImageClient.validate(ep,"x",0,"1536x1024"));
        ep.setBaseUrl("http://image-proxy.example/v1");
        assertFalse(JusuanImageClient.supports(ep));
        assertEquals("STUDIO_IMAGE_ENDPOINT_INVALID",assertThrows(BusinessException.class,
                ()->JusuanImageClient.validate(ep,"x",0,"768x1365")).getCode());
        ep.setBaseUrl("https://image-proxy.example/v1");
        ep.setImageRequestSpecJson(null);
        assertFalse(JusuanImageClient.supports(ep));
    }
    @Test void savedImageLimitsAreNotClampedToLegacyGlobalNumbers(){
        var ep=endpoint("ernie-Image");
        var spec=new AiImageRequestSpec(30000,0,40,"multiple",List.of(
                new AiImageRequestSpec.Output("1024x1024","1:1",Map.of())));
        ep.setImageRequestSpecJson(spec.json());
        assertDoesNotThrow(()->JusuanImageClient.validate(ep,"x".repeat(20001),33,"1024x1024"));
        assertEquals("STUDIO_IMAGE_REFERENCES_INVALID",assertThrows(BusinessException.class,
                ()->JusuanImageClient.validate(ep,"x",41,"1024x1024")).getCode());
    }
    @Test void unsupportedGeometryIsTranslatedAndModelLimitsFailBeforeCallingProvider(){
        assertEquals("768x1376",AiImageRequestSpec.read(endpoint("flux2-klein-4b").getImageRequestSpecJson()).output("768x1365").providerFields().get("size"));
        assertThrows(BusinessException.class,()->JusuanImageClient.validate(endpoint("flux2-klein-4b"),"x".repeat(501),0,"768x1365"));
        assertThrows(BusinessException.class,()->JusuanImageClient.validate(endpoint("flux2-klein-4b"),"x",6,"768x1365"));
        assertThrows(BusinessException.class,()->JusuanImageClient.validate(endpoint("ernie-Image"),"x",1,"1024x1024"));
        assertThrows(BusinessException.class,()->JusuanImageClient.validate(endpoint("ernie-Image"),"x",0,"768x1024"));
        assertThrows(BusinessException.class,()->JusuanImageClient.validate(endpoint("longcat-image-edit"),"x",0,"768x1365"));
        verifyNoInteractions(upstream);
    }
    @Test void asyncGenerationUploadsRefsKeepsOrderPollsAndDownloadsWithModelScope() throws Exception {
        var ep=endpoint("flux2-klein-4b");ep.setBaseUrl("https://image-proxy.example/v1");when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
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
            assertEquals("image-proxy.example",requests.getAllValues().get(2).uri().getHost());
            JsonNodeCheck(contexts.getAllValues().get(2).requestBodyJson());
            assertEquals("model=flux2-klein-4b",requests.getAllValues().get(3).uri().getQuery());
            var download=org.mockito.ArgumentCaptor.forClass(HttpRequest.class);verify(http).send(download.capture(),any());assertEquals("/v1/assets/out1/content",download.getValue().uri().getPath());assertEquals("model=flux2-klein-4b",download.getValue().uri().getQuery());
            assertTrue(stages.contains("image.provider.processing"));
        }finally{Files.deleteIfExists(image);}
    }
    @Test void configuredImageWireControlsPathsHeadersBodyAndResponseFields() throws Exception {
        var ep=endpoint("image-model");
        var spec=AiImageRequestSpec.read("""
                {"promptMaxChars":3000,"minReferenceImages":1,"maxReferenceImages":1,"referenceField":"single",
                 "outputs":[{"canvasSize":"1024x1024","aspectRatio":"1:1","providerFields":{"resolution":"2k"}}],
                 "wire":{"submitPath":"/create","pollPathTemplate":"/tasks/query","pollMethod":"POST",
                   "pollTemplate":{"task":"${id}"},"uploadPath":"/ref/upload",
                   "downloadPathTemplate":"/files/{id}","uploadAssetIdPointer":"/data/ref",
                   "submitIdPointer":"/data/task","statusPointer":"/data/state","outputAssetIdPointer":"/data/asset",
                   "succeeded":["ready"],"failed":["error"],"modelQueryParam":"",
                   "authHeaderName":"X-API-Key","authPrefix":"","idempotencyHeaderName":"X-Operation-Id",
                   "uploadFieldName":"reference","maxReferenceBytes":1000000,"maxOutputBytes":1000000,
                   "maxPollAttempts":3,"pollIntervalMillis":1500,"requestTimeoutMillis":120000,
                   "submitTemplate":{"input":{"prompt":"${prompt}","ref":"${assetId}",
                   "options":"${providerFields}"},"model":"${model}","size":"${canvasSize}"}}}
                """);
        ep.setImageRequestSpecJson(spec.json());
        when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio"))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        Path image=Files.createTempFile("image-wire-",".png");
        byte[] bytes=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS9sAAAAASUVORK5CYII=");
        try {
            Files.write(image,bytes);when(storage.openForRead("one")).thenReturn(image);
            var uploaded=json("{\"data\":{\"ref\":\"asset1\"}}");
            var submitted=json("{\"data\":{\"task\":\"job1\"}}");
            var completed=json("{\"data\":{\"state\":\"ready\",\"asset\":\"out1\"}}");
            when(upstream.sendJson(any(),any())).thenReturn(uploaded,submitted,completed);
            var downloaded=mock(HttpResponse.class);when(downloaded.statusCode()).thenReturn(200);
            when(downloaded.body()).thenReturn(new ByteArrayInputStream(bytes));when(http.send(any(),any())).thenReturn(downloaded);
            assertArrayEquals(bytes,client.generate("ep","portrait","1024x1024",List.of("one"),"run1","owner",stage->{}));
            var requests=org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
            var contexts=org.mockito.ArgumentCaptor.forClass(ModelCallCtx.class);
            verify(upstream,times(3)).sendJson(requests.capture(),contexts.capture());
            assertEquals("/v1/ref/upload",requests.getAllValues().get(0).uri().getPath());
            assertTrue(requests.getAllValues().get(0).bodyPublisher().isPresent());
            assertEquals("/v1/create",requests.getAllValues().get(1).uri().getPath());
            assertEquals(java.time.Duration.ofSeconds(120),requests.getAllValues().get(1).timeout().orElseThrow());
            assertNull(requests.getAllValues().get(1).uri().getQuery());
            assertEquals("test-key",requests.getAllValues().get(1).headers().firstValue("X-API-Key").orElseThrow());
            assertEquals("run1",requests.getAllValues().get(1).headers().firstValue("X-Operation-Id").orElseThrow());
            var body=mapper.readTree(contexts.getAllValues().get(1).requestBodyJson());
            assertEquals("portrait",body.path("input").path("prompt").asText());
            assertEquals("asset1",body.path("input").path("ref").asText());
            assertEquals("2k",body.path("input").path("options").path("resolution").asText());
            assertEquals("/v1/tasks/query",requests.getAllValues().get(2).uri().getPath());
            assertEquals("POST",requests.getAllValues().get(2).method());
            assertEquals("job1",mapper.readTree(contexts.getAllValues().get(2).requestBodyJson()).path("task").asText());
            assertTrue(requests.getAllValues().get(2).headers().firstValue("X-Operation-Id").isEmpty());
            var download=org.mockito.ArgumentCaptor.forClass(HttpRequest.class);verify(http).send(download.capture(),any());
            assertEquals("/v1/files/out1",download.getValue().uri().getPath());
        }finally{Files.deleteIfExists(image);}
    }
    @Test void imageWireRejectsCrossOriginAndMissingJobPlaceholder() {
        String base="""
                {"promptMaxChars":1000,"minReferenceImages":0,"maxReferenceImages":0,"referenceField":"none",
                 "outputs":[{"canvasSize":"1024x1024","aspectRatio":"1:1","providerFields":{}}],
                 "wire":{"submitPath":"/create","pollPathTemplate":"/jobs/{id}"}}
                """;
        assertEquals("IMAGE_REQUEST_SPEC_INVALID",assertThrows(BusinessException.class,
                ()->AiImageRequestSpec.read(base.replace("/create","//evil.example/create"))).getCode());
        assertEquals("IMAGE_REQUEST_SPEC_INVALID",assertThrows(BusinessException.class,
                ()->AiImageRequestSpec.read(base.replace("/jobs/{id}","/jobs/current"))).getCode());
        assertEquals("IMAGE_REQUEST_SPEC_INVALID",assertThrows(BusinessException.class,
                ()->AiImageRequestSpec.read(base.replace("\"/jobs/{id}\"","\"/jobs/current\",\"pollMethod\":\"POST\""))).getCode());
        assertEquals("IMAGE_REQUEST_SPEC_INVALID",assertThrows(BusinessException.class,
                ()->AiImageRequestSpec.read(base.replace("\"/create\"","\"/create\",\"maxPollAttempts\":0"))).getCode());
    }
    @Test void configuredPollLimitStopsWithoutAnotherSupplierRequest() {
        var ep=endpoint("ernie-Image");
        ep.setImageRequestSpecJson(ep.getImageRequestSpecJson().replaceFirst("}$", ",\"wire\":{\"maxPollAttempts\":1}}"));
        when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio"))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        var accepted=json("{\"id\":\"job1\"}");var running=json("{\"status\":\"running\"}");
        when(upstream.sendJson(any(),any())).thenReturn(accepted,running);
        assertEquals("STUDIO_IMAGE_PROVIDER_FAILED",assertThrows(BusinessException.class,
                ()->client.generate("ep","x","1024x1024",List.of(),"run","owner",s->{})).getCode());
        verify(upstream,times(2)).sendJson(any(),any());
    }
    void JsonNodeCheck(String body)throws Exception {var json=mapper.readTree(body);assertEquals("768x1376",json.path("size").asText());assertEquals(List.of("ref1","ref2"),mapper.convertValue(json.path("input_image_asset_ids"),List.class));assertFalse(json.has("image"));}
    @Test void failedAsyncJobNeverProducesAnImage() {
        var ep=endpoint("ernie-Image");when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        var accepted=json("{\"id\":\"job\"}");var failed=json("{\"status\":\"failed\"}");when(upstream.sendJson(any(),any())).thenReturn(accepted,failed);
        assertThrows(BusinessException.class,()->client.generate("ep","x","1024x1024",List.of(),"run","owner",s->{}));verifyNoInteractions(http);
    }
    @Test void squareRequestUsesPersistedHdPresetAndMissingConfigFailsBeforeProvider() throws Exception {
        var ep=endpoint("ernie-Image");when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        var accepted=json("{\"id\":\"job1\"}");var failed=json("{\"status\":\"failed\"}");
        when(upstream.sendJson(any(),any())).thenReturn(accepted,failed);
        assertThrows(BusinessException.class,()->client.generate("ep","square","1024x1024",List.of(),"run-image-0","owner",s->{}));
        var contexts=org.mockito.ArgumentCaptor.forClass(ModelCallCtx.class);verify(upstream,times(2)).sendJson(any(),contexts.capture());
        var body=mapper.readTree(contexts.getAllValues().get(0).requestBodyJson());
        assertEquals("hd",body.path("resolutionTier").asText());assertEquals("square",body.path("orientation").asText());
        assertEquals(1,body.path("imageCount").asInt());
        ep.setImageRequestSpecJson(null);
        assertThrows(BusinessException.class,()->client.generate("ep","square","1024x1024",List.of(),"another","owner",s->{}));
        verify(upstream,times(2)).sendJson(any(),any());
    }
    @Test void outputContentUrlYieldsOnlyValidatedAssetIdentifier()throws Exception {
        assertEquals("a1",JusuanImageClient.assetId(mapper.readTree("{\"outputs\":[{\"contentUrl\":\"https://api.jusuanhub.com/v1/assets/a1/content?model=flux2-klein-4b\"}]}")));
        assertNull(JusuanImageClient.assetId(mapper.readTree("{\"outputs\":[{\"contentUrl\":\"https://evil.example/private\"}]}")));
    }
    @Test void synchronousBase64ResultUsesConfiguredPointerWithoutPolling() {
        var ep=endpoint("image-model");
        ep.setImageRequestSpecJson("""
                {"promptMaxChars":1000,"minReferenceImages":0,"maxReferenceImages":0,"referenceField":"none",
                 "outputs":[{"canvasSize":"1024x1024","aspectRatio":"1:1","providerFields":{}}],
                 "wire":{"submitPath":"/render","resultMode":"sync-base64","outputPointer":"/data/image"}}
                """);
        when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio"))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        byte[] bytes=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS9sAAAAASUVORK5CYII=");
        var reply=json("{\"data\":{\"image\":\"data:image/png;base64,"+
                Base64.getEncoder().encodeToString(bytes)+"\"}}");
        when(upstream.sendJson(any(),any())).thenReturn(reply);
        assertArrayEquals(bytes,client.generate("ep","portrait","1024x1024",List.of(),"sync-run","owner",stage->{}));
        verify(upstream).sendJson(any(),any());
        verifyNoInteractions(http,storage);
    }
    @Test void nativeEditsSendOrderedSourceFilesAndExactSizeWhileTextGenerationRemainsJson() throws Exception {
        var ep=endpoint("gpt-image-2-1k-pic");
        ep.setImageRequestSpecJson("""
                {"promptMaxChars":32000,"minReferenceImages":0,"maxReferenceImages":16,"referenceField":"multiple",
                 "outputs":[{"canvasSize":"2048x2048","aspectRatio":"1:1","providerFields":{"size":"2048x2048","n":1}}],
                 "wire":{"submitPath":"/images/generations","referenceSubmitPath":"/images/edits",
                         "modelQueryParam":"","inputMode":"multipart","resultMode":"sync-base64","outputPointer":"/data/0/b64_json"}}
                """);
        when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio"))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        byte[] bytes=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS9sAAAAASUVORK5CYII=");
        Path first=Files.createTempFile("native-edit-one-",".png"),second=Files.createTempFile("native-edit-two-",".png");
        try {
            Files.write(first,bytes);Files.write(second,bytes);
            when(storage.openForRead("first")).thenReturn(first);when(storage.openForRead("second")).thenReturn(second);
            var reply=json("{\"data\":[{\"b64_json\":\""+Base64.getEncoder().encodeToString(bytes)+"\"}]}");
            when(upstream.sendJson(any(),any())).thenReturn(reply);
            assertArrayEquals(bytes,client.generate("ep","preserve the subject","2048x2048",List.of("first","second"),"edit-once","owner",s->{}));
            assertArrayEquals(bytes,client.generate("ep","draw a subject","2048x2048",List.of(),"generate-once","owner",s->{}));
            var requests=org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
            verify(upstream,times(2)).sendJson(requests.capture(),any());
            var edit=requests.getAllValues().get(0);var generation=requests.getAllValues().get(1);
            assertEquals("/v1/images/edits",edit.uri().getPath());assertNull(edit.uri().getQuery());
            assertTrue(edit.headers().firstValue("Content-Type").orElseThrow().startsWith("multipart/form-data; boundary="));
            assertEquals("edit-once",edit.headers().firstValue("Idempotency-Key").orElseThrow());
            var subscriber=HttpResponse.BodySubscribers.ofByteArray();edit.bodyPublisher().orElseThrow().subscribe(new java.util.concurrent.Flow.Subscriber<java.nio.ByteBuffer>() {
                public void onSubscribe(java.util.concurrent.Flow.Subscription subscription){subscriber.onSubscribe(subscription);}
                public void onNext(java.nio.ByteBuffer item){subscriber.onNext(List.of(item));}
                public void onError(Throwable error){subscriber.onError(error);}
                public void onComplete(){subscriber.onComplete();}
            });
            String form=new String(subscriber.getBody().toCompletableFuture().get(),java.nio.charset.StandardCharsets.ISO_8859_1);
            assertTrue(form.contains("name=\"size\"\r\n\r\n2048x2048"));
            assertTrue(form.contains("name=\"image[]\"; filename=\"reference-0.png\""));
            assertTrue(form.indexOf("reference-0.png")<form.indexOf("reference-1.png"));
            assertTrue(form.contains(new String(bytes,java.nio.charset.StandardCharsets.ISO_8859_1)));
            assertFalse(form.contains("input_image_asset_ids"));
            assertEquals("/v1/images/generations",generation.uri().getPath());
            assertEquals("application/json",generation.headers().firstValue("Content-Type").orElseThrow());
            verify(storage,never()).upstreamFetchUrl(any());
        }finally{Files.deleteIfExists(first);Files.deleteIfExists(second);}
    }
    @Test void urlReferencesAndAsyncUrlResultFollowEndpointModes() throws Exception {
        var ep=endpoint("image-model");
        ep.setImageRequestSpecJson("""
                {"promptMaxChars":1000,"minReferenceImages":1,"maxReferenceImages":1,"referenceField":"single",
                 "outputs":[{"canvasSize":"1024x1024","aspectRatio":"1:1","providerFields":{}}],
                 "wire":{"inputMode":"url","resultMode":"async-url","outputPointer":"/data/url",
                         "outputHosts":["8.8.8.8"],"submitTemplate":{"prompt":"${prompt}","reference":"${referenceUrl}"}}}
                """);
        when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio"))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        Path image=Files.createTempFile("image-url-",".png");
        byte[] bytes=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS9sAAAAASUVORK5CYII=");
        try {
            Files.write(image,bytes);
            when(storage.openForRead("one")).thenReturn(image);
            when(storage.upstreamFetchUrl("one")).thenReturn("https://assets.example.test/reference?signature=redacted");
            var accepted=json("{\"id\":\"job1\"}");
            var completed=json("{\"status\":\"succeeded\",\"data\":{\"url\":\"https://8.8.8.8/result.png\"}}");
            when(upstream.sendJson(any(),any())).thenReturn(accepted,completed);
            var downloaded=mock(HttpResponse.class);
            when(downloaded.statusCode()).thenReturn(200);
            when(downloaded.body()).thenReturn(new ByteArrayInputStream(bytes));
            when(http.send(any(),any())).thenReturn(downloaded);
            assertArrayEquals(bytes,client.generate("ep","portrait","1024x1024",List.of("one"),"url-run","owner",stage->{}));
            var contexts=org.mockito.ArgumentCaptor.forClass(ModelCallCtx.class);
            verify(upstream,times(2)).sendJson(any(),contexts.capture());
            assertEquals("https://assets.example.test/reference?signature=redacted",
                    mapper.readTree(contexts.getAllValues().get(0).requestBodyJson()).path("reference").asText());
            var request=org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
            verify(http).send(request.capture(),any());
            assertEquals("8.8.8.8",request.getValue().uri().getHost());
            assertTrue(request.getValue().headers().firstValue("Authorization").isEmpty());
        }finally{Files.deleteIfExists(image);}
    }
    @Test void privateResultUrlIsRejectedEvenIfListedByEndpoint() {
        var ep=endpoint("image-model");
        ep.setImageRequestSpecJson("""
                {"promptMaxChars":1000,"minReferenceImages":0,"maxReferenceImages":0,"referenceField":"none",
                 "outputs":[{"canvasSize":"1024x1024","aspectRatio":"1:1","providerFields":{}}],
                 "wire":{"resultMode":"sync-url","outputPointer":"/url","outputHosts":["127.0.0.1"]}}
                """);
        when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio"))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        var reply=json("{\"url\":\"https://127.0.0.1/private.png\"}");
        when(upstream.sendJson(any(),any())).thenReturn(reply);
        assertEquals("STUDIO_IMAGE_PROVIDER_FAILED",assertThrows(BusinessException.class,
                ()->client.generate("ep","portrait","1024x1024",List.of(),"private-run","owner",stage->{})).getCode());
        verifyNoInteractions(http);
    }
    @Test void durableAcceptedJobResumesOriginalIdAndBodyAfterPollOutageWithoutReposting() throws Exception {
        var ep=endpoint("ernie-Image");when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        when(models.storedEndpoint("ep")).thenReturn(Optional.of(ep));
        var state=new java.util.concurrent.atomic.AtomicReference<com.fasterxml.jackson.databind.node.ObjectNode>();
        var requests=new ArrayList<HttpRequest>();var count=new java.util.concurrent.atomic.AtomicInteger();
        when(upstream.sendJson(any(),any())).thenAnswer(inv->{requests.add(inv.getArgument(0));return switch(count.incrementAndGet()) {
            case 1 -> json("{\"id\":\"original-job\"}");
            case 2 -> throw new UpstreamCallException(false,new java.io.IOException("poll unavailable"));
            default -> json("{\"status\":\"succeeded\",\"outputs\":[{\"assetId\":\"original-asset\"}]}");
        };});
        var pending=assertThrows(JusuanImageClient.Pending.class,()->client.generate("ep","original prompt","1024x1024",List.of(),"original-key","owner",stage->{},null,null,state::set));
        assertEquals("STUDIO_IMAGE_RECOVERING",pending.code());assertEquals("original-job",state.get().path("jobId").asText());
        String originalBody=state.get().path("requestBody").asText();ep.setBaseUrl("https://new-config.example/v1");ep.setModel("new-model");
        when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio")).thenReturn(Optional.empty());
        byte[] bytes=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS9sAAAAASUVORK5CYII=");
        var downloaded=mock(HttpResponse.class);when(downloaded.statusCode()).thenReturn(200);when(downloaded.body()).thenReturn(new ByteArrayInputStream(bytes));when(http.send(any(),any())).thenReturn(downloaded);
        assertArrayEquals(bytes,client.generate("ep","changed caller prompt","1024x1024",List.of(),"original-key","owner",stage->{},null,state.get(),state::set));
        assertEquals(originalBody,state.get().path("requestBody").asText());assertEquals(1,requests.stream().filter(r->r.method().equals("POST")).count());
        assertEquals("/v1/jobs/original-job",requests.get(2).uri().getPath());assertEquals("api.jusuanhub.com",requests.get(2).uri().getHost());assertEquals("model=ernie-Image",requests.get(2).uri().getQuery());
    }
    @Test void unknownSubmitReplyKeepsOriginalReceiptAndCannotPostAgain() {
        var ep=endpoint("ernie-Image");when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"ep","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
        when(models.storedEndpoint("ep")).thenReturn(Optional.of(ep));
        var state=new java.util.concurrent.atomic.AtomicReference<com.fasterxml.jackson.databind.node.ObjectNode>();
        when(upstream.sendJson(any(),any())).thenThrow(new UpstreamCallException(true,new java.io.IOException("submit reply lost")));
        assertEquals("STUDIO_IMAGE_SUBMISSION_UNKNOWN",assertThrows(JusuanImageClient.Pending.class,()->client.generate("ep","original","1024x1024",List.of(),"key","owner",stage->{},null,null,state::set)).code());
        assertTrue(state.get().path("submitAttempted").asBoolean());assertFalse(state.get().has("jobId"));
        assertThrows(JusuanImageClient.Pending.class,()->client.generate("ep","original","1024x1024",List.of(),"key","owner",stage->{},null,state.get(),state::set));
        verify(upstream,times(1)).sendJson(any(),any());verifyNoInteractions(http);
    }

}
