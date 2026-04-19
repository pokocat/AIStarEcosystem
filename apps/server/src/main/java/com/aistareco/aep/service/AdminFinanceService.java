package com.aistareco.aep.service;

import com.aistareco.aep.dto.MonthlyRevenuePointDto;
import com.aistareco.aep.dto.RevenueSourceDto;
import com.aistareco.aep.dto.TransactionDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.repository.LedgerEntryRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 平台级财务视图聚合。对齐前端 {@code apps/admin/src/types/finance.ts}：
 * <ul>
 *   <li>{@link TransactionDto} —— 基于 {@link LedgerEntry} 派生的业务交易列表</li>
 *   <li>{@link MonthlyRevenuePointDto} —— 最近 6 个月入账总额（credits）</li>
 *   <li>{@link RevenueSourceDto} —— 按 {@code entryType} 聚合的入账来源饼图</li>
 * </ul>
 * LedgerEntry 是事实表，本服务只做读侧派生。
 */
@Service
public class AdminFinanceService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZONE);
    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM").withZone(ZONE);

    /** 饼图配色（与前端 RevenueSourcePie 使用的 tailwind 语义色保持一致）。 */
    private static final Map<LedgerEntry.LedgerEntryType, SourceMeta> SOURCE_META =
            new EnumMap<>(LedgerEntry.LedgerEntryType.class);
    static {
        SOURCE_META.put(LedgerEntry.LedgerEntryType.LICENSE_GRANT, new SourceMeta("秘钥核销",  "#6366f1"));
        SOURCE_META.put(LedgerEntry.LedgerEntryType.RECHARGE,      new SourceMeta("充值",      "#10b981"));
        SOURCE_META.put(LedgerEntry.LedgerEntryType.INCOME,        new SourceMeta("业务收益",  "#f59e0b"));
        SOURCE_META.put(LedgerEntry.LedgerEntryType.GIFT,          new SourceMeta("平台赠送",  "#ec4899"));
        SOURCE_META.put(LedgerEntry.LedgerEntryType.REFUND,        new SourceMeta("退款",      "#94a3b8"));
        SOURCE_META.put(LedgerEntry.LedgerEntryType.ADJUST,        new SourceMeta("调账",      "#64748b"));
    }

    private final LedgerEntryRepository ledgerRepo;

    public AdminFinanceService(LedgerEntryRepository ledgerRepo) {
        this.ledgerRepo = ledgerRepo;
    }

    public List<TransactionDto> listTransactions(int page, int size, String userId) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        List<LedgerEntry> entries = (userId == null || userId.isBlank())
                ? ledgerRepo.findAll(pageable).getContent()
                : ledgerRepo.findByUserId(userId, pageable).getContent();
        List<TransactionDto> rows = new ArrayList<>(entries.size());
        for (LedgerEntry e : entries) rows.add(toTransaction(e));
        return rows;
    }

    /** 最近 6 个完整月（含当月）的入账汇总。缺失月份填 0，保证前端图表轴连续。 */
    public List<MonthlyRevenuePointDto> monthlyRevenue() {
        YearMonth thisMonth = YearMonth.now(ZONE);
        YearMonth start = thisMonth.minusMonths(5);
        Instant since = start.atDay(1).atStartOfDay(ZONE).toInstant();

        Map<String, Long> byMonth = new LinkedHashMap<>();
        for (int i = 0; i < 6; i++) {
            YearMonth ym = start.plusMonths(i);
            byMonth.put(ym.format(DateTimeFormatter.ofPattern("yyyy-MM")), 0L);
        }
        for (LedgerEntry e : ledgerRepo.findAllPositiveSince(since)) {
            String key = MONTH_FMT.format(e.getCreatedAt());
            byMonth.computeIfPresent(key, (k, v) -> v + e.getAmount());
        }
        List<MonthlyRevenuePointDto> out = new ArrayList<>(6);
        byMonth.forEach((k, v) -> out.add(new MonthlyRevenuePointDto(k, v)));
        return out;
    }

    /** 按入账类型聚合，只返回有金额的桶，保持前端饼图展示稳定。 */
    public List<RevenueSourceDto> revenueSources() {
        List<Object[]> rows = ledgerRepo.aggregateIncomeByTypeAll();
        List<RevenueSourceDto> out = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            LedgerEntry.LedgerEntryType type = (LedgerEntry.LedgerEntryType) row[0];
            long sum = ((Number) row[1]).longValue();
            if (sum <= 0) continue;
            SourceMeta meta = SOURCE_META.getOrDefault(
                    type, new SourceMeta(type.name().toLowerCase(Locale.ROOT), "#94a3b8"));
            int clamped = (int) Math.min(Integer.MAX_VALUE, sum);
            out.add(new RevenueSourceDto(meta.label(), clamped, meta.color()));
        }
        return out;
    }

    private TransactionDto toTransaction(LedgerEntry e) {
        String dateStr = DATE_FMT.format(e.getCreatedAt() != null ? e.getCreatedAt() : Instant.now());
        String source = e.getDescription() != null && !e.getDescription().isBlank()
                ? e.getDescription()
                : (e.getReferenceType() != null ? e.getReferenceType() : e.getEntryType().name().toLowerCase(Locale.ROOT));
        String type = mapType(e.getEntryType());
        return new TransactionDto(
                e.getId(),
                source,
                e.getAmount(),
                dateStr,
                "completed",
                type,
                e.getUserId()
        );
    }

    /** LedgerEntry 枚举 → 前端 TransactionType（income / withdrawal / spend / recharge / license_grant）。 */
    private String mapType(LedgerEntry.LedgerEntryType t) {
        return switch (t) {
            case LICENSE_GRANT -> "license_grant";
            case RECHARGE -> "recharge";
            case WITHDRAW -> "withdrawal";
            case SPEND, FREEZE -> "spend";
            case INCOME, GIFT, REFUND, UNFREEZE, ADJUST -> "income";
        };
    }

    private record SourceMeta(String label, String color) {}

    // 辅助：把 LocalDate 转成前端期望的 yyyy-MM-dd
    @SuppressWarnings("unused")
    private static String isoDate(LocalDate d) {
        return d.format(DateTimeFormatter.ISO_LOCAL_DATE);
    }
}
