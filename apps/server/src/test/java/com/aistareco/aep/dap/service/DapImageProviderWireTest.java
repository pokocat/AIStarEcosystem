package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppEndpointCandidateRepository;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DapImageProviderWireTest {
    @Test void agnesRejectsWatermark_butStillReceivesItsImageReferences() throws Exception {
        JsonNode body=generate("agnes-image-2.1-flash",true);
        assertFalse(body.has("watermark"));
        assertEquals("data:image/png;base64,eA==",body.path("image").asText());
        assertEquals("data:image/png;base64,eA==",body.path("extra_body").path("image").get(0).asText());
    }
    @Test void volcengineStillReceivesExplicitWatermarkFalse() throws Exception {
        JsonNode body=generate("doubao-seedream-4-5",false);
        assertTrue(body.has("watermark"));
        assertFalse(body.path("watermark").asBoolean());
    }
    private JsonNode generate(String model,boolean agnes) throws Exception {
        var om=new ObjectMapper();
        var received=new AtomicReference<JsonNode>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/v1/images/generations",exchange->{
            var body=om.readTree(exchange.getRequestBody());received.set(body);
            boolean valid=agnes?!body.has("watermark"):body.has("watermark")&&!body.path("watermark").asBoolean();
            byte[] response=(valid?"{\"data\":[{\"b64_json\":\"eA==\"}]}":"{\"error\":{\"message\":\"unsupported watermark field\"}}")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(valid?200:400,response.length);
            exchange.getResponseBody().write(response);exchange.close();
        });server.start();
        try {
            var models=mock(AiModelInvocationService.class);
            var usage=mock(AiModelUsageService.class);
            var endpoint=AiModelEndpoint.builder().id("wire-test").name("image")
                    .baseUrl("http://127.0.0.1:"+server.getAddress().getPort()+"/v1").model(model)
                    .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("test-key")).build();
            when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE)).thenReturn(Optional.of(endpoint));
            var client=new DapMultimodalClient(new DapProperties(),models,usage,new UpstreamModelHttp(usage),mock(AiAppEndpointCandidateRepository.class));
            assertArrayEquals(new byte[]{'x'},client.generateImage("original character","768x1024",List.of("data:image/png;base64,eA==")));
            return received.get();
        } finally {server.stop(0);}
    }
}
