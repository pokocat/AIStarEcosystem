package com.aistareco.aep.clip.service.shiliu;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class HttpShiliuGatewayTest {
    private HttpClient http;
    private HttpResponse<String> response;
    private FileStorageService storage;
    private HttpShiliuGateway gateway;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() throws Exception {
        ClipProperties props = new ClipProperties();
        props.setShiliuBaseUrl("https://api.16ai.chat/api/v1/");
        props.setShiliuToken("test-secret-token");
        http = mock(HttpClient.class);
        response = mock(HttpResponse.class);
        storage = mock(FileStorageService.class);
        gateway = new HttpShiliuGateway(props, storage, http);
        when(response.statusCode()).thenReturn(200);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
    }

    @Test
    void textToSpeechStoresDecodedAudioAndNeverPlacesTokenInUrl() throws Exception {
        when(response.body()).thenReturn("{\"code\":0,\"data\":{\"audio\":\"aGVsbG8=\",\"length\":1616},\"msg\":\"\"}");
        when(storage.store(any(byte[].class), eq("clip/preview-voice"), eq("owner-1"), eq("mp3"), eq("audio/mpeg")))
                .thenReturn(new FileStorageService.StoredFile("k", "u", "https://cdn.example/a.mp3", null, 5, "audio/mpeg"));

        ShiliuGateway.Task task = gateway.previewVoice("owner-1", "1801234567890123", "你好，世界");

        assertEquals("succeeded", task.status());
        assertEquals(2, task.durationSec());
        assertEquals("https://cdn.example/a.mp3", task.outputRef());
        ArgumentCaptor<HttpRequest> request = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(request.capture(), any(HttpResponse.BodyHandler.class));
        assertEquals("https://api.16ai.chat/api/v1/speaker/tts", request.getValue().uri().toString());
        assertFalse(request.getValue().uri().toString().contains("test-secret-token"));
        assertEquals("Bearer test-secret-token", request.getValue().headers().firstValue("Authorization").orElseThrow());
    }

    @Test
    void videoCreateAndStatusUseDocumentedIdsAndNormalizeReady() throws Exception {
        when(response.body()).thenReturn("{\"code\":0,\"data\":{\"videoId\":1901234567890123,\"length\":0},\"msg\":\"\"}");
        ShiliuGateway.Task created = gateway.createVideoByText("owner-1", "1801234567890123", "1809876543210321", "一段口播文案");
        assertEquals("video:1901234567890123", created.id());
        assertEquals("processing", created.status());

        when(response.body()).thenReturn("{\"code\":0,\"data\":{\"progress\":100,\"status\":\"ready\",\"videoUrl\":\"https://cos.example/result.mp4\"},\"msg\":\"\"}");
        ShiliuGateway.Task ready = gateway.query(created.id());
        assertEquals("succeeded", ready.status());
        assertEquals("https://cos.example/result.mp4", ready.outputRef());
    }

    @Test
    void nonZeroEnvelopeFailsClosedWithStableCode() {
        when(response.body()).thenReturn("{\"code\":4003,\"data\":null,\"msg\":\"余额不足\"}");
        BusinessException error = assertThrows(BusinessException.class,
                () -> gateway.createVideoByText("owner-1", "1801234567890123", "1809876543210321", "一段口播文案"));
        assertEquals("CLIP_ENGINE_CALL_FAILED", error.getCode());
    }
}
