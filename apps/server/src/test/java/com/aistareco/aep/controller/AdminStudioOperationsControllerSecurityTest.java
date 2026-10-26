package com.aistareco.aep.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Cross-account Studio metrics must never be exposed to anonymous or ordinary product users. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:studio-operations-security;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false"
})
class AdminStudioOperationsControllerSecurityTest {
    @Autowired MockMvc mvc;

    @Test
    void anonymousCannotReadAnyStudioOperationsEndpoint() throws Exception {
        mvc.perform(get("/api/admin/studio-operations")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/studio-operations/reconciliation-details?check=A")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/studio-operations/credit-events")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    void ordinaryUserCannotReadAnyStudioOperationsEndpoint() throws Exception {
        mvc.perform(get("/api/admin/studio-operations")).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/studio-operations/reconciliation-details?check=A")).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/studio-operations/credit-events")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void superAdminCanReadDashboard() throws Exception {
        mvc.perform(get("/api/admin/studio-operations?days=7")).andExpect(status().isOk());
    }
}
