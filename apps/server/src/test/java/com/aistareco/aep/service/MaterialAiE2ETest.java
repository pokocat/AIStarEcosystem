package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * 素材运营「文本三件」接真 LLM 测试（MATERIAL_OPS_AI_TEXT_PLAN §10）。
 * 用 @MockBean 桩掉 AiModelInvocationService（不连真 provider），覆盖：
 *   - 正常 JSON → 结构化结果
 *   - 脏输出 → 自修复重试 → 通过
 *   - 无 provider / 异常 → 占位兜底，HTTP 仍 200
 *   - 变量抽取过滤幻觉（原值不在脚本里 → 丢弃）
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:mat-ai-e2e;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true"
})
class MaterialAiE2ETest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper om;
    @Autowired private MaterialAiService materialAi;

    @MockBean private AiModelInvocationService invocation;

    @BeforeEach
    void setUp() {
        // 默认「已绑定端点」，个别测试再覆盖为 false。
        when(invocation.hasEndpointFor(any())).thenReturn(true);
    }

    private AiModelInvocationService.AiModelResponse resp(String content) {
        return new AiModelInvocationService.AiModelResponse(content, "stop", 100L, "fake", "fake-model");
    }

    private static final String VALID_SCRIPTS = """
            {"scripts":[{"name":"测试稿A","tier":"A","hook_type":"情感","tags":["送礼"],
             "duration_sec":20,"blocks":[
               {"kind":"hook","label":"钩子","dur":3,"text":"钩子文案","shot":"特写"},
               {"kind":"product","label":"产品","dur":12,"text":"产品文案","shot":"怼镜"},
               {"kind":"cta","label":"召唤","dur":5,"text":"评论区扣1","shot":"字幕"}]}]}
            """;

    // ── 脚本起稿 ───────────────────────────────────────────────────────────────
    @Test
    void aiDraft_validJson_returnsStructuredScripts() throws Exception {
        when(invocation.invokeChat(any(), any(), any())).thenReturn(resp(VALID_SCRIPTS));
        String body = """
                {"product_id":"p4","tone":"情感故事","audience":["打工人"],"duration_sec":38,"count":2}
                """;
        mvc.perform(post("/api/material/scripts/ai-draft").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].kind").value("ai_seed"))
                .andExpect(jsonPath("$.data[0].name").value("测试稿A"))
                .andExpect(jsonPath("$.data[0].product_id").value("p4"))
                .andExpect(jsonPath("$.data[0].blocks.length()").value(3))
                .andExpect(jsonPath("$.data[0].blocks[0].kind").value("hook"));
    }

    @Test
    void aiDraft_dirtyThenValid_selfRepairs() throws Exception {
        // 第一次脏输出（解析失败）→ 自修复重试 → 第二次合法 JSON
        when(invocation.invokeChat(any(), any(), any()))
                .thenReturn(resp("这不是 JSON，只是一段闲聊。"))
                .thenReturn(resp(VALID_SCRIPTS));
        String body = """
                {"product_id":"p4","tone":"情感故事","audience":["打工人"],"duration_sec":38,"count":1}
                """;
        mvc.perform(post("/api/material/scripts/ai-draft").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("测试稿A"));
    }

    @Test
    void aiDraft_noProvider_surfacesConfigError() throws Exception {
        // 未为该用途绑定端点 → 明确 503 + AI_NOT_CONFIGURED（不再静默兜底占位池）
        when(invocation.hasEndpointFor(AiModelPurpose.SCRIPT_DRAFT)).thenReturn(false);
        String body = """
                {"product_id":"p4","tone":"情感故事","audience":["打工人"],"duration_sec":38,"count":3}
                """;
        mvc.perform(post("/api/material/scripts/ai-draft").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("AI_NOT_CONFIGURED"))
                .andExpect(jsonPath("$.error.message", org.hamcrest.Matchers.containsString("AI 模型")));
    }

    @Test
    void aiDraft_invokeFails_surfacesCallError() throws Exception {
        // provider 已配但调用失败（如 401 token 无效）→ 502 + AI_CALL_FAILED
        when(invocation.invokeChat(any(), any(), any()))
                .thenThrow(new BusinessException(HttpStatus.UNAUTHORIZED, "AI_PROVIDER_HTTP_401", "provider HTTP 401"));
        String body = """
                {"product_id":"p4","tone":"情感故事","audience":["打工人"],"duration_sec":38,"count":2}
                """;
        mvc.perform(post("/api/material/scripts/ai-draft").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error.code").value("AI_CALL_FAILED"))
                .andExpect(jsonPath("$.error.message", org.hamcrest.Matchers.containsString("API Key")));
    }

    // ── 卖点提取（直接打 MaterialAiService） ──────────────────────────────────────
    @Test
    void sellingPoints_validJson_joinsWithSlash() {
        when(invocation.invokeChat(any(), any(), any()))
                .thenReturn(resp("{\"selling_points\":[\"卖点一\",\"卖点二\",\"卖点三\"]}"));
        String out = materialAi.extractSellingPoints("便携按摩仪", "https://example.com");
        assertEquals("卖点一 / 卖点二 / 卖点三", out);
    }

    @Test
    void sellingPoints_noProvider_throwsConfigError() {
        when(invocation.hasEndpointFor(AiModelPurpose.SELLING_POINTS)).thenReturn(false);
        BusinessException ex = assertThrows(BusinessException.class,
                () -> materialAi.extractSellingPoints("便携按摩仪", "https://example.com"));
        assertEquals("AI_NOT_CONFIGURED", ex.getCode());
    }

    @Test
    void sellingPoints_invokeFails_throwsCallError() {
        when(invocation.invokeChat(any(), any(), any()))
                .thenThrow(new BusinessException(HttpStatus.BAD_GATEWAY, "AI_PROVIDER_ERROR", "boom"));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> materialAi.extractSellingPoints("便携按摩仪", "https://example.com"));
        assertEquals("AI_CALL_FAILED", ex.getCode());
    }

    // ── 变量抽取（过滤幻觉） ──────────────────────────────────────────────────────
    @Test
    void extractVariables_filtersHallucinatedOriginals() {
        when(invocation.invokeChat(any(), any(), any())).thenReturn(resp("""
                {"variables":[
                  {"id":"person","name":"人物身份","values":["修了 30 年车","干了 20 年工地"],
                   "appearances":[{"shot":0,"phrase":"修了 30 年车"}],"suggestions":["当了 25 年护士"]},
                  {"id":"ghost","name":"幻觉变量","values":["脚本里根本没有的原值XYZ"],
                   "appearances":[],"suggestions":[]}
                ]}
                """));
        ArrayNode blocks = om.createArrayNode();
        ObjectNode b0 = om.createObjectNode();
        b0.put("kind", "hook");
        b0.put("text", "修了 30 年车，第一次给老婆买按摩仪");
        blocks.add(b0);

        List<JsonNode> vars = materialAi.extractVariables(blocks);
        assertEquals(1, vars.size(), "幻觉变量（原值不在脚本里）应被过滤");
        assertEquals("person", vars.get(0).get("id").asText());
        assertEquals("修了 30 年车", vars.get(0).get("values").get(0).asText());
        assertFalse(vars.get(0).get("toneVar").asText().isBlank(), "toneVar 由 server 按序补色");
    }
}
