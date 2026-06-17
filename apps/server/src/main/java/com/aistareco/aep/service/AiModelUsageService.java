package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelUsageDailyDto;
import com.aistareco.aep.dto.AiModelUsageReportDto;
import com.aistareco.aep.dto.AiModelUsageStatDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AiModelUsageRecord;
import com.aistareco.aep.repository.AiModelUsageRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

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

    public AiModelUsageService(AiModelUsageRecordRepository repo) {
        this.repo = repo;
    }

    /**
     * 记录一次调用用量。独立事务（REQUIRES_NEW）+ 全程 try/catch：
     * 写库失败只 log，不影响 chat 主流程（调用方可能跑在 NOT_SUPPORTED 事务里）。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String providerId, String providerName, String model, String purpose,
                       Long promptTokens, Long completionTokens, Long totalTokens, boolean success) {
        try {
            AiModelUsageRecord rec = AiModelUsageRecord.builder()
                    .id("aiu-" + UUID.randomUUID().toString().substring(0, 16))
                    .providerId(providerId)
                    .providerName(providerName)
                    .model(model)
                    .purpose(purpose)
                    .promptTokens(promptTokens)
                    .completionTokens(completionTokens)
                    .totalTokens(totalTokens)
                    .success(success)
                    .build();
            repo.save(rec);
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
        List<AiModelUsageDailyDto> byDay = buildDaily(repo.dailyRows(since, null));
        long failedCalls = repo.countFailed(since, null);
        // 总计由分组行汇总（按服务商分组无重复计数），避开 Spring Data 单行 Object[] 聚合的包装坑。
        long[] totals = sumStats(byProvider);
        return new AiModelUsageReportDto(
                window, since,
                totals[0], totals[1], totals[2], totals[3], failedCalls,
                byProvider, byModel, byPurpose, byDay);
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
        List<AiModelUsageDailyDto> byDay = buildDaily(repo.dailyRows(since, providerId));
        long failedCalls = repo.countFailed(since, providerId);
        long[] totals = sumStats(byModel);
        return new AiModelUsageReportDto(
                window, since,
                totals[0], totals[1], totals[2], totals[3], failedCalls,
                byProvider, byModel, byPurpose, byDay);
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    private static int clampDays(Integer days) {
        if (days == null || days <= 0) return DEFAULT_WINDOW_DAYS;
        return Math.min(days, MAX_WINDOW_DAYS);
    }

    private static List<AiModelUsageStatDto> mapRows(List<Object[]> rows) {
        List<AiModelUsageStatDto> out = new ArrayList<>();
        if (rows == null) return out;
        for (Object[] r : rows) {
            String key = r[0] != null ? String.valueOf(r[0]) : "(未知)";
            String label = r[1] != null ? String.valueOf(r[1]) : key;
            out.add(new AiModelUsageStatDto(
                    key, label,
                    asLong(r[2]), asLong(r[3]), asLong(r[4]), asLong(r[5])));
        }
        out.sort((a, b) -> Long.compare(b.totalTokens(), a.totalTokens()));
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
                    asLong(r[2]), asLong(r[3]), asLong(r[4]), asLong(r[5])));
        }
        out.sort((a, b) -> Long.compare(b.totalTokens(), a.totalTokens()));
        return out;
    }

    /**
     * 把明细行按北京自然日分桶（仅有数据的日子，按日期升序）。
     * 行格式 [0]=createdAt, [1]=total, [2]=prompt, [3]=completion。
     */
    private static List<AiModelUsageDailyDto> buildDaily(List<Object[]> rows) {
        List<AiModelUsageDailyDto> out = new ArrayList<>();
        if (rows == null || rows.isEmpty()) return out;
        Map<LocalDate, long[]> buckets = new TreeMap<>(); // TreeMap → 天然按日期升序
        for (Object[] r : rows) {
            Instant ts = asInstant(r[0]);
            if (ts == null) continue;
            LocalDate day = ts.atZone(BUCKET_ZONE).toLocalDate();
            long[] agg = buckets.computeIfAbsent(day, k -> new long[4]);
            agg[0] += 1;              // calls
            agg[1] += asLong(r[1]);   // total
            agg[2] += asLong(r[2]);   // prompt
            agg[3] += asLong(r[3]);   // completion
        }
        for (Map.Entry<LocalDate, long[]> e : buckets.entrySet()) {
            long[] a = e.getValue();
            out.add(new AiModelUsageDailyDto(e.getKey().toString(), a[0], a[1], a[2], a[3]));
        }
        return out;
    }

    /** 把分组行汇总成 [calls, total, prompt, completion]。 */
    private static long[] sumStats(List<AiModelUsageStatDto> rows) {
        long calls = 0, total = 0, prompt = 0, completion = 0;
        for (AiModelUsageStatDto r : rows) {
            calls += r.calls();
            total += r.totalTokens();
            prompt += r.promptTokens();
            completion += r.completionTokens();
        }
        return new long[]{calls, total, prompt, completion};
    }

    private static long asLong(Object o) {
        return o instanceof Number n ? n.longValue() : 0L;
    }

    /** JPA 时间戳列在不同 DB / 驱动下可能回 Instant / Timestamp / Date，统一归一。 */
    private static Instant asInstant(Object o) {
        if (o instanceof Instant i) return i;
        if (o instanceof Timestamp t) return t.toInstant();
        if (o instanceof Date d) return d.toInstant();
        return null;
    }
}
