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

/**
 * 回归测试：AdminCreditController（钱包/流水查询）此前缺失 @PreAuthorize，
 * 任意已登录 admin（含 OPERATOR）都能读取全量钱包余额与流水（含手机号）。
 * 见 TODO.md 2026-07-09 例行 QA 记录。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:admin-credit-sec;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true"
})
class AdminCreditControllerSecurityTest {

    @Autowired
    private MockMvc mvc;

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operator_cannotListWallets() throws Exception {
        mvc.perform(get("/api/admin/wallets")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operator_cannotListLedgerEntries() throws Exception {
        mvc.perform(get("/api/admin/ledger-entries")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "FINANCE_ADMIN")
    void financeAdmin_canListWallets() throws Exception {
        mvc.perform(get("/api/admin/wallets")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void superAdmin_canListLedgerEntries() throws Exception {
        mvc.perform(get("/api/admin/ledger-entries")).andExpect(status().isOk());
    }
}
