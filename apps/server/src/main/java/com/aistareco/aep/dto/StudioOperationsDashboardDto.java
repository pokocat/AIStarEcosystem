package com.aistareco.aep.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Studio 积分与生成运营看板的一期只读契约。
 *
 * <p>所有积分仍是平台积分单位；{@code yuanEquivalent} 只是按 1 元 = 100 积分展示的
 * 运营换算，不代表收入、回款或毛利。未接入的数据源必须用 unavailable 明示，不能用 0 冒充。
 */
public record StudioOperationsDashboardDto(
        Instant generatedAt,
        String timezone,
        Window window,
        Health health,
        Business business,
        Technology technology,
        Integrations integrations
) {
    public record Window(int days, Instant startInclusive, Instant endExclusive, String label) {}

    public record Health(
            String status,
            List<ReconciliationCheck> checks,
            long stuckHoldsOverSixHours,
            long abnormalModels,
            IntegrationState reconciliationAgent
    ) {}

    public record ReconciliationCheck(
            String id,
            String label,
            long count,
            String status,
            boolean detailAvailable
    ) {}

    public record Business(
            SpendTotals totals,
            List<DailySpend> dailySpend,
            List<ModelSpend> models,
            List<FeatureSpend> features,
            IssuanceSummary issuance
    ) {}

    public record SpendTotals(long walletCredits, long grantCredits, long totalCredits, double yuanEquivalent) {}
    public record DailySpend(String date, long walletCredits, long grantCredits) {}
    public record ModelSpend(String endpointId, String name, long jobs, long succeeded, long refunded,
                             long inFlight, long credits, long walletCredits, long grantCredits) {}
    public record FeatureSpend(String feature, long jobs, long succeeded, long refunded, long inFlight,
                               long credits) {}
    public record IssuanceSummary(long issuedCredits, double yuanEquivalent, long walletBalance,
                                  long grantAvailable, String usageAttributionStatus, String note) {}

    public record Technology(
            List<GenerationModel> models,
            List<FailureReason> failureReasons,
            Latency imageLatency,
            Latency videoLatency,
            QueueState queue,
            SupplierState supplier
    ) {}

    public record GenerationModel(String key, String supplier, String mediaType, long jobs, long succeeded,
                                  long failed, long inFlight, Double successRate, String ownership,
                                  List<HourlyOutcome> hourlyOutcomes) {}
    public record HourlyOutcome(Instant hour, long succeeded, long failed, long inFlight, String status) {}
    public record FailureReason(String category, String label, long count, String ownership) {}
    public record Latency(String mediaType, Long p50Seconds, Long p95Seconds, long samples, String note) {}
    public record QueueState(long queued, Long averageWaitSeconds, Long concurrencyRemaining,
                             String concurrencyStatus, long pendingReconciliation, String note) {}
    public record SupplierState(long platformRequestErrors, long supplierErrors, long unknownErrors,
                                Long rateLimited, Long dailyUsage, Long quotaRemaining, String quotaStatus) {}

    public record Integrations(IntegrationState release, IntegrationState feishuAlerts,
                               IntegrationState requestLogs) {}
    public record IntegrationState(String status, Instant observedAt, String conclusion, String note,
                                   String href) {}

    public record DetailPage(String checkId, List<Map<String, String>> items, int page, int size,
                             long total, boolean hasMore) {}
    public record CreditEventPage(List<CreditEvent> items, int page, int size, long total,
                                  boolean hasMore) {}
    public record CreditEvent(String id, String type, String actor, String beneficiary, long credits,
                              double yuanEquivalent, String reason, Instant createdAt) {}
}
