package com.aistareco.aep.controller;

import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.WalletRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 回归测试：GET /api/admin/users/{id}/wallet 此前缺失 @PreAuthorize，只受
 * /api/admin/** 的 SUPER_ADMIN|OPERATOR 兜底保护 —— 任意 OPERATOR admin 可读取
 * 任意用户的钱包余额，与同目录 AdminCreditController（钱包/流水属资金面，
 * FINANCE_ADMIN 专属）的既有口径矛盾。见例行 QA 记录。
 *
 * 同一轮例行 QA（2026-07-21）另发现 POST /api/admin/users/{id}/credits/adjust
 * 有一模一样的缺口，且更严重——它不是只读泄露，而是可无审批地任意加/扣任意用户
 * 余额（含扣穿到 rechargeBalance 资金面桶），与专门为「运营调差/赠送」设计的
 * maker-checker 治理路径（`AdminCreditOpsController`，只碰 giftBalance）矛盾。
 * 一并在本文件补齐同款鉴权回归测试。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:admin-user-wallet-sec;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true"
})
class AdminUserControllerWalletSecurityTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private WalletRepository walletRepo;

    // 必须挑一个真有 wallet 的 seed 用户 —— AepUserRepository.findAll() 的第一条可能是无 wallet
    // 的管理员账号，会让「有权限」用例误判为 404 而非本测试要验证的 200/403 鉴权分支。
    private String seededUserId() {
        List<Wallet> wallets = walletRepo.findAll();
        return wallets.isEmpty() ? "missing" : wallets.get(0).getUserId();
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operator_cannotReadUserWallet() throws Exception {
        mvc.perform(get("/api/admin/users/" + seededUserId() + "/wallet")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "FINANCE_ADMIN")
    void financeAdmin_canReadUserWallet() throws Exception {
        mvc.perform(get("/api/admin/users/" + seededUserId() + "/wallet")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void superAdmin_canReadUserWallet() throws Exception {
        mvc.perform(get("/api/admin/users/" + seededUserId() + "/wallet")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operator_cannotAdjustUserCredits() throws Exception {
        mvc.perform(post("/api/admin/users/" + seededUserId() + "/credits/adjust")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 10, \"description\": \"qa-security-test\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "FINANCE_ADMIN")
    void financeAdmin_canAdjustUserCredits() throws Exception {
        mvc.perform(post("/api/admin/users/" + seededUserId() + "/credits/adjust")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 10, \"description\": \"qa-security-test\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    void superAdmin_canAdjustUserCredits() throws Exception {
        mvc.perform(post("/api/admin/users/" + seededUserId() + "/credits/adjust")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 10, \"description\": \"qa-security-test\"}"))
                .andExpect(status().isCreated());
    }
}
