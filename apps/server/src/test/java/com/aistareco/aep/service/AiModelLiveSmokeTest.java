package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelProvider;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiModelProviderRepository;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 真实大模型 smoke / 录制测试 —— 验证「给出可用 AK → 前端的大模型调用能正常 work」。
 *
 * 默认 SKIP（不影响 ./mvnw test）。仅当配齐下列配置（环境变量优先，同名 -D 系统属性兜底）才发起真实调用：
 *
 *   AEP_LLM_TEST_BASE_URL   必填  OpenAI 兼容 base（如 https://dashscope.aliyuncs.com/compatible-mode/v1）
 *   AEP_LLM_TEST_API_KEY    必填  真实 apiKey（仅在本机内存里被 AES-GCM 加密→解密，不落盘、不打印）
 *   AEP_LLM_TEST_MODEL      必填  模型名（如 qwen-plus / doubao-1-5-pro-32k / gpt-4o-mini）
 *   AEP_LLM_TEST_PROVIDER_TYPE  选填  默认 OPENAI_COMPATIBLE
 *   AEP_LLM_TEST_PROMPT         选填  默认一句自我介绍
 *   AEP_LLM_TEST_RECORD_DIR     选填  录制落盘目录，默认 ./target/llm-recordings/（已在 .gitignore）
 *
 * 调用结果（请求 messages + 解析后的响应，**不含 apiKey**）以 pretty JSON 落盘，供前端联调参照。
 *
 * 跑法：
 *   AEP_LLM_TEST_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
 *   AEP_LLM_TEST_API_KEY=sk-xxxx AEP_LLM_TEST_MODEL=qwen-plus \
 *   ./mvnw -Dtest=AiModelLiveSmokeTest test
 */
class AiModelLiveSmokeTest {

    private static final ObjectMapper OM = new ObjectMapper();

    @Test
    void liveChatCompletionReturnsContent() throws Exception {
        String baseUrl = cfg("AEP_LLM_TEST_BASE_URL");
        String apiKey = cfg("AEP_LLM_TEST_API_KEY");
        String model = cfg("AEP_LLM_TEST_MODEL");
        Assumptions.assumeTrue(
                hasText(baseUrl) && hasText(apiKey) && hasText(model),
                "Set AEP_LLM_TEST_BASE_URL / AEP_LLM_TEST_API_KEY / AEP_LLM_TEST_MODEL to run the live LLM chat smoke test");

        AiModelProviderType type = AiModelProviderType.fromWire(cfgOrDefault("AEP_LLM_TEST_PROVIDER_TYPE", "OPENAI_COMPATIBLE"));
        String prompt = cfgOrDefault("AEP_LLM_TEST_PROMPT", "用一句话介绍你自己，并说明你是哪个模型。");

        AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
        when(repo.findByEnabledTrueOrderByPriorityAsc())
                .thenReturn(List.of(liveProvider("live-chat", baseUrl, apiKey, model, type)));

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", "你是一个简洁的中文助手。"),
                Map.of("role", "user", "content", prompt));
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("model", model);
        options.put("temperature", 0.3);
        options.put("max_tokens", 256);

        AiModelInvocationService.AiModelResponse resp =
                new AiModelInvocationService(repo, mock(AiModelUsageService.class)).invokeChat(AiModelPurpose.GENERAL, messages, options);

        assertNotNull(resp, "response 不应为 null");
        assertNotNull(resp.content(), "content 不应为 null");
        assertFalse(resp.content().isBlank(), "LLM 应返回非空内容（AK 可用 + 模型存在 → 调用 work）");

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("request", Map.of("messages", messages, "options", options));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", resp.content());
        response.put("finishReason", resp.finishReason());
        response.put("tokensUsed", resp.tokensUsed());
        response.put("providerUsed", resp.providerUsed());
        response.put("modelUsed", resp.modelUsed());
        payload.put("response", response);

        Path file = record("chat", baseUrl, model, payload);
        System.out.println("[AiModelLiveSmokeTest] chat OK — tokens=" + resp.tokensUsed()
                + " finish=" + resp.finishReason() + " recorded=" + file.toAbsolutePath());
        System.out.println("[AiModelLiveSmokeTest] content: " + truncate(resp.content(), 200));
    }

    @Test
    void liveTestConnectionReachesProvider() throws Exception {
        String baseUrl = cfg("AEP_LLM_TEST_BASE_URL");
        String apiKey = cfg("AEP_LLM_TEST_API_KEY");
        String model = cfgOrDefault("AEP_LLM_TEST_MODEL", "gpt-4o");
        Assumptions.assumeTrue(
                hasText(baseUrl) && hasText(apiKey),
                "Set AEP_LLM_TEST_BASE_URL / AEP_LLM_TEST_API_KEY to run the live connectivity test");

        AiModelProviderType type = AiModelProviderType.fromWire(cfgOrDefault("AEP_LLM_TEST_PROVIDER_TYPE", "OPENAI_COMPATIBLE"));
        AiModelProviderRepository repo = mock(AiModelProviderRepository.class);
        when(repo.findById("live-conn"))
                .thenReturn(Optional.of(liveProvider("live-conn", baseUrl, apiKey, model, type)));

        Map<String, Object> result = new AiModelInvocationService(repo, mock(AiModelUsageService.class)).testConnection("live-conn");
        Path file = record("connection", baseUrl, model, result);
        System.out.println("[AiModelLiveSmokeTest] testConnection result=" + result
                + " recorded=" + file.toAbsolutePath());

        // 结构性保证：service 要么拿到 HTTP statusCode（baseUrl 可达 + TLS 通），要么明确报 error。
        // 注意：部分 OpenAI 兼容厂商不提供 GET /v1/models（会 4xx/404），此时 ok=false 但网络是通的；
        // 真正的可用性判定以 liveChatCompletionReturnsContent 为准。
        assertTrue(result.containsKey("statusCode") || result.containsKey("error"),
                "testConnection 应返回 statusCode 或 error：" + result);
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private static AiModelProvider liveProvider(String id, String baseUrl, String apiKey,
                                                String model, AiModelProviderType type) {
        return AiModelProvider.builder()
                .id(id)
                .name(id + "-" + type.wire())
                .providerType(type)
                .baseUrl(baseUrl)
                .apiKeyEncrypted(AepCryptoUtil.encrypt(apiKey))
                .defaultModel(model)
                .purposes(List.of(AiModelPurpose.GENERAL.wire()))
                .priority(1)
                .enabled(true)
                .build();
    }

    /** 录制到磁盘；apiKey 从不进入 payload。返回写入的文件路径。 */
    private static Path record(String kind, String baseUrl, String model, Object payload) throws Exception {
        Path dir = Path.of(cfgOrDefault("AEP_LLM_TEST_RECORD_DIR", "target/llm-recordings"));
        Files.createDirectories(dir);
        String ts = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS")
                .withZone(ZoneId.systemDefault()).format(Instant.now());
        Path file = dir.resolve(kind + "-" + ts + ".json");
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("recordedAt", Instant.now().toString());
        envelope.put("kind", kind);
        envelope.put("baseUrl", baseUrl);
        envelope.put("model", model);
        envelope.put("payload", payload);
        Files.writeString(file, OM.writerWithDefaultPrettyPrinter().writeValueAsString(envelope));
        return file;
    }

    /** 环境变量优先，同名系统属性（-Dxxx）兜底，便于本地 mvn 调试。 */
    private static String cfg(String name) {
        String v = System.getenv(name);
        if (v == null || v.isBlank()) v = System.getProperty(name);
        return v;
    }

    private static String cfgOrDefault(String name, String def) {
        String v = cfg(name);
        return hasText(v) ? v : def;
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    private static String truncate(String s, int n) {
        if (s == null) return "";
        return s.length() <= n ? s : s.substring(0, n) + "…";
    }
}
