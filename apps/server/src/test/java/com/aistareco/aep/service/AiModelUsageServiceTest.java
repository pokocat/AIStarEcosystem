package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelUsageReportDto;
import com.aistareco.aep.dto.AiModelUsageStatDto;
import com.aistareco.aep.model.AiModelUsageRecord;
import com.aistareco.aep.repository.AiModelUsageRecordRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * AiModelUsageService 聚合查询测试（H2 / @DataJpaTest）。
 *
 * 重点验证 repository 的 Object[] 聚合（含单行 totals 与 COALESCE(SUM,0)）能正确映射，
 * 以及时间窗 since 过滤生效。
 */
@DataJpaTest
@Import(AiModelUsageService.class)
class AiModelUsageServiceTest {

    @Autowired
    private AiModelUsageRecordRepository repo;

    @Autowired
    private AiModelUsageService service;

    private int seq = 0;

    private void seed(String providerId, String providerName, String model,
                      long prompt, long completion, long total, Instant createdAt) {
        AiModelUsageRecord r = AiModelUsageRecord.builder()
                .id("aiu-" + (seq++))
                .providerId(providerId).providerName(providerName).model(model)
                .purpose("SCRIPT_DRAFT")
                .promptTokens(prompt).completionTokens(completion).totalTokens(total)
                .success(true).createdAt(createdAt).build();
        repo.saveAndFlush(r);
    }

    @Test
    void aggregatesTotalsAndGroups() {
        Instant now = Instant.now();
        seed("p1", "火山方舟", "doubao", 10, 20, 30, now);
        seed("p1", "火山方舟", "doubao", 5, 5, 10, now);
        seed("p2", "DeepSeek", "deepseek-chat", 100, 100, 200, now);
        // 窗口外（40 天前），应被 days=30 过滤掉
        seed("p2", "DeepSeek", "deepseek-chat", 999, 999, 1998, now.minus(40, ChronoUnit.DAYS));

        AiModelUsageReportDto report = service.report(30);

        assertEquals(30, report.windowDays());
        assertEquals(3, report.totalCalls());            // 窗口外那条不计
        assertEquals(240, report.totalTokens());         // 30 + 10 + 200
        assertEquals(115, report.promptTokens());        // 10 + 5 + 100
        assertEquals(125, report.completionTokens());    // 20 + 5 + 100

        // byProvider：p2(200) 排在 p1(40) 前（按 totalTokens 降序）
        assertEquals(2, report.byProvider().size());
        AiModelUsageStatDto top = report.byProvider().get(0);
        assertEquals("p2", top.key());
        assertEquals("DeepSeek", top.label());
        assertEquals(1, top.calls());
        assertEquals(200, top.totalTokens());

        // byModel：doubao 2 次 40 token
        AiModelUsageStatDto doubao = report.byModel().stream()
                .filter(s -> "doubao".equals(s.key())).findFirst().orElseThrow();
        assertEquals(2, doubao.calls());
        assertEquals(40, doubao.totalTokens());
    }

    @Test
    void singleProviderReportFiltersToProvider() {
        Instant now = Instant.now();
        seed("p1", "火山方舟", "doubao", 10, 20, 30, now);
        seed("p2", "DeepSeek", "deepseek-chat", 100, 100, 200, now);

        AiModelUsageReportDto report = service.reportForProvider("p1", 30);

        assertEquals(1, report.totalCalls());
        assertEquals(30, report.totalTokens());
        assertEquals(1, report.byProvider().size());
        assertEquals("p1", report.byProvider().get(0).key());
        assertEquals(1, report.byModel().size());
        assertEquals("doubao", report.byModel().get(0).key());
    }

    @Test
    void emptyWindowReturnsZeros() {
        AiModelUsageReportDto report = service.report(7);
        assertNotNull(report);
        assertEquals(0, report.totalCalls());
        assertEquals(0, report.totalTokens());
        assertEquals(0, report.byProvider().size());
        assertEquals(0, report.byModel().size());
    }
}
