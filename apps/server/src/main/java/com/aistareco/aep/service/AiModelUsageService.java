package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelUsageReportDto;
import com.aistareco.aep.dto.AiModelUsageStatDto;
import com.aistareco.aep.model.AiModelUsageRecord;
import com.aistareco.aep.repository.AiModelUsageRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
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
        // 总计由分组行汇总（按服务商分组无重复计数），避开 Spring Data 单行 Object[] 聚合的包装坑。
        long[] totals = sumStats(byProvider);
        return new AiModelUsageReportDto(
                window, since,
                totals[0], totals[1], totals[2], totals[3],
                byProvider, byModel);
    }

    /** 单服务商用量报表。byProvider 仅该服务商一行；byModel 为其模型维度分解。 */
    @Transactional(readOnly = true)
    public AiModelUsageReportDto reportForProvider(String providerId, Integer days) {
        int window = clampDays(days);
        Instant since = Instant.now().minus(window, ChronoUnit.DAYS);
        List<AiModelUsageStatDto> byProvider = mapRows(repo.aggregateByProvider(since)).stream()
                .filter(s -> providerId.equals(s.key()))
                .toList();
        List<AiModelUsageStatDto> byModel = mapRows(repo.aggregateByModelForProvider(providerId, since));
        long[] totals = sumStats(byModel);
        return new AiModelUsageReportDto(
                window, since,
                totals[0], totals[1], totals[2], totals[3],
                byProvider, byModel);
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
}
