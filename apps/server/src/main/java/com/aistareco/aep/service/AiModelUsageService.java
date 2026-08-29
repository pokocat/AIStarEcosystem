package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelAlertDto;
import com.aistareco.aep.dto.AiModelFailureStatDto;
import com.aistareco.aep.dto.AiModelUsageDailyDto;
import com.aistareco.aep.dto.AiModelUsageReportDto;
import com.aistareco.aep.dto.AiModelUsageRecordDto;
import com.aistareco.aep.dto.AiModelUsageStatDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelFailureCategory;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AiModelUsageRecord;
import com.aistareco.aep.model.Membership;
import com.aistareco.aep.model.Tenant;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.repository.AiModelUsageRecordRepository;
import com.aistareco.aep.repository.MembershipRepository;
import com.aistareco.aep.repository.TenantRepository;
import com.aistareco.common.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 大模型用量统计（v0.41）。
 *
 * - record(...)：每次成功 chat 调用后落一条流水（best-effort，绝不阻断业务）。
 * - report(...)：按时间窗聚合出报表，供 admin /api/admin/ai-models/usage 查询。
 *
 * 设计取舍：各厂商无统一用量协议，故不去打各家的计费 / 余额接口，而是把每次响应里
 * 已经返回的 usage（prompt/completion/total tokens）自行落库聚合，对所有 provider 通用。
 */
@Service
public class AiModelUsageService {

    private static final Logger log = LoggerFactory.getLogger(AiModelUsageService.class);
    private static final int DEFAULT_WINDOW_DAYS = 30;
    private static final int MAX_WINDOW_DAYS = 365;
    /** 「按天」分桶所用时区（运营在国内，按北京自然日切分）。 */
    private static final ZoneId BUCKET_ZONE = ZoneId.of("Asia/Shanghai");

    private final AiModelUsageRecordRepository repo;
    private final AiModelEndpointRepository endpointRepo;
    private final AepUserRepository userRepo;
    private final TenantRepository tenantRepo;
    private final MembershipRepository membershipRepo;

    @Value("${aep.llm.alert.failure-rate-pct:20}")
    private int defaultFailureRateAlertPct = 20;

    @Value("${aep.llm.alert.min-calls:5}")
    private int failureRateMinCalls = 5;

    @Value("${aep.llm.alert.quota-warn-ratio:0.8}")
    private double quotaWarnRatio = 0.8;

    public AiModelUsageService(AiModelUsageRecordRepository repo,
                               AiModelEndpointRepository endpointRepo,
                               AepUserRepository userRepo,
                               TenantRepository tenantRepo,
                               MembershipRepository membershipRepo) {
        this.repo = repo;
        this.endpointRepo = endpointRepo;
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
        this.membershipRepo = membershipRepo;
    }

    /**
     * 记录一次调用用量。独立事务（REQUIRES_NEW）+ 全程 try/catch：
     * 写库失败只 log，不影响 chat 主流程（调用方可能跑在 NOT_SUPPORTED 事务里）。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String providerId, String providerName, String model, String purpose,
                       Long promptTokens, Long completionTokens, Long totalTokens, boolean success) {
        recordObserved(providerId, providerName, model, purpose,
                promptTokens, completionTokens, totalTokens, success,
                null, null, null, null, null);
    }

    /**
     * 记录一次带观测字段的调用用量。requestId / latency / errorCode 用于 admin 明细排障。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordObserved(String providerId, String providerName, String model, String purpose,
                               Long promptTokens, Long completionTokens, Long totalTokens, boolean success,
                               String requestId, String upstreamId, Long latencyMs,
                               String errorCode, String errorMessage) {
        recordObserved(providerId, providerName, model, purpose,
                promptTokens, completionTokens, totalTokens, success,
                requestId, upstreamId, latencyMs, errorCode, errorMessage,
                null, null, null);
    }

    /**
     * 记录一次带观测字段和请求/响应摘要的调用用量。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordObserved(String providerId, String providerName, String model, String purpose,
                               Long promptTokens, Long completionTokens, Long totalTokens, boolean success,
                               String requestId, String upstreamId, Long latencyMs,
                               String errorCode, String errorMessage,
                               String requestBodyJson, String responseBodyJson,
                               String replayOfRecordId) {
        Attribution attribution = currentAttribution();
        saveRecord(providerId, providerName, model, purpose,
                promptTokens, completionTokens, totalTokens, success,
                attribution.userId(), attribution.tenantId(), attribution.appCode(),
                requestId, upstreamId, latencyMs, errorCode, errorMessage,
                requestBodyJson, responseBodyJson, replayOfRecordId,
                null, null, null);
    }

    /**
     * 记录一次带显式归属的调用。给内嵌外部 LLM API 等无 servlet 安全上下文的链路使用。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordWithAttribution(String providerId, String providerName, String model, String purpose,
                                      Long promptTokens, Long completionTokens, Long totalTokens, boolean success,
                                      String userId, String tenantId, String appCode) {
        recordObservedWithAttribution(providerId, providerName, model, purpose,
                promptTokens, completionTokens, totalTokens, success,
                userId, tenantId, appCode,
                null, null, null, null, null);
    }

    /**
     * 记录一次带显式归属与观测字段的调用。给内嵌外部 LLM API 等链路使用。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordObservedWithAttribution(String providerId, String providerName, String model, String purpose,
                                             Long promptTokens, Long completionTokens, Long totalTokens, boolean success,
                                             String userId, String tenantId, String appCode,
                                             String requestId, String upstreamId, Long latencyMs,
                                             String errorCode, String errorMessage) {
        recordObservedWithAttribution(providerId, providerName, model, purpose,
                promptTokens, completionTokens, totalTokens, success,
                userId, tenantId, appCode,
                requestId, upstreamId, latencyMs, errorCode, errorMessage,
                null, null, null);
    }

    /**
     * 记录一次带显式归属、观测字段和请求/响应摘要的调用。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordObservedWithAttribution(String providerId, String providerName, String model, String purpose,
                                             Long promptTokens, Long completionTokens, Long totalTokens, boolean success,
                                             String userId, String tenantId, String appCode,
                                             String requestId, String upstreamId, Long latencyMs,
                                             String errorCode, String errorMessage,
                                             String requestBodyJson, String responseBodyJson,
                                             String replayOfRecordId) {
        saveRecord(providerId, providerName, model, purpose,
                promptTokens, completionTokens, totalTokens, success,
                userId, tenantId, appCode,
                requestId, upstreamId, latencyMs, errorCode, errorMessage,
                requestBodyJson, responseBodyJson, replayOfRecordId,
                null, null, null);
    }

    /**
     * 记录图片/视频等非 token 型调用。billingMode 为空时仍按用途自动推断：
     * 图片按次，视频按秒，文本按 token。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordMeteredObserved(String providerId, String providerName, String model, String purpose,
                                      Long promptTokens, Long completionTokens, Long totalTokens,
                                      AiModelBillingMode billingMode, Long billableUnits, Long billableSeconds,
                                      boolean success,
                                      String requestId, String upstreamId, Long latencyMs,
                                      String errorCode, String errorMessage) {
        Attribution attribution = currentAttribution();
        saveRecord(providerId, providerName, model, purpose,
                promptTokens, completionTokens, totalTokens, success,
                attribution.userId(), attribution.tenantId(), attribution.appCode(),
                requestId, upstreamId, latencyMs, errorCode, errorMessage,
                null, null, null,
                billingMode, billableUnits, billableSeconds);
    }

    /** 记录带显式归属的非 token 型调用，供异步 worker 使用。 */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordMeteredObservedWithAttribution(String providerId, String providerName, String model, String purpose,
                                                     Long promptTokens, Long completionTokens, Long totalTokens,
                                                     AiModelBillingMode billingMode, Long billableUnits, Long billableSeconds,
                                                     boolean success,
                                                     String userId, String tenantId, String appCode,
                                                     String requestId, String upstreamId, Long latencyMs,
                                                     String errorCode, String errorMessage,
                                                     String requestBodyJson, String responseBodyJson,
                                                     String replayOfRecordId) {
        saveRecord(providerId, providerName, model, purpose,
                promptTokens, completionTokens, totalTokens, success,
                userId, tenantId, appCode,
                requestId, upstreamId, latencyMs, errorCode, errorMessage,
                requestBodyJson, responseBodyJson, replayOfRecordId,
                billingMode, billableUnits, billableSeconds);
    }

    private void saveRecord(String providerId, String providerName, String model, String purpose,
                            Long promptTokens, Long completionTokens, Long totalTokens, boolean success,
                            String userId, String tenantId, String appCode,
                            String requestId, String upstreamId, Long latencyMs,
                            String errorCode, String errorMessage,
                            String requestBodyJson, String responseBodyJson,
                            String replayOfRecordId,
                            AiModelBillingMode requestedBillingMode,
                            Long requestedBillableUnits,
                            Long requestedBillableSeconds) {
        try {
            String normalizedUserId = blankToNull(userId);
            String normalizedTenantId = firstNonBlank(tenantId, resolveTenantId(normalizedUserId));
            String normalizedAppCode = firstNonBlank(normalizeAppCode(appCode), inferAppCodeForPurpose(purpose));
            AiModelEndpoint endpoint = endpointRepo.findById(blankToNull(providerId) == null ? "" : providerId).orElse(null);
            long prompt = safeLong(promptTokens);
            long completion = safeLong(completionTokens);
            long total = totalTokens != null ? Math.max(0L, totalTokens) : prompt + completion;
            AiModelBillingMode billingMode = effectiveBillingMode(endpoint, purpose, requestedBillingMode);
            long billableUnits = effectiveBillableUnits(billingMode, requestedBillableUnits, success);
            long billableSeconds = effectiveBillableSeconds(requestedBillableSeconds, success);
            long unitPriceMicros = endpoint == null ? 0L : Math.max(0L, endpoint.getUnitPriceMicros());
            Long costMicros = estimateCostMicros(prompt, completion, billingMode, billableUnits, billableSeconds, unitPriceMicros, endpoint);
            AiModelFailureCategory errorCategory = success
                    ? null
                    : AiModelFailureCategory.classify(errorCode, errorMessage);
            AiModelUsageRecord rec = AiModelUsageRecord.builder()
                    .id("aiu-" + UUID.randomUUID().toString().substring(0, 16))
                    .providerId(providerId)
                    .providerName(providerName)
                    .model(model)
                    .purpose(purpose)
                    .userId(normalizedUserId)
                    .tenantId(normalizedTenantId)
                    .appCode(normalizedAppCode)
                    .requestId(truncate(blankToNull(requestId), 96))
                    .upstreamId(truncate(blankToNull(upstreamId), 128))
                    .latencyMs(latencyMs != null && latencyMs >= 0 ? latencyMs : null)
                    .errorCode(truncate(blankToNull(errorCode), 64))
                    .errorCategory(errorCategory)
                    .errorMessage(truncate(blankToNull(errorMessage), 512))
                    .requestBodyJson(truncate(blankToNull(requestBodyJson), 16_000))
                    .responseBodyJson(truncate(blankToNull(responseBodyJson), 16_000))
                    .costMicros(costMicros)
                    .billingMode(billingMode)
                    .billableUnits(billableUnits)
                    .billableSeconds(billableSeconds)
                    .unitPriceMicros(unitPriceMicros)
                    .replayOfRecordId(truncate(blankToNull(replayOfRecordId), 64))
                    .promptTokens(promptTokens)
                    .completionTokens(completionTokens)
                    .totalTokens(totalTokens)
                    .success(success)
                    .build();
            repo.save(rec);
            bumpEndpointCounters(endpoint, success, total, billableUnits, billableSeconds);
        } catch (Exception e) {
            log.warn("[ai-usage] 记录用量失败 provider={} model={}: {}", providerName, model, e.toString());
        }
    }

    /** 全局用量报表（最近 days 天，缺省/越界回落到 30，封顶 365）。 */
    @Transactional(readOnly = true)
    public AiModelUsageReportDto report(Integer days) {
        int window = clampDays(days);
        Instant since = Instant.now().minus(window, ChronoUnit.DAYS);
        List<AiModelUsageStatDto> byProvider = mapRows(repo.aggregateByProvider(since));
        List<AiModelUsageStatDto> byModel = mapRows(repo.aggregateByModel(since));
        List<AiModelUsageStatDto> byPurpose = mapPurposeRows(repo.aggregateByPurpose(since, null));
        List<AiModelUsageStatDto> byUser = mapUserRows(repo.aggregateByUser(since, null));
        List<AiModelUsageStatDto> byTenant = mapTenantRows(repo.aggregateByTenant(since, null));
        List<AiModelUsageStatDto> byAppCode = mapAppRows(repo.aggregateByAppCode(since, null));
        List<AiModelUsageDailyDto> byDay = buildDaily(repo.dailyRows(since, null));
        long failedCalls = repo.countFailed(since, null);
        List<AiModelFailureStatDto> byFailureCategory = mapFailureRows(repo.aggregateFailuresByCategory(since, null));
        List<AiModelAlertDto> alerts = buildAlerts(since, null);
        // 总计由分组行汇总（按服务商分组无重复计数），避开 Spring Data 单行 Object[] 聚合的包装坑。
        long[] totals = sumStats(byProvider);
        return new AiModelUsageReportDto(
                window, since,
                totals[0], totals[1], totals[2], totals[3], totals[4], totals[5], totals[6], failedCalls,
                alerts, byFailureCategory,
                byProvider, byModel, byPurpose, byUser, byTenant, byAppCode, byDay);
    }

    @Transactional(readOnly = true)
    public List<AiModelUsageRecordDto> records(Integer days,
                                               String appCode,
                                               String userId,
                                               String tenantId,
                                               String purpose,
                                               String providerId,
                                               Boolean success,
                                               String q,
                                               Integer size) {
        int window = clampDays(days);
        int safeSize = clampSize(size);
        String normalizedApp = normalizeAppCode(appCode);
        int fetchSize = normalizedApp == null ? safeSize : Math.min(2000, safeSize * 4);
        List<AiModelUsageRecord> records = repo.searchRecords(
                Instant.now().minus(window, ChronoUnit.DAYS),
                blankToNull(providerId),
                blankToNull(userId),
                blankToNull(tenantId),
                blankToNull(purpose),
                success,
                blankToNull(q),
                PageRequest.of(0, fetchSize));

        Map<String, AiModelEndpoint> endpoints = endpointMap(records);
        Map<String, String> userLabels = userLabels(records);
        Map<String, String> tenantLabels = tenantLabels(records);

        return records.stream()
                .map(record -> toRecordDto(record, endpoints.get(record.getProviderId()), userLabels, tenantLabels))
                .filter(dto -> normalizedApp == null || normalizedApp.equals(dto.appCode()))
                .limit(safeSize)
                .toList();
    }

    public AiModelUsageRecordDto recordDto(AiModelUsageRecord record) {
        if (record == null) {
            throw BusinessException.notFound("LLM_USAGE_RECORD_NOT_FOUND", "调用记录不存在");
        }
        List<AiModelUsageRecord> records = List.of(record);
        Map<String, AiModelEndpoint> endpoints = endpointMap(records);
        Map<String, String> userLabels = userLabels(records);
        Map<String, String> tenantLabels = tenantLabels(records);
        return toRecordDto(record, endpoints.get(record.getProviderId()), userLabels, tenantLabels);
    }

    /** 单服务商用量报表。byProvider 仅该服务商一行；byModel / byPurpose / byDay 限定该端点。 */
    @Transactional(readOnly = true)
    public AiModelUsageReportDto reportForProvider(String providerId, Integer days) {
        int window = clampDays(days);
        Instant since = Instant.now().minus(window, ChronoUnit.DAYS);
        List<AiModelUsageStatDto> byProvider = mapRows(repo.aggregateByProvider(since)).stream()
                .filter(s -> providerId.equals(s.key()))
                .toList();
        List<AiModelUsageStatDto> byModel = mapRows(repo.aggregateByModelForProvider(providerId, since));
        List<AiModelUsageStatDto> byPurpose = mapPurposeRows(repo.aggregateByPurpose(since, providerId));
        List<AiModelUsageStatDto> byUser = mapUserRows(repo.aggregateByUser(since, providerId));
        List<AiModelUsageStatDto> byTenant = mapTenantRows(repo.aggregateByTenant(since, providerId));
        List<AiModelUsageStatDto> byAppCode = mapAppRows(repo.aggregateByAppCode(since, providerId));
        List<AiModelUsageDailyDto> byDay = buildDaily(repo.dailyRows(since, providerId));
        long failedCalls = repo.countFailed(since, providerId);
        List<AiModelFailureStatDto> byFailureCategory = mapFailureRows(repo.aggregateFailuresByCategory(since, providerId));
        List<AiModelAlertDto> alerts = buildAlerts(since, providerId);
        long[] totals = sumStats(byModel);
        return new AiModelUsageReportDto(
                window, since,
                totals[0], totals[1], totals[2], totals[3], totals[4], totals[5], totals[6], failedCalls,
                alerts, byFailureCategory,
                byProvider, byModel, byPurpose, byUser, byTenant, byAppCode, byDay);
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    private static int clampDays(Integer days) {
        if (days == null || days <= 0) return DEFAULT_WINDOW_DAYS;
        return Math.min(days, MAX_WINDOW_DAYS);
    }

    private static int clampSize(Integer size) {
        if (size == null || size <= 0) return 200;
        return Math.min(size, 500);
    }

    private static List<AiModelUsageStatDto> mapRows(List<Object[]> rows) {
        List<AiModelUsageStatDto> out = new ArrayList<>();
        if (rows == null) return out;
        for (Object[] r : rows) {
            String key = r[0] != null ? String.valueOf(r[0]) : "(未知)";
            String label = r[1] != null ? String.valueOf(r[1]) : key;
            out.add(new AiModelUsageStatDto(
                    key, label,
                    asLong(r[2]), asLong(r[3]), asLong(r[4]), asLong(r[5]),
                    asLongAt(r, 6), asLongAt(r, 7), asLongAt(r, 8)));
        }
        sortUsageStats(out);
        return out;
    }

    /** 用途分组行：把 purpose wire（[0]）映射成中文展示名，其余同 mapRows。 */
    private static List<AiModelUsageStatDto> mapPurposeRows(List<Object[]> rows) {
        List<AiModelUsageStatDto> out = new ArrayList<>();
        if (rows == null) return out;
        for (Object[] r : rows) {
            String wire = r[0] != null ? String.valueOf(r[0]) : null;
            String key = wire != null ? wire : "GENERAL";
            String label = AiModelPurpose.fromWire(wire).label();
            out.add(new AiModelUsageStatDto(
                    key, label,
                    asLong(r[2]), asLong(r[3]), asLong(r[4]), asLong(r[5]),
                    asLongAt(r, 6), asLongAt(r, 7), asLongAt(r, 8)));
        }
        sortUsageStats(out);
        return out;
    }

    private static List<AiModelFailureStatDto> mapFailureRows(List<Object[]> rows) {
        List<AiModelFailureStatDto> out = new ArrayList<>();
        if (rows == null) return out;
        for (Object[] row : rows) {
            AiModelFailureCategory category = failureCategory(row != null && row.length > 0 ? row[0] : null);
            out.add(new AiModelFailureStatDto(category.name(), category.label(), asLongAt(row, 1)));
        }
        out.sort((a, b) -> Long.compare(b.calls(), a.calls()));
        return out;
    }

    private List<AiModelAlertDto> buildAlerts(Instant since, String providerId) {
        List<AiModelEndpoint> endpoints = providerId == null
                ? endpointRepo.findAllByOrderByCreatedAtDesc()
                : endpointRepo.findById(providerId).stream().toList();
        List<AiModelAlertDto> out = new ArrayList<>();
        Instant now = Instant.now();
        Instant dayStart = todayStart();
        for (AiModelEndpoint endpoint : endpoints) {
            appendQuotaAlert(out, endpoint, "daily_token_quota",
                    repo.sumTotalTokensByProviderSince(endpoint.getId(), dayStart),
                    endpoint.getDailyTokenQuota(),
                    "Token");
            appendQuotaAlert(out, endpoint, "daily_cost_quota",
                    repo.sumCostMicrosByProviderSince(endpoint.getId(), dayStart),
                    endpoint.getDailyCostQuotaMicros(),
                    "成本");

            long total = repo.countTotal(since, endpoint.getId());
            long failed = repo.countFailed(since, endpoint.getId());
            int threshold = endpoint.getAlertFailureRatePct() != null && endpoint.getAlertFailureRatePct() > 0
                    ? endpoint.getAlertFailureRatePct()
                    : defaultFailureRateAlertPct;
            if (total >= Math.max(1, failureRateMinCalls) && threshold > 0) {
                long failureRatePct = Math.round((failed * 100.0d) / Math.max(1L, total));
                if (failureRatePct >= threshold) {
                    String severity = failureRatePct >= Math.max(threshold * 2L, 50L) ? "critical" : "warning";
                    out.add(alert(endpoint, severity, "failure_rate",
                            "失败率异常",
                            endpoint.getName() + " 当前失败率 " + failureRatePct + "%，阈值 " + threshold + "%",
                            failureRatePct, threshold, now));
                }
            }

            List<AiModelUsageRecord> recent = repo.findByProviderIdOrderByCreatedAtDesc(endpoint.getId(), PageRequest.of(0, 3));
            long recentFailures = recent.stream()
                    .filter(r -> r.getCreatedAt() != null && !r.getCreatedAt().isBefore(since))
                    .filter(r -> !r.isSuccess())
                    .count();
            if (recent.size() >= 3 && recentFailures >= 3) {
                out.add(alert(endpoint, "critical", "consecutive_failures",
                        "连续失败",
                        endpoint.getName() + " 最近 3 次调用均失败，请检查模型配置或上游服务",
                        recentFailures, 3, now));
            }
        }
        out.sort((a, b) -> Integer.compare(severityRank(b.severity()), severityRank(a.severity())));
        return out;
    }

    private void appendQuotaAlert(List<AiModelAlertDto> out, AiModelEndpoint endpoint, String type,
                                  long used, Long quota, String unitLabel) {
        if (quota == null || quota <= 0) return;
        long warnAt = Math.max(1L, Math.round(quota * clampQuotaWarnRatio()));
        if (used < warnAt) return;
        boolean critical = used >= quota;
        String title = critical ? unitLabel + "配额已用完" : unitLabel + "配额接近上限";
        String usedLabel = "成本".equals(unitLabel) ? yuanLabel(used) : used + " Token";
        String quotaLabel = "成本".equals(unitLabel) ? yuanLabel(quota) : quota + " Token";
        out.add(alert(endpoint, critical ? "critical" : "warning", type, title,
                endpoint.getName() + " 今日已用 " + usedLabel + " / " + quotaLabel,
                used, quota, Instant.now()));
    }

    private static AiModelAlertDto alert(AiModelEndpoint endpoint, String severity, String type,
                                         String title, String message, long metricValue, long threshold,
                                         Instant now) {
        return new AiModelAlertDto(
                "llm-alert-" + type + "-" + endpoint.getId(),
                severity,
                type,
                endpoint.getId(),
                endpoint.getName(),
                title,
                message,
                metricValue,
                threshold,
                now
        );
    }

    private double clampQuotaWarnRatio() {
        if (!Double.isFinite(quotaWarnRatio) || quotaWarnRatio <= 0 || quotaWarnRatio > 1) return 0.8;
        return quotaWarnRatio;
    }

    private static int severityRank(String severity) {
        return "critical".equals(severity) ? 2 : "warning".equals(severity) ? 1 : 0;
    }

    private static Instant todayStart() {
        return LocalDate.now(BUCKET_ZONE).atStartOfDay(BUCKET_ZONE).toInstant();
    }

    private static AiModelFailureCategory failureCategory(Object raw) {
        if (raw instanceof AiModelFailureCategory category) return category;
        if (raw == null) return AiModelFailureCategory.UNKNOWN;
        try {
            return AiModelFailureCategory.valueOf(String.valueOf(raw));
        } catch (Exception ignored) {
            return AiModelFailureCategory.UNKNOWN;
        }
    }

    private List<AiModelUsageStatDto> mapUserRows(List<Object[]> rows) {
        Map<String, String> labels = new HashMap<>();
        List<String> ids = nonBlankKeys(rows);
        for (AepUser user : userRepo.findAllById(ids)) {
            String display = firstNonBlank(user.getDisplayName(), user.getUsername(), user.getId());
            String username = blankToNull(user.getUsername());
            labels.put(user.getId(), username == null || username.equals(display) ? display : display + " @" + username);
        }
        return mapRows(rows, labels, "unassigned", "未归属用户");
    }

    private List<AiModelUsageStatDto> mapTenantRows(List<Object[]> rows) {
        Map<String, String> labels = new HashMap<>();
        List<String> ids = nonBlankKeys(rows);
        for (Tenant tenant : tenantRepo.findAllById(ids)) {
            labels.put(tenant.getId(), firstNonBlank(tenant.getName(), tenant.getId()));
        }
        return mapRows(rows, labels, "unassigned", "未归属租户");
    }

    private Map<String, AiModelEndpoint> endpointMap(List<AiModelUsageRecord> records) {
        Set<String> ids = records.stream()
                .map(AiModelUsageRecord::getProviderId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
        Map<String, AiModelEndpoint> out = new HashMap<>();
        for (AiModelEndpoint endpoint : endpointRepo.findAllById(ids)) {
            out.put(endpoint.getId(), endpoint);
        }
        return out;
    }

    private Map<String, String> userLabels(List<AiModelUsageRecord> records) {
        List<String> ids = records.stream()
                .map(AiModelUsageRecord::getUserId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        Map<String, String> out = new HashMap<>();
        for (AepUser user : userRepo.findAllById(ids)) {
            String display = firstNonBlank(user.getDisplayName(), user.getUsername(), user.getId());
            String username = blankToNull(user.getUsername());
            out.put(user.getId(), username == null || username.equals(display) ? display : display + " @" + username);
        }
        return out;
    }

    private Map<String, String> tenantLabels(List<AiModelUsageRecord> records) {
        List<String> ids = records.stream()
                .map(AiModelUsageRecord::getTenantId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        Map<String, String> out = new HashMap<>();
        for (Tenant tenant : tenantRepo.findAllById(ids)) {
            out.put(tenant.getId(), firstNonBlank(tenant.getName(), tenant.getId()));
        }
        return out;
    }

    private static AiModelUsageRecordDto toRecordDto(AiModelUsageRecord record,
                                                     AiModelEndpoint endpoint,
                                                     Map<String, String> userLabels,
                                                     Map<String, String> tenantLabels) {
        String purpose = record.getPurpose();
        String appCode = firstNonBlank(normalizeAppCode(record.getAppCode()), inferAppCodeForPurpose(purpose), "unknown");
        long prompt = safeLong(record.getPromptTokens());
        long completion = safeLong(record.getCompletionTokens());
        long total = record.getTotalTokens() != null ? record.getTotalTokens() : prompt + completion;
        AiModelBillingMode billingMode = record.getBillingMode() != null
                ? record.getBillingMode()
                : effectiveBillingMode(endpoint, purpose, null);
        long billableUnits = safeLong(record.getBillableUnits());
        long billableSeconds = safeLong(record.getBillableSeconds());
        long unitPriceMicros = record.getUnitPriceMicros() != null
                ? Math.max(0L, record.getUnitPriceMicros())
                : (endpoint == null ? 0L : Math.max(0L, endpoint.getUnitPriceMicros()));
        return new AiModelUsageRecordDto(
                record.getId(),
                record.getCreatedAt(),
                record.getProviderId(),
                firstNonBlank(record.getProviderName(), endpoint == null ? null : endpoint.getName(), record.getProviderId()),
                record.getModel(),
                purpose,
                AiModelPurpose.fromWire(purpose).label(),
                record.getUserId(),
                labelOrFallback(record.getUserId(), userLabels, "未归属用户"),
                record.getTenantId(),
                labelOrFallback(record.getTenantId(), tenantLabels, "未归属租户"),
                appCode,
                appLabel(appCode),
                prompt,
                completion,
                total,
                billingMode != null ? billingMode.name() : AiModelBillingMode.TOKENS.name(),
                billableUnits,
                billableSeconds,
                unitPriceMicros,
                record.isSuccess(),
                record.getCostMicros() != null
                        ? Math.max(0L, record.getCostMicros())
                        : estimateCostMicros(prompt, completion, billingMode, billableUnits, billableSeconds, unitPriceMicros, endpoint),
                record.getRequestId(),
                record.getUpstreamId(),
                record.getLatencyMs(),
                record.getErrorCode(),
                record.getErrorCategory() != null ? record.getErrorCategory().name() : null,
                record.getErrorCategory() != null ? record.getErrorCategory().label() : null,
                record.getErrorMessage(),
                record.getRequestBodyJson(),
                record.getResponseBodyJson(),
                record.getReplayOfRecordId(),
                record.getQualityScore(),
                record.getQualityLabel(),
                record.getQualityNote());
    }

    private static List<AiModelUsageStatDto> mapAppRows(List<Object[]> rows) {
        Map<String, String> labels = Map.of(
                "music", "AI 音乐人",
                "drama", "AI 短剧",
                "celebrity", "AI 明星带货",
                "aiavatar", "AiAvatar 数字人",
                "star", "明星商务工作台",
                "celebrity-mp", "明星带货·小程序",
                "admin", "管理后台",
                "external-api", "外部 API"
        );
        Map<String, long[]> grouped = new HashMap<>();
        if (rows != null) {
            for (Object[] row : rows) {
                String rawAppCode = row[0] != null ? String.valueOf(row[0]) : null;
                String purpose = row[1] != null ? String.valueOf(row[1]) : null;
                String key = firstNonBlank(normalizeAppCode(rawAppCode), inferAppCodeForPurpose(purpose), "unknown");
                long[] agg = grouped.computeIfAbsent(key, ignored -> new long[7]);
                agg[0] += asLong(row[2]);
                agg[1] += asLong(row[3]);
                agg[2] += asLong(row[4]);
                agg[3] += asLong(row[5]);
                agg[4] += asLongAt(row, 6);
                agg[5] += asLongAt(row, 7);
                agg[6] += asLongAt(row, 8);
            }
        }
        List<AiModelUsageStatDto> out = new ArrayList<>();
        for (Map.Entry<String, long[]> entry : grouped.entrySet()) {
            String key = entry.getKey();
            long[] agg = entry.getValue();
                out.add(new AiModelUsageStatDto(
                    key,
                    labels.getOrDefault(key, "unknown".equals(key) ? "未标记来源" : key),
                    agg[0], agg[1], agg[2], agg[3], agg[4], agg[5], agg[6]));
        }
        sortUsageStats(out);
        return out;
    }

    private static List<AiModelUsageStatDto> mapRows(List<Object[]> rows, Map<String, String> labels,
                                                     String nullKey, String nullLabel) {
        List<AiModelUsageStatDto> out = new ArrayList<>();
        if (rows == null) return out;
        for (Object[] r : rows) {
            String raw = r[0] != null ? String.valueOf(r[0]) : null;
            String key = raw != null && !raw.isBlank() ? raw : nullKey;
            String fallback = r[1] != null ? String.valueOf(r[1]) : key;
            String label = raw == null || raw.isBlank() ? nullLabel : labels.getOrDefault(key, fallback);
            out.add(new AiModelUsageStatDto(
                    key, label,
                    asLong(r[2]), asLong(r[3]), asLong(r[4]), asLong(r[5]),
                    asLongAt(r, 6), asLongAt(r, 7), asLongAt(r, 8)));
        }
        sortUsageStats(out);
        return out;
    }

    /**
     * 把明细行按北京自然日分桶（仅有数据的日子，按日期升序）。
     * 行格式 [0]=createdAt, [1]=total, [2]=prompt, [3]=completion,
     * [4]=billableUnits, [5]=billableSeconds, [6]=costMicros。
     */
    private static List<AiModelUsageDailyDto> buildDaily(List<Object[]> rows) {
        List<AiModelUsageDailyDto> out = new ArrayList<>();
        if (rows == null || rows.isEmpty()) return out;
        Map<LocalDate, long[]> buckets = new TreeMap<>(); // TreeMap → 天然按日期升序
        for (Object[] r : rows) {
            Instant ts = asInstant(r[0]);
            if (ts == null) continue;
            LocalDate day = ts.atZone(BUCKET_ZONE).toLocalDate();
            long[] agg = buckets.computeIfAbsent(day, k -> new long[7]);
            agg[0] += 1;              // calls
            agg[1] += asLong(r[1]);   // total
            agg[2] += asLong(r[2]);   // prompt
            agg[3] += asLong(r[3]);   // completion
            agg[4] += asLongAt(r, 4); // billable units
            agg[5] += asLongAt(r, 5); // billable seconds
            agg[6] += asLongAt(r, 6); // cost
        }
        for (Map.Entry<LocalDate, long[]> e : buckets.entrySet()) {
            long[] a = e.getValue();
            out.add(new AiModelUsageDailyDto(e.getKey().toString(), a[0], a[1], a[2], a[3], a[4], a[5], a[6]));
        }
        return out;
    }

    /** 把分组行汇总成 [calls, total, prompt, completion, units, seconds, costMicros]。 */
    private static long[] sumStats(List<AiModelUsageStatDto> rows) {
        long calls = 0, total = 0, prompt = 0, completion = 0, units = 0, seconds = 0, cost = 0;
        for (AiModelUsageStatDto r : rows) {
            calls += r.calls();
            total += r.totalTokens();
            prompt += r.promptTokens();
            completion += r.completionTokens();
            units += r.billableUnits();
            seconds += r.billableSeconds();
            cost += r.estimatedCostMicros();
        }
        return new long[]{calls, total, prompt, completion, units, seconds, cost};
    }

    private static void sortUsageStats(List<AiModelUsageStatDto> rows) {
        rows.sort((a, b) -> Long.compare(usageSortValue(b), usageSortValue(a)));
    }

    private static long usageSortValue(AiModelUsageStatDto row) {
        if (row.estimatedCostMicros() > 0) return row.estimatedCostMicros();
        if (row.billableSeconds() > 0) return row.billableSeconds();
        if (row.billableUnits() > 0) return row.billableUnits();
        return row.totalTokens();
    }

    private static long asLong(Object o) {
        return o instanceof Number n ? n.longValue() : 0L;
    }

    private static long asLongAt(Object[] row, int index) {
        return row != null && row.length > index ? asLong(row[index]) : 0L;
    }

    private Attribution currentAttribution() {
        String userId = currentUserId();
        HttpServletRequest request = currentRequest();
        String appCode = AuditService.appCode(request);
        return new Attribution(userId, resolveTenantId(userId), appCode);
    }

    private static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Object principal = auth.getPrincipal();
        if (principal == null || "anonymousUser".equals(principal)) return null;
        return blankToNull(auth.getName());
    }

    private static HttpServletRequest currentRequest() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes servletAttrs) {
            return servletAttrs.getRequest();
        }
        return null;
    }

    private String resolveTenantId(String userId) {
        String normalizedUserId = blankToNull(userId);
        if (normalizedUserId == null) return null;
        try {
            return membershipRepo.findByUserId(normalizedUserId).stream()
                    .filter(m -> blankToNull(m.getTenantId()) != null)
                    .sorted(Comparator.comparing(
                            Membership::getJoinedAt,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .map(Membership::getTenantId)
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            log.warn("[ai-usage] resolve tenant failed userId={}: {}", normalizedUserId, e.toString());
            return null;
        }
    }

    private static List<String> nonBlankKeys(List<Object[]> rows) {
        List<String> ids = new ArrayList<>();
        if (rows == null) return ids;
        for (Object[] row : rows) {
            String key = row != null && row.length > 0 && row[0] != null ? String.valueOf(row[0]) : null;
            if (key != null && !key.isBlank()) ids.add(key);
        }
        return ids;
    }

    private static String normalizeAppCode(String appCode) {
        String s = blankToNull(appCode);
        if (s == null) return null;
        s = s.toLowerCase(java.util.Locale.ROOT);
        return s.length() > 32 ? s.substring(0, 32) : s;
    }

    private static String inferAppCodeForPurpose(String purpose) {
        return switch (AiModelPurpose.fromWire(purpose)) {
            case SCRIPT_DRAFT, SELLING_POINTS, VARIABLE_EXTRACT, VIDEO_GENERATION,
                    VIDEO_REF_ANALYSIS, TEMPLATE_REWRITE -> "celebrity";
            case DRAMA_SCRIPT_DRAFT, IMAGE_GENERATION -> "drama";
            case APPEARANCE_FORGE, MUSIC_GENERATION -> "music";
            case DAP_PERSONA, DAP_IMAGE, DAP_VIDEO, DAP_REAL_AVATAR -> "aiavatar";
            case SAFETY_REVIEW, GENERAL -> null;
        };
    }

    private static String appLabel(String appCode) {
        return switch (firstNonBlank(appCode, "unknown")) {
            case "music" -> "AI 音乐人";
            case "drama" -> "AI 短剧";
            case "celebrity" -> "AI 明星带货";
            case "aiavatar" -> "AiAvatar 数字人";
            case "star" -> "明星商务工作台";
            case "celebrity-mp" -> "明星带货·小程序";
            case "admin" -> "管理后台";
            case "external-api" -> "外部 API";
            default -> "未标记来源";
        };
    }

    private static String labelOrFallback(String id, Map<String, String> labels, String fallback) {
        String normalized = blankToNull(id);
        if (normalized == null) return fallback;
        return labels.getOrDefault(normalized, normalized);
    }

    private static AiModelBillingMode effectiveBillingMode(AiModelEndpoint endpoint,
                                                           String purpose,
                                                           AiModelBillingMode requested) {
        if (endpoint != null && endpoint.getBillingMode() != null) return endpoint.getBillingMode();
        if (requested != null) return requested;
        return inferBillingModeForPurpose(purpose);
    }

    private static AiModelBillingMode inferBillingModeForPurpose(String purpose) {
        return switch (AiModelPurpose.fromWire(purpose)) {
            case IMAGE_GENERATION, DAP_IMAGE -> AiModelBillingMode.PER_CALL;
            case VIDEO_GENERATION, DAP_VIDEO -> AiModelBillingMode.PER_SECOND;
            default -> AiModelBillingMode.TOKENS;
        };
    }

    private static long effectiveBillableUnits(AiModelBillingMode mode, Long requested, boolean success) {
        long value = safeLong(requested);
        if (success && value <= 0 && mode == AiModelBillingMode.PER_CALL) return 1L;
        return Math.max(0L, value);
    }

    private static long effectiveBillableSeconds(Long requested, boolean success) {
        if (!success) return 0L;
        return Math.max(0L, safeLong(requested));
    }

    private static long estimateCostMicros(long promptTokens,
                                           long completionTokens,
                                           AiModelBillingMode mode,
                                           long billableUnits,
                                           long billableSeconds,
                                           long unitPriceMicros,
                                           AiModelEndpoint endpoint) {
        AiModelBillingMode effective = mode != null ? mode : AiModelBillingMode.TOKENS;
        if (effective == AiModelBillingMode.PER_CALL) {
            return billableUnits * Math.max(0L, unitPriceMicros);
        }
        if (effective == AiModelBillingMode.PER_SECOND) {
            return billableSeconds * Math.max(0L, unitPriceMicros);
        }
        if (endpoint == null) return 0L;
        long promptCost = (promptTokens * Math.max(0L, endpoint.getPromptTokenPriceMicros())) / 1000L;
        long completionCost = (completionTokens * Math.max(0L, endpoint.getCompletionTokenPriceMicros())) / 1000L;
        return promptCost + completionCost;
    }

    private void bumpEndpointCounters(AiModelEndpoint endpoint,
                                      boolean success,
                                      long totalTokens,
                                      long billableUnits,
                                      long billableSeconds) {
        if (endpoint == null) return;
        endpoint.setTotalCalls(endpoint.getTotalCalls() + 1);
        endpoint.setLastUsedAt(Instant.now());
        if (success) {
            endpoint.setTotalTokens(endpoint.getTotalTokens() + Math.max(0L, totalTokens));
            endpoint.setTotalBillableUnits(endpoint.getTotalBillableUnits() + Math.max(0L, billableUnits));
            endpoint.setTotalBillableSeconds(endpoint.getTotalBillableSeconds() + Math.max(0L, billableSeconds));
        }
        endpointRepo.save(endpoint);
    }

    private static String yuanLabel(long micros) {
        if (micros <= 0) return "¥0";
        double yuan = micros / 1_000_000.0d;
        return "¥" + String.format(java.util.Locale.ROOT, "%.4f", yuan).replaceFirst("\\.?0+$", "");
    }

    private static long safeLong(Long value) {
        return value == null ? 0L : value;
    }

    private static String firstNonBlank(String first, String second) {
        String normalized = blankToNull(first);
        return normalized != null ? normalized : blankToNull(second);
    }

    private static String firstNonBlank(String first, String second, String third) {
        String normalized = firstNonBlank(first, second);
        return normalized != null ? normalized : blankToNull(third);
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String truncate(String s, int maxLength) {
        if (s == null || s.length() <= maxLength) return s;
        return s.substring(0, maxLength);
    }

    /** JPA 时间戳列在不同 DB / 驱动下可能回 Instant / Timestamp / Date，统一归一。 */
    private static Instant asInstant(Object o) {
        if (o instanceof Instant i) return i;
        if (o instanceof Timestamp t) return t.toInstant();
        if (o instanceof Date d) return d.toInstant();
        return null;
    }

    private record Attribution(String userId, String tenantId, String appCode) {}
}
