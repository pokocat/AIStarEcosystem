package com.aistareco.aep.ipstudio.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Full context on H2 with Flyway (V63) and the startup seed: the admin skill API is SUPER_ADMIN / OPERATOR only
 * (FINANCE_ADMIN and users are refused), the repository skill is seeded and served, and distilling a canvas into a
 * draft is refused for non-operators before anything else happens.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:admin-studio-skill-sec;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.enrollment.enforce=false"
})
class AdminStudioSkillControllerSecurityTest {
    @Autowired private MockMvc mvc;

    // No anonymous case here: the dev profile's DevAutoAuthFilter logs unauthenticated requests in as a seed user on purpose.

    @Test @WithMockUser(roles = "FINANCE_ADMIN")
    void financeAdminIsRefused() throws Exception {
        mvc.perform(get("/api/admin/studio/skills")).andExpect(status().isForbidden());
    }

    @Test @WithMockUser(roles = "USER")
    void aUserTokenIsRefused() throws Exception {
        mvc.perform(get("/api/admin/studio/skills")).andExpect(status().isForbidden());
    }

    @Test @WithMockUser(roles = "OPERATOR")
    void operatorSeesTheSeededRepositorySkillAndItsVersions() throws Exception {
        mvc.perform(get("/api/admin/studio/skills")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.key=='reference-video-recreation')].currentVersion").value(1))
                .andExpect(jsonPath("$.data[?(@.key=='reference-video-recreation')].seedFile").value("reference-video-recreation.md"));
        mvc.perform(get("/api/admin/studio/skills/reference-video-recreation/versions")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].source").value("seed"))
                .andExpect(jsonPath("$.data[0].status").value("published"))
                .andExpect(jsonPath("$.data[0].current").value(true));
        mvc.perform(get("/api/admin/studio/skills/missing")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("STUDIO_SKILL_NOT_FOUND"));
    }

    @Test @WithMockUser(roles = "SUPER_ADMIN")
    void superAdminCannotWithdrawTheOnlyActiveSkill() throws Exception {
        mvc.perform(put("/api/admin/studio/skills/reference-video-recreation/status").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"withdrawn\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("STUDIO_SKILL_LAST_ACTIVE"));
    }

    @Test @WithMockUser(username = "plain-user", roles = "USER")
    void usersSeeActiveSkillsWithTriggersButCannotDistill() throws Exception {
        mvc.perform(get("/api/v1/ip-studio/studio/skills")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].key").value("reference-video-recreation"))
                .andExpect(jsonPath("$.data[0].triggers.default").value(true));
        mvc.perform(post("/api/v1/ip-studio/projects/IPP-x/skill-drafts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientRequestId\":\"d-1\",\"executionId\":\"PEX-x\",\"maxCost\":10}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("STUDIO_SKILL_DRAFT_FORBIDDEN"));
    }
}
