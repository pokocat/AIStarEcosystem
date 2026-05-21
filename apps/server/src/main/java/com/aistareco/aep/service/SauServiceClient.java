package com.aistareco.aep.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * sau-service (Python + Playwright，独立 FastAPI 进程) HTTP 调用门面。
 *
 * 范式模仿 AiModelInvocationService:33-93：
 *   - 静态 HttpClient (复用连接池)
 *   - 出站统一加 X-Internal-Secret header
 *   - 错误用 BusinessException(BAD_GATEWAY, "SAU_*", ...) 包
 *
 * Endpoints (与 apps/sau-service/src/sau_service/main.py 路由对齐)：
 *   POST /login/start              - 启动 Playwright 取 QR
 *   GET  /login/poll?ticket=…      - 轮询扫码状态；成功时返回明文 storage_state
 *   POST /accounts/verify          - 用现有 storage_state 跑一次验证
 *   POST /upload                   - 提交上传任务
 *   GET  /tasks/{id}               - 查任务状态 (resume sweep 用)
 *   POST /tasks/{id}/cancel        - 取消任务
 */
@Service
public class SauServiceClient {

    private static final ObjectMapper OM = new ObjectMapper();
    // Force HTTP/1.1: Java's default HttpClient negotiates HTTP/2 with an h2c
    // upgrade header on plain http://, which uvicorn (the FastAPI server used by
    // sau-service) doesn't speak — it logs "Unsupported upgrade request" and
    // drops the body, yielding spurious 422s on every POST. HTTPS/prod won't
    // hit this (h2 negotiates over ALPN), but pinning HTTP/1.1 here keeps dev
    // + container-to-container traffic simple and works the same everywhere.
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(8))
            .build();
    private static final String INTERNAL_SECRET_HEADER = "X-Internal-Secret";

    private final String baseUrl;
    private final String sharedSecret;
    private final int requestTimeoutMs;

    public SauServiceClient(@Value("${sau.base-url:http://localhost:8090}") String baseUrl,
                             @Value("${sau.shared-secret:dev-sau-secret}") String sharedSecret,
                             @Value("${sau.request-timeout-ms:30000}") int requestTimeoutMs) {
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.sharedSecret = sharedSecret;
        this.requestTimeoutMs = requestTimeoutMs;
    }

    /** POST /login/start { ticket, platform, accountName } */
    public Map<String, Object> loginStart(String ticket, String platformWire, String accountName) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ticket", ticket);
        body.put("platform", platformWire);
        body.put("accountName", accountName);
        return postJson("/login/start", body);
    }

    /** GET /login/poll?ticket=… 返回 {status: pending|success|expired, storageStatePlain?, profile?} */
    public Map<String, Object> loginPoll(String ticket) {
        String q = "?ticket=" + URLEncoder.encode(ticket, StandardCharsets.UTF_8);
        return getJson("/login/poll" + q);
    }

    /** POST /login/cancel?ticket=… — 关掉远端 sau-service 的扫码会话，触发 playwright teardown。
     *  幂等：sau-service 返回 204，不存在的 ticket 静默成功。 */
    public void loginCancel(String ticket) {
        String q = "?ticket=" + URLEncoder.encode(ticket, StandardCharsets.UTF_8);
        postJson("/login/cancel" + q, Map.of());
    }

    /** POST /accounts/verify { platform, storageState } 返回 {valid, refreshedStorageState?, profile?} */
    public Map<String, Object> verifyAccount(String platformWire, Map<String, Object> storageState) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("platform", platformWire);
        body.put("storageState", storageState);
        return postJson("/accounts/verify", body);
    }

    /** POST /upload — 返回 {taskId} */
    public Map<String, Object> upload(Map<String, Object> body) {
        return postJson("/upload", body);
    }

    /** GET /tasks/{id} — resume sweep 用 */
    public Map<String, Object> getTask(String taskId) {
        return getJson("/tasks/" + URLEncoder.encode(taskId, StandardCharsets.UTF_8));
    }

    /** POST /tasks/{id}/cancel */
    public void cancelTask(String taskId) {
        postJson("/tasks/" + URLEncoder.encode(taskId, StandardCharsets.UTF_8) + "/cancel",
                Map.of());
    }

    /** POST /tasks/{id}/interaction { code } — 提交用户输入的短信验证码。
     *
     *  sau-service 返回 204 (No Content) on success；409 表示任务当前不在
     *  awaiting_user 状态（前端这边乱序提交，例如反复点了两次）；404 表示
     *  任务不存在（sau-service 重启 in-memory task 丢了）。本方法把这些异常
     *  统一包成 BusinessException 让 controller 处理。
     */
    public void submitInteraction(String taskId, String code) {
        postJson("/tasks/" + URLEncoder.encode(taskId, StandardCharsets.UTF_8) + "/interaction",
                Map.of("code", code));
    }

    // ── 内部 ──────────────────────────────────────────────────────────────

    private Map<String, Object> postJson(String path, Map<String, Object> body) {
        try {
            byte[] payload = OM.writeValueAsBytes(body);
            HttpRequest req = baseBuilder(path)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(payload))
                    .build();
            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            return parseResponse(path, resp);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "SAU_HTTP_ERROR",
                    "调用 sau-service 失败 (" + path + "): " + e.getMessage());
        }
    }

    private Map<String, Object> getJson(String path) {
        try {
            HttpRequest req = baseBuilder(path).GET().build();
            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            return parseResponse(path, resp);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "SAU_HTTP_ERROR",
                    "调用 sau-service 失败 (" + path + "): " + e.getMessage());
        }
    }

    private HttpRequest.Builder baseBuilder(String path) {
        return HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(Duration.ofMillis(requestTimeoutMs))
                .header(INTERNAL_SECRET_HEADER, sharedSecret);
    }

    private Map<String, Object> parseResponse(String path, HttpResponse<String> resp) {
        int code = resp.statusCode();
        String body = resp.body() == null ? "" : resp.body();
        if (code >= 200 && code < 300) {
            if (body.isBlank()) return new HashMap<>();
            try {
                return OM.readValue(body, new TypeReference<>() {});
            } catch (Exception e) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "SAU_PARSE_ERROR",
                        "sau-service 响应解析失败 (" + path + "): " + e.getMessage());
            }
        }
        // 4xx / 5xx
        String snippet = body.length() > 200 ? body.substring(0, 200) : body;
        throw new BusinessException(
                code >= 500 ? HttpStatus.BAD_GATEWAY : HttpStatus.BAD_REQUEST,
                "SAU_HTTP_" + code,
                "sau-service 返回 " + code + " (" + path + "): " + snippet
        );
    }

    private static String stripTrailingSlash(String s) {
        if (s == null) return null;
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}
