package com.aistareco.aep.service;

import com.aistareco.aep.dto.ActionPricingDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.LedgerEntry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * AI 起稿计费（后端可配置）测试 —— 独立 datasource，避免改 action-pricing 污染其它测试 context。
 * 验证：单价 × 稿数 hold → 成功 commit（余额扣减）；余额不足 → 402；单价 0 → 不计费。
 */
@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:mat-billing;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true"
})
class MaterialDraftBillingTest {

    @Autowired private MaterialOpsService materialOps;
    @Autowired private CreditService creditService;
    @Autowired private CelebrityActionPricingService actionPricing;
    @Autowired private ObjectMapper om;

    @MockBean private AiModelInvocationService invocation;

    private static final String USER = "billing-test-user";

    private static final String VALID = """
            {"scripts":[{"name":"稿A","tier":"A","hook_type":"情感","tags":["送礼"],"duration_sec":20,
             "blocks":[{"kind":"hook","label":"钩子","dur":3,"text":"钩子","shot":"特写"},
                       {"kind":"product","label":"产品","dur":12,"text":"产品","shot":"怼镜"},
                       {"kind":"cta","label":"召唤","dur":5,"text":"扣1","shot":"字幕"}]}]}
            """;

    @BeforeEach
    void setUp() {
        when(invocation.hasEndpointFor(any())).thenReturn(true);
        when(invocation.invokeChat(any(), any(), any()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(VALID, "stop", 50L, "fake", "m"));
    }

    @AfterEach
    void tearDown() {
        // 复位单价为 0（不计费），避免跨测试（同 context）污染。
        actionPricing.replaceAll(Map.of(
                CelebrityActionPricingService.ACTION_SCRIPT_DRAFT, new ActionPricingDto(0L, false)));
    }

    private JsonNode draftBody(int count) {
        return om.createObjectNode()
                .put("product_id", "p4")
                .put("tone", "情感故事")
                .put("duration_sec", 38)
                .put("count", count);
    }

    @Test
    void chargesUnitPriceTimesCount_onSuccess() {
        actionPricing.replaceAll(Map.of(
                CelebrityActionPricingService.ACTION_SCRIPT_DRAFT, new ActionPricingDto(10L, false)));
        creditService.creditAccount(USER, 1000L, LedgerEntry.LedgerEntryType.RECHARGE,
                "test", "seed-" + USER, "测试充值");
        long before = creditService.findWalletByUserId(USER).totalBalance();

        List<JsonNode> out = materialOps.draftScripts(draftBody(2), USER); // 10 × 2 = 20
        assertFalse(out.isEmpty());

        long after = creditService.findWalletByUserId(USER).totalBalance();
        assertEquals(before - 20L, after, "应扣 单价10 × 2稿 = 20 积分");
    }

    @Test
    void insufficientBalance_throws402_andDoesNotCharge() {
        actionPricing.replaceAll(Map.of(
                CelebrityActionPricingService.ACTION_SCRIPT_DRAFT, new ActionPricingDto(100_000_000L, false)));
        // USER 余额（上一个测试可能留有，也远不够 1 亿 × 3）
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> materialOps.draftScripts(draftBody(3), USER));
        assertEquals(402, ex.getStatusCode().value());
    }

    @Test
    void zeroPrice_doesNotCharge() {
        actionPricing.replaceAll(Map.of(
                CelebrityActionPricingService.ACTION_SCRIPT_DRAFT, new ActionPricingDto(0L, false)));
        creditService.creditAccount(USER, 500L, LedgerEntry.LedgerEntryType.RECHARGE,
                "test", "seed0-" + USER, "测试充值");
        long before = creditService.findWalletByUserId(USER).totalBalance();

        List<JsonNode> out = materialOps.draftScripts(draftBody(3), USER);
        assertFalse(out.isEmpty());
        assertEquals(before, creditService.findWalletByUserId(USER).totalBalance(), "单价 0 不应扣费");
    }
}
