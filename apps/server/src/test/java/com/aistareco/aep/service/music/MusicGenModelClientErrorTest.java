package com.aistareco.aep.service.music;

import com.aistareco.aep.config.MusicGenProperties;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.common.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MusicGenModelClientErrorTest {
    @ParameterizedTest
    @ValueSource(ints={200,400,503})
    void httpAndBusinessErrorsRetainSafeProviderReason(int status) throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/",exchange->{
            byte[] body="{\"ResponseMetadata\":{\"Error\":{\"Code\":\"QuotaExceeded\",\"Message\":\"provider quota exceeded token=private-token\"}}}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status,body.length);exchange.getResponseBody().write(body);exchange.close();
        });server.start();
        try {
            var invocation=mock(AiModelInvocationService.class);
            var ep=AiModelEndpoint.builder().id("music").model("music").name("music")
                    .baseUrl("http://127.0.0.1:"+server.getAddress().getPort())
                    .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("test-access:test-secret")).build();
            when(invocation.resolveEndpoint(AiModelPurpose.MUSIC_GENERATION,"music","music"))
                    .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(ep,null,true)));
            var client=new MusicGenModelClient(invocation,new MusicGenProperties());
            var error=assertThrows(BusinessException.class,()->client.poll("music","task1"));
            assertEquals("MUSIC_CALL_FAILED",error.getCode());
            assertTrue(error.getMessage().contains("provider quota exceeded"));
            assertFalse(error.getMessage().contains("private-token"));
        } finally {server.stop(0);}
    }
}
