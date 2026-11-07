package com.aistareco.aep.controller;

import com.aistareco.aep.repository.AuditLogRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 模型配置页走的入口：谁能调、能调哪些命令、保存后规格是不是原样。
 * 规格用线上真实返回的那份（model-config/live-*.json），fixture 不照被测代码写（AGENTS §8.0.1 ⑦）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:studio-model-config;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false"
})
class AdminStudioModelConfigControllerTest {
    private static final String URL = "/api/admin/studio/model-config/command";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AuditLogRepository audit;

    private ResultActions command(Object body) throws Exception {
        return mvc.perform(post(URL).contentType("application/json").content(mapper.writeValueAsString(body)));
    }

    private JsonNode data(Object body) throws Exception {
        String text = command(body).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return mapper.readTree(text).path("data");
    }

    private JsonNode live(String file) throws Exception {
        return mapper.readTree(new ClassPathResource("model-config/" + file).getInputStream());
    }

    private ObjectNode save(String id, ObjectNode value) {
        ObjectNode command = mapper.createObjectNode().put("action", "endpointSave");
        if (id != null) command.put("id", id);
        command.set("value", value);
        return command;
    }

    private JsonNode endpoint(String id) throws Exception {
        for (JsonNode row : data(mapper.createObjectNode().put("action", "endpoints")))
            if (id.equals(row.path("id").asText())) return row;
        throw new AssertionError("模型不在列表里：" + id);
    }

    private ObjectNode newImageEndpoint() throws Exception {
        ObjectNode value = mapper.createObjectNode().put("name", "测试图片模型").put("providerType", "OPENAI_COMPATIBLE")
                .put("baseUrl", "https://images.example.invalid/v1").put("apiKey", "sk-test-only").put("model", "image-model").put("enabled", false);
        value.set("imageRequestSpec", live("live-image-spec.json"));
        return value;
    }

    @Test
    void anonymousIsRejected() throws Exception {
        command(mapper.createObjectNode().put("action", "endpoints")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    void ordinaryUsersCannotReadModelConfig() throws Exception {
        command(mapper.createObjectNode().put("action", "endpoints")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "FINANCE_ADMIN")
    void financeAdminsCannotReadModelConfig() throws Exception {
        command(mapper.createObjectNode().put("action", "endpoints")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void commandsOutsideThePageAreRefusedEvenIfTheServiceKnowsThem() throws Exception {
        for (String action : new String[]{"prompts", "promptSave", "agents", "agentDelete", "bind", "usage", "nope"})
            command(mapper.createObjectNode().put("action", action)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("MODEL_MANAGEMENT_COMMAND_INVALID"));
    }

    @Test
    @WithMockUser(username = "ops-tester", roles = "OPERATOR")
    void aSaveNamesThisPageAsItsSourceInTheAuditLog() throws Exception {
        data(save(null, newImageEndpoint()));
        assertTrue(audit.findAll().stream().anyMatch(row -> "studio-admin".equals(row.getAppCode())
                && "platform.model.endpointSave".equals(row.getAction()) && "ops-tester".equals(row.getUserId())));
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void changingOneFieldLeavesTheStoredSpecUntouched() throws Exception {
        String id = data(save(null, newImageEndpoint())).path("id").asText();
        JsonNode before = endpoint(id).path("imageRequestSpec");
        assertTrue(before.path("wire").path("requireExactOutputSize").asBoolean());

        data(save(id, mapper.createObjectNode().put("enabled", true).put("name", "改过的名字")));

        JsonNode after = endpoint(id);
        assertEquals("改过的名字", after.path("name").asText());
        assertEquals(before, after.path("imageRequestSpec"));
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void sendingTheReturnedSpecBackKeepsEveryField() throws Exception {
        String imageId = data(save(null, newImageEndpoint())).path("id").asText();
        JsonNode image = endpoint(imageId).path("imageRequestSpec");
        assertEquals(live("live-image-spec.json"), image);
        ObjectNode resend = mapper.createObjectNode();
        resend.set("imageRequestSpec", image);
        data(save(imageId, resend));
        assertEquals(image, endpoint(imageId).path("imageRequestSpec"));

        ObjectNode video = mapper.createObjectNode().put("name", "测试视频模型").put("providerType", "VOLCENGINE")
                .put("baseUrl", "https://video.example.invalid/api/v3").put("apiKey", "sk-test-only").put("model", "video-model").put("enabled", false);
        video.set("videoRequestSpec", live("live-video-spec.json"));
        String videoId = data(save(null, video)).path("id").asText();
        JsonNode stored = endpoint(videoId).path("videoRequestSpec");
        assertEquals(live("live-video-spec.json"), stored);
        ObjectNode resendVideo = mapper.createObjectNode();
        resendVideo.set("videoRequestSpec", stored);
        data(save(videoId, resendVideo));
        assertEquals(stored, endpoint(videoId).path("videoRequestSpec"));
    }

    /** 请求解析是宽松的，不拦的话写错的字段名会被悄悄丢掉，页面上还显示保存成功。 */
    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void aSpecFieldTheServerDoesNotKnowIsRefusedNotDropped() throws Exception {
        ObjectNode value = newImageEndpoint();
        ((ObjectNode) value.get("imageRequestSpec").get("wire")).put("requireExactOutputSizee", true);
        command(save(null, value)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("IMAGE_REQUEST_SPEC_INVALID"));
    }

    /** 这几个限额没传就会被清空（服务端一直如此，老后台靠它清除），所以页面每次保存都要带上。 */
    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void limitsMustBeSentAlongOrTheyAreCleared() throws Exception {
        ObjectNode value = newImageEndpoint();
        value.put("rpmLimit", 60).put("tpmLimit", 1000).put("dailyTokenQuota", 5000L).put("dailyCostQuotaMicros", 9000000L).put("alertFailureRatePct", 20).put("concurrencyLimit", 3);
        String id = data(save(null, value)).path("id").asText();

        ObjectNode withLimits = mapper.createObjectNode().put("enabled", true).put("rpmLimit", 60).put("tpmLimit", 1000)
                .put("dailyTokenQuota", 5000L).put("dailyCostQuotaMicros", 9000000L).put("alertFailureRatePct", 20);
        data(save(id, withLimits));
        JsonNode kept = endpoint(id);
        assertEquals(60, kept.path("rpmLimit").asInt());
        assertEquals(20, kept.path("alertFailureRatePct").asInt());
        assertEquals(3, kept.path("concurrencyLimit").asInt());

        data(save(id, mapper.createObjectNode().put("enabled", false)));
        JsonNode cleared = endpoint(id);
        assertFalse(cleared.hasNonNull("rpmLimit"));
        assertEquals(3, cleared.path("concurrencyLimit").asInt());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void costsCannotComeThroughTheModelSave() throws Exception {
        command(save(null, newImageEndpoint().put("unitPriceMicros", 5))).andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void thePageCanLoadEverythingItNeeds() throws Exception {
        for (String action : new String[]{"endpoints", "presets", "modelAccessCatalog", "functionCatalog", "functionPricingCatalog", "sceneCatalog", "studioVideoGroup", "directorImageDefault"})
            command(mapper.createObjectNode().put("action", action)).andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
    }
}
