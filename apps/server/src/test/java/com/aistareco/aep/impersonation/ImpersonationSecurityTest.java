package com.aistareco.aep.impersonation;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AdminUserRepository;
import com.aistareco.aep.repository.AepUserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 真 Spring Security 链 + H2，使用生成的测试账号，不操作外部用户。 */
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:impersonation-security;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
    "aep.seed.dev-data.enabled=false", "aep.dev-auth.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ImpersonationSecurityTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AepUserRepository users;
    @Autowired AdminUserRepository admins;
    @Autowired JwtUtil jwt;
    AepUser target;
    AdminUser admin;
    String adminToken;

    @BeforeEach void accounts() {
        String suffix = UUID.randomUUID().toString();
        target = users.saveAndFlush(AepUser.builder().id("u-" + suffix).username("user-" + suffix)
            .displayName("Before").kind(AepUser.AccountKind.PERSONAL).status(AepUser.UserStatus.ACTIVE)
            .createdAt(Instant.now()).updatedAt(Instant.now()).build());
        admin = admins.saveAndFlush(AdminUser.builder().id("a-" + suffix).username("admin-" + suffix)
            .role(AdminUser.AdminRole.SUPER_ADMIN).status(AdminUser.AdminStatus.ACTIVE)
            .createdAt(Instant.now()).updatedAt(Instant.now()).build());
        adminToken = jwt.adminToken(admin.getId(), admin.getUsername(), "SUPER_ADMIN");
    }
    String start() throws Exception {
        String body = mvc.perform(post("/api/admin/aep-users/{id}/impersonate", target.getId())
            .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON)
            .content("{\"product\":\"drama\"}"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(body).path("data").path("handoffUrl").asText().split("#code=")[1];
    }
    String enter(String code) throws Exception {
        String body = mvc.perform(post("/api/auth/impersonation/exchange")
            .header("Origin", "https://drama.aibuzz.cn").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(java.util.Map.of("code", code, "product", "drama"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).path("data").path("token").asText();
    }
    @Test void onlyCurrentSuperAdminCanStart() throws Exception {
        String path = "/api/admin/aep-users/" + target.getId() + "/impersonate";
        mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{\"product\":\"drama\"}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(post(path).header("Authorization", "Bearer " + jwt.consumerToken(target))
            .contentType(MediaType.APPLICATION_JSON).content("{\"product\":\"drama\"}"))
            .andExpect(status().isForbidden());
        admin.setRole(AdminUser.AdminRole.OPERATOR); admins.saveAndFlush(admin);
        mvc.perform(post(path).header("Authorization", "Bearer " + adminToken)
            .contentType(MediaType.APPLICATION_JSON).content("{\"product\":\"drama\"}"))
            .andExpect(status().isForbidden());
    }
    @Test void fullLoginAllowsRealUserWriteWithoutGrantingAdminPrivileges() throws Exception {
        String token = enter(start());
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(target.getId()));
        mvc.perform(patch("/api/me").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"Changed by user session\"}"))
            .andExpect(status().isOk());
        assertThat(users.findById(target.getId()).orElseThrow().getDisplayName()).isEqualTo("Changed by user session");
        mvc.perform(get("/api/admin/staff").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        // 用户没有开通 drama，附身不会替其绕过既有产品开通闸。
        mvc.perform(post("/api/me/drama/projects").header("Authorization", "Bearer " + token)
            .header("X-App-Code", "drama").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("PRODUCT_NOT_ENROLLED"));
    }
    @Test void oneTimeCodeAndIdempotentExitDoNotAffectRealUserSession() throws Exception {
        String code = start(); String token = enter(code); String normal = jwt.consumerToken(target);
        mvc.perform(post("/api/auth/impersonation/exchange").header("Origin", "https://drama.aibuzz.cn")
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(java.util.Map.of("code", code, "product", "drama"))))
            .andExpect(status().isUnauthorized());
        for (int i = 0; i < 2; i++) mvc.perform(post("/api/auth/impersonation/exit").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + normal)).andExpect(status().isOk());
    }
    @Test void revocationCannotBeReversedByReEnablingTheAdministrator() throws Exception {
        String token = enter(start());
        admin.setStatus(AdminUser.AdminStatus.SUSPENDED); admins.saveAndFlush(admin);
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        admin.setStatus(AdminUser.AdminStatus.ACTIVE); admins.saveAndFlush(admin);
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }
    @Test void unknownTokenCannotFallBackToAnotherAuthentication() throws Exception {
        mvc.perform(get("/api/me").header("Authorization", "Bearer imp_unknown"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error.code").value("IMPERSONATION_EXPIRED"));
    }
}
