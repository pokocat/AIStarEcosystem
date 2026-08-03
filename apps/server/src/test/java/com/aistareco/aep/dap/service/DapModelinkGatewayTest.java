package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.service.modelink.HttpModelinkGateway;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * HttpModelinkGateway 的协议层用例（v0.105-补丁）：删分组、409 可识别、配额耗尽 → 503。
 * 用本机 HttpServer 打桩上游，不打真实七牛 API。
 */
class DapModelinkGatewayTest {

    private HttpServer server;
    private HttpModelinkGateway gateway;
    private final List<String> seen = new ArrayList<>();
    private int status = 200;
    private String body = "{}";

    @BeforeEach
    void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            seen.add(ex.getRequestMethod() + " " + ex.getRequestURI().getPath());
            byte[] out = body.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(status, out.length);
            try (OutputStream os = ex.getResponseBody()) {
                os.write(out);
            }
        });
        server.start();

        AiModelEndpoint ep = AiModelEndpoint.builder()
                .id("EP-1").name("qiniu-modelink")
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort())
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-test"))
                .model("bytedance/doubao-seedance-2-0-260128")
                .build();
        AiModelInvocationService models = mock(AiModelInvocationService.class);
        when(models.resolveEndpoint(any(AiModelPurpose.class))).thenReturn(Optional.of(ep));
        gateway = new HttpModelinkGateway(models, new DapProperties());
    }

    @AfterEach
    void tearDown() {
        if (server != null) server.stop(0);
    }

    @Test
    void deleteGroupCallsUpstreamDeleteEndpoint() {
        body = "{\"message\":\"deleted\"}";
        gateway.deleteGroup("qgroup-1");
        assertEquals(List.of("DELETE /v1/asset-groups/qgroup-1"), seen);
    }

    @Test
    void deleteConflictIsRecognizableSoCallersCanRetryLater() {
        status = 409;
        body = "{\"error\":{\"message\":\"group is not empty\"}}";
        BusinessException ex = assertThrows(BusinessException.class, () -> gateway.deleteGroup("qgroup-1"));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("DAP_MODELINK_GROUP_NOT_DELETABLE", ex.getCode());
    }

    @Test
    void quotaExhaustionSurfacesAsActionable503() {
        // 账号级 3 分组上限打满：上游用普通 4xx + quota 文案，此前被包成笼统的 502
        status = 400;
        body = "{\"error\":{\"message\":\"asset group quota exceeded\"}}";
        BusinessException ex = assertThrows(BusinessException.class,
                () -> gateway.createGroup("liveness_face", "n", "m", "https://x/cb"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        assertEquals("DAP_MODELINK_QUOTA_EXCEEDED", ex.getCode());
        assertTrue(ex.getMessage().contains("配额"), "文案要能指引运维：" + ex.getMessage());
    }

    @Test
    void rateLimitAlsoMapsToQuotaExceeded() {
        status = 429;
        body = "{\"error\":{\"message\":\"too many requests\"}}";
        BusinessException ex = assertThrows(BusinessException.class, () -> gateway.getGroup("qgroup-1"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        assertEquals("DAP_MODELINK_QUOTA_EXCEEDED", ex.getCode());
    }

    @Test
    void otherUpstreamErrorsStayAsCallFailed() {
        status = 500;
        body = "{\"error\":{\"message\":\"internal\"}}";
        BusinessException ex = assertThrows(BusinessException.class, () -> gateway.getAsset("qa-1"));
        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatus());
        assertEquals("DAP_MODELINK_CALL_FAILED", ex.getCode());
    }

    @Test
    void successfulResponsesAreNeverMisreadAsQuotaErrors() {
        // 正常 2xx 响应体里出现 limit 之类的字样不得被误判
        body = "{\"qgroupid\":\"qg-1\",\"status\":\"pending\",\"message\":\"no limit issue\"}";
        assertEquals("qg-1", gateway.createGroup("aigc", "n", "m", null).qgroupid());
    }
}
