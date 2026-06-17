package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelUsageRecordDto;
import com.aistareco.aep.dto.AiModelUsageReportDto;
import com.aistareco.aep.dto.AiModelUsageStatDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelFailureCategory;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelUsageRecord;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.repository.AiModelUsageRecordRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    private AiModelEndpointRepository endpointRepo;

    @Autowired
    private AiModelUsageService service;

    private int seq = 0;

    private void seed(String providerId, String providerName, String model,
                      long prompt, long completion, long total, Instant createdAt) {
        seed(providerId, providerName, model, "SCRIPT_DRAFT", prompt, completion, total, true, createdAt);
    }

    private void seed(String providerId, String providerName, String model, String purpose,
                      long prompt, long completion, long total, boolean success, Instant createdAt) {
        AiModelUsageRecord r = AiModelUsageRecord.builder()
                .id("aiu-" + (seq++))
                .providerId(providerId).providerName(providerName).model(model)
                .purpose(purpose)
                .promptTokens(prompt).completionTokens(completion).totalTokens(total)
                .success(success).createdAt(createdAt).build();
        repo.saveAndFlush(r);
    }

    private void seedAttr(String userId, String tenantId, String appCode,
                          long prompt, long completion, long total, Instant createdAt) {
        seedAttr(userId, tenantId, appCode, "SCRIPT_DRAFT", prompt, completion, total, createdAt);
    }

    private void seedAttr(String userId, String tenantId, String appCode, String purpose,
                          long prompt, long completion, long total, Instant createdAt) {
        AiModelUsageRecord r = AiModelUsageRecord.builder()
                .id("aiu-" + (seq++))
                .providerId("p1").providerName("火山方舟").model("doubao")
                .purpose(purpose)
                .userId(userId).tenantId(tenantId).appCode(appCode)
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
    void aggregatesByPurposeDailyAndFailures() {
        Instant now = Instant.now();
        // 两种用途 + 一条失败调用（token 空）+ 一条窗口外
        seed("p1", "火山方舟", "doubao", "SCRIPT_DRAFT", 10, 20, 30, true, now);
        seed("p1", "火山方舟", "doubao", "SELLING_POINTS", 5, 5, 10, true, now);
        seed("p1", "火山方舟", "doubao", "SELLING_POINTS", 0, 0, 0, false, now);       // 失败
        seed("p2", "DeepSeek", "deepseek-chat", "SCRIPT_DRAFT", 7, 3, 10, true, now.minus(2, ChronoUnit.DAYS));
        seed("p2", "DeepSeek", "deepseek-chat", "SCRIPT_DRAFT", 999, 1, 1000, true, now.minus(40, ChronoUnit.DAYS)); // 窗口外

        AiModelUsageReportDto report = service.report(30);

        // 成功调用总计：3 次（失败与窗口外不计 token）
        assertEquals(3, report.totalCalls());
        assertEquals(1, report.failedCalls());

        // byPurpose：脚本起草(40) 在 卖点提取(10) 前；标签为中文
        assertEquals(2, report.byPurpose().size());
        AiModelUsageStatDto topPurpose = report.byPurpose().get(0);
        assertEquals("SCRIPT_DRAFT", topPurpose.key());
        assertEquals("脚本起草", topPurpose.label());
        assertEquals(40, topPurpose.totalTokens());

        // byDay：两个有数据的自然日（今天 + 2 天前），仅成功调用，按日期升序
        assertEquals(2, report.byDay().size());
        long dailyCalls = report.byDay().stream().mapToLong(d -> d.calls()).sum();
        assertEquals(3, dailyCalls); // 今天 2 次 + 2 天前 1 次（失败不计）
        assertTrue(report.byDay().get(0).date().compareTo(report.byDay().get(1).date()) < 0);
    }

    @Test
    void aggregatesByUserTenantAndAppCode() {
        Instant now = Instant.now();
        seedAttr("user-a", "tenant-a", "drama", 10, 20, 30, now);
        seedAttr("user-a", "tenant-a", "drama", 5, 5, 10, now);
        seedAttr("user-b", "tenant-b", "celebrity", 50, 50, 100, now);
        seedAttr(null, null, null, 1, 1, 2, now);
        seedAttr(null, null, null, null, 2, 1, 3, now);

        AiModelUsageReportDto report = service.report(30);

        AiModelUsageStatDto userA = report.byUser().stream()
                .filter(s -> "user-a".equals(s.key())).findFirst().orElseThrow();
        assertEquals(2, userA.calls());
        assertEquals(40, userA.totalTokens());

        AiModelUsageStatDto tenantB = report.byTenant().stream()
                .filter(s -> "tenant-b".equals(s.key())).findFirst().orElseThrow();
        assertEquals(100, tenantB.totalTokens());

        AiModelUsageStatDto drama = report.byAppCode().stream()
                .filter(s -> "drama".equals(s.key())).findFirst().orElseThrow();
        assertEquals("AI 短剧", drama.label());
        assertEquals(40, drama.totalTokens());

        AiModelUsageStatDto celebrity = report.byAppCode().stream()
                .filter(s -> "celebrity".equals(s.key())).findFirst().orElseThrow();
        assertEquals("AI 明星带货", celebrity.label());
        assertEquals(102, celebrity.totalTokens());

        assertTrue(report.byUser().stream().anyMatch(s -> "unassigned".equals(s.key())));
        assertTrue(report.byAppCode().stream().anyMatch(s -> "unknown".equals(s.key())));
    }

    @Test
    void recordsInferAppCodeAndEstimateCost() {
        Instant now = Instant.now();
        endpointRepo.saveAndFlush(AiModelEndpoint.builder()
                .id("p-cost")
                .name("成本端点")
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("https://llm.example.test/v1")
                .upstreamApiKeyEncrypted("encrypted")
                .model("drama-model")
                .promptTokenPriceMicros(1000)
                .completionTokenPriceMicros(2000)
                .enabled(true)
                .createdAt(now)
                .updatedAt(now)
                .build());
        AiModelUsageRecord record = AiModelUsageRecord.builder()
                .id("aiu-cost")
                .providerId("p-cost")
                .model("drama-model")
                .purpose("DRAMA_SCRIPT_DRAFT")
                .promptTokens(1500L)
                .completionTokens(500L)
                .totalTokens(2000L)
                .requestId("aic-test-001")
                .upstreamId("chatcmpl-test")
                .latencyMs(1280L)
                .errorCode(null)
                .success(true)
                .createdAt(now)
                .build();
        repo.saveAndFlush(record);

        AiModelUsageRecordDto dto = service.records(30, "drama", null, null, null, null, null, null, 20)
                .stream()
                .filter(row -> "aiu-cost".equals(row.id()))
                .findFirst()
                .orElseThrow();

        assertEquals("drama", dto.appCode());
        assertEquals("AI 短剧", dto.appLabel());
        assertEquals("成本端点", dto.providerName());
        assertEquals(2500, dto.estimatedCostMicros());
        assertEquals("aic-test-001", dto.requestId());
        assertEquals("chatcmpl-test", dto.upstreamId());
        assertEquals(1280L, dto.latencyMs());
    }

    @Test
    void recordObservedClassifiesFailureCategory() {
        assertEquals(AiModelFailureCategory.RATE_LIMIT,
                AiModelFailureCategory.classify("HTTP_429", "rate_limit_exceeded"));

        repo.saveAndFlush(AiModelUsageRecord.builder()
                .id("aiu-rate-limit")
                .providerId("p-fail")
                .providerName("限速端点")
                .model("gpt-test")
                .purpose("SCRIPT_DRAFT")
                .requestId("aic-rate-limit")
                .latencyMs(12L)
                .errorCode("HTTP_429")
                .errorCategory(AiModelFailureCategory.RATE_LIMIT)
                .success(false)
                .createdAt(Instant.now())
                .build());

        AiModelUsageRecordDto dto = service.records(30, null, null, null, null, "p-fail", false, null, 20)
                .stream()
                .findFirst()
                .orElseThrow();

        assertEquals(AiModelFailureCategory.RATE_LIMIT.name(), dto.errorCategory());
        assertEquals(AiModelFailureCategory.RATE_LIMIT.label(), dto.errorCategoryLabel());
        assertEquals(1, service.report(30).byFailureCategory().stream()
                .filter(row -> AiModelFailureCategory.RATE_LIMIT.name().equals(row.category()))
                .mapToLong(row -> row.calls())
                .sum());
    }

    @Test
    void reportBuildsQuotaAndFailureRateAlerts() {
        Instant now = Instant.now();
        endpointRepo.saveAndFlush(AiModelEndpoint.builder()
                .id("p-alert")
                .name("告警端点")
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("https://llm.example.test/v1")
                .upstreamApiKeyEncrypted("encrypted")
                .model("alert-model")
                .dailyTokenQuota(100L)
                .dailyCostQuotaMicros(1000L)
                .alertFailureRatePct(20)
                .enabled(true)
                .createdAt(now)
                .updatedAt(now)
                .build());
        for (int i = 0; i < 3; i++) {
            repo.saveAndFlush(AiModelUsageRecord.builder()
                    .id("aiu-alert-ok-" + i)
                    .providerId("p-alert")
                    .providerName("告警端点")
                    .model("alert-model")
                    .purpose("SCRIPT_DRAFT")
                    .promptTokens(20L)
                    .completionTokens(10L)
                    .totalTokens(30L)
                    .costMicros(300L)
                    .success(true)
                    .createdAt(now)
                    .build());
        }
        for (int i = 0; i < 2; i++) {
            repo.saveAndFlush(AiModelUsageRecord.builder()
                    .id("aiu-alert-fail-" + i)
                    .providerId("p-alert")
                    .providerName("告警端点")
                    .model("alert-model")
                    .purpose("SCRIPT_DRAFT")
                    .errorCode("HTTP_503")
                    .errorCategory(AiModelFailureCategory.PROVIDER_UNAVAILABLE)
                    .success(false)
                    .createdAt(now)
                    .build());
        }

        AiModelUsageReportDto report = service.reportForProvider("p-alert", 30);

        assertTrue(report.alerts().stream().anyMatch(alert -> "daily_token_quota".equals(alert.type())));
        assertTrue(report.alerts().stream().anyMatch(alert -> "daily_cost_quota".equals(alert.type())));
        assertTrue(report.alerts().stream().anyMatch(alert -> "failure_rate".equals(alert.type())));
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
